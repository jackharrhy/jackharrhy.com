import time
import re
import shutil
from pathlib import Path
from typing import Generator

from pydantic import BaseModel
import typer
from loguru import logger
import httpx

API_BASE = "http://127.0.0.1:12315"
API_TOKEN = "abc123"

OUTPUT_DIR = Path("./site/src/data/garden")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = typer.Typer()


class Page(BaseModel):
    name: str
    markdown: str


def create_logseq_client(
    base_url: str = API_BASE, token: str = API_TOKEN
) -> httpx.Client:
    return httpx.Client(
        base_url=base_url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )


def query_logseq(client: httpx.Client, query: str) -> dict:
    logger.debug(f"Querying Logseq with: {query}")
    response = client.post("/api", json={"method": "logseq.db.q", "args": [query]})
    response.raise_for_status()
    return response.json()


def get_page(client: httpx.Client, page_name: str) -> dict:
    response = client.post(
        "/api",
        json={
            "method": "logseq.Editor.getPageBlocksTree",
            "args": [page_name],
        },
    )
    response.raise_for_status()

    blocks = response.json()

    if not blocks[0]["properties"]["public"]:
        raise ValueError(f"Page {page_name} is not public")

    return blocks


def blocks_to_md(blocks: list[dict], indent: int = 0) -> str:
    if indent == 0:
        md = ""
    else:
        md = f'<div class="ml-[calc({indent}*1rem)] mb-8">\n'

    for block in blocks:
        if block.get("properties") and block["properties"]:
            continue

        content = block["content"]

        if not content:
            content = '<div class="w-full h-4"></div>'

        content = re.sub(r"\[\[Garden/([^\]]+)\]\]", r"[[\1]]", content)

        if indent == 0:
            md += f"{content}\n\n"
        else:
            md += f"{content}\n\n"

        if "children" in block and len(block["children"]) > 0:
            md += blocks_to_md(block["children"], indent + 1)

    if indent > 0:
        md += "</div>\n"

    return md


def get_pages(client: httpx.Client) -> Generator[Page, None, None]:
    query = "(property public true)"
    result = query_logseq(client, query)

    logger.info(f"Found {len(result)} pages")

    names = [page["page"]["originalName"] for page in result]

    for name in names:
        page = get_page(client, name)
        md = blocks_to_md(page).strip() + "\n"

        yield Page(name=name.removeprefix("Garden/"), markdown=md)


def export_page(page: Page):
    path = OUTPUT_DIR / f"{page.name}.mdx"
    path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Exporting {page.name} to {path}")

    content = f"""---
name: "{page.name}"
---

{page.markdown}"""
    path.write_text(content)


def export_pages(client: httpx.Client):
    logger.info(f"Clearing {OUTPUT_DIR}")
    shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir()

    for page in get_pages(client):
        export_page(page)


@app.command(name="build")
def run_build():
    client = create_logseq_client()

    export_pages(client)


@app.command(name="reload")
def run_reload(interval: int = 4):
    client = create_logseq_client()

    logger.info("Building first time")

    export_pages(client)

    logger.info(f"Watching for changes every {interval} seconds...")

    while True:
        current_cache = {}

        # Build initial cache
        for page in get_pages(client):
            current_cache[page.name] = page.markdown

        current_hash = hash(frozenset(current_cache.items()))

        time.sleep(interval)

        new_cache = {}
        for page in get_pages(client):
            new_cache[page.name] = page.markdown

        new_hash = hash(frozenset(new_cache.items()))

        if new_hash != current_hash:
            logger.info("Changes detected, rebuilding...")
            export_pages(client)
            logger.info("Rebuild complete")


if __name__ == "__main__":
    app()
