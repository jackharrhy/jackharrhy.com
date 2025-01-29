import re
from pathlib import Path
from typing import Generator

from pydantic import BaseModel
import typer
from loguru import logger
import httpx

API_BASE = "http://127.0.0.1:12315"
API_TOKEN = "abc123"

OUTPUT_DIR = Path("site/src/data/garden")
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
    md = ""
    for block in blocks:
        if block.get("properties") and block["properties"]:
            continue

        content = block["content"]

        content = re.sub(r"\[\[Garden/([^\]]+)\]\]", r"[[\1]]", content)

        if indent == 0:
            md += f"{content}\n\n"
        else:
            md += f'<div class="ml-[calc({indent}*1rem)]">\n{content}\n</div>\n\n'

        if "children" in block:
            md += blocks_to_md(block["children"], indent + 1)
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

    logger.info(f"Exporting {page.name} to {path}")

    content = f"""---
name: {page.name}
---

{page.markdown}"""
    path.write_text(content)


@app.command(name="build")
def run_build():
    client = create_logseq_client()

    for page in get_pages(client):
        export_page(page)


if __name__ == "__main__":
    app()
