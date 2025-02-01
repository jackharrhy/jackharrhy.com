import time
import re
import shutil
from pathlib import Path
from typing import Generator
import subprocess

from pydantic import BaseModel
import typer
from loguru import logger
import httpx

API_BASE = "http://127.0.0.1:12315"
API_TOKEN = "abc123"

LOGSEQ_DIR = Path("./logseq")
ASSETS_DIR = LOGSEQ_DIR / "assets"
DRAWS_DIR = LOGSEQ_DIR / "draws"

OUTPUT_DIR = Path("./site/src/data/garden")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = typer.Typer()


class Asset(BaseModel):
    name: str
    ext: str
    path: str
    timestamp: int
    height: int | None
    width: int | None

    url: str

    def __hash__(self) -> int:
        return hash(self.path)


class Page(BaseModel):
    name: str
    markdown: str
    assets: list[Asset]


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


def get_page(client: httpx.Client, page_name: str) -> list[dict]:
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


def return_mdx_component(component: str, properties: dict) -> str:
    props = ""
    for key, value in properties.items():
        props += f'{key}="{value}" '
    return f"<{component} {props}/>\n"


def asset_from_logseq_link(link: str) -> Asset:
    pattern = r"!\[(?P<name>.+?)\.(?P<ext>.+?)\]\((?P<path>.*?)\)(?:\{:height (?P<height>\d+), :width (?P<width>\d+)\})?"
    match = re.match(pattern, link)
    if not match:
        raise ValueError(f"Invalid asset link format: {link}")

    name = match.group("name")
    ext = match.group("ext")
    path = match.group("path")
    height = match.group("height")
    width = match.group("width")

    if not path.startswith("../assets/"):
        raise ValueError(f"Asset path must start with ../assets/: {path}")

    path = path.removeprefix("../assets/")

    timestamp = re.search(r"_(\d+)_", path)
    if not timestamp:
        raise ValueError(f"Could not extract timestamp from path: {path}")
    timestamp = timestamp.group(1)

    url = f"/asset/{path}"

    return Asset(
        name=name,
        ext=ext,
        path=path,
        timestamp=int(timestamp),
        url=url,
        height=int(height) if height else None,
        width=int(width) if width else None,
    )


def asset_back_to_md(asset: Asset, img: bool = False) -> str:
    audio_extensions = {"mp3", "wav", "ogg"}
    if asset.ext.lower() in audio_extensions:
        return f"<audio controls src='{asset.url}'></audio>"

    elif img or (asset.height and asset.width):
        return (
            f"<img src='{asset.url}' alt='{asset.name}.{asset.ext}'"
            + (
                f" height='{asset.height}' width='{asset.width}'"
                if asset.height and asset.width
                else ""
            )
            + " />"
        )
    else:
        return f"![{asset.name}.{asset.ext}]({asset.url})"


def excalidraw_to_md(filename: str) -> tuple[str, Asset]:
    path = DRAWS_DIR / filename

    timestamp = int(path.stat().st_mtime)

    asset_dest = ASSETS_DIR / f"{filename}.svg"

    if asset_dest.exists() and asset_dest.stat().st_mtime > timestamp:
        pass
    else:
        asset_temp = ASSETS_DIR / filename
        shutil.copy(path, asset_temp)
        subprocess.run(["excalidraw_export", str(asset_temp)], check=True)
        asset_temp.unlink()

    asset = Asset(
        name=filename,
        ext="svg",
        path=asset_dest.name,
        timestamp=timestamp,
        url=f"/asset/{asset_dest.name}",
        height=None,
        width=None,
    )

    return asset_back_to_md(asset, img=True), asset


def blocks_to_md(
    client: httpx.Client, blocks: list[dict], indent: int = 0
) -> tuple[str, list[Asset]]:
    assets: list[Asset] = []

    if indent == 0:
        md = ""
    else:
        md = f'<div class="ml-[calc({indent}*1rem)] mb-8">\n'

    for block in blocks:
        content = block["content"]

        if block.get("properties") and block["properties"]:
            properties = block["properties"]

            if properties.get("component") is not None:
                other_properties = {
                    k: v for k, v in properties.items() if k != "component"
                }

                if other_properties.get("image"):
                    asset = asset_from_logseq_link(other_properties["image"])
                    other_properties["image"] = asset.url
                    assets.append(asset)

                md += return_mdx_component(properties["component"], other_properties)

            is_just_a_heading = (
                properties.get("heading") is not None and len(properties) == 1
            )

            is_just_an_id = properties.get("id") is not None and len(properties) == 1

            if is_just_an_id:
                content = re.sub(r"\s*id::\s*[a-f0-9-]+$", "", content)

            if not is_just_a_heading and not is_just_an_id:
                continue

        excalidraw_match = re.match(
            r"\[\[draws/(?P<filename>.*\.excalidraw)\]\]", content
        )
        if excalidraw_match:
            filename = excalidraw_match.group("filename")
            content, asset = excalidraw_to_md(filename)
            assets.append(asset)

        html_match = re.match(r"@@html:\s*(.+?)\s*@@", content)
        if html_match:
            content = html_match.group(1)

        embed_match = re.match(r"\{\{embed \[\[(.+?)\]\]\}\}", content)
        if embed_match:
            page_name = embed_match.group(1)
            blocks = get_page(client, page_name)
            content, embed_assets = blocks_to_md(client, blocks, indent + 1)
            assets.extend(embed_assets)

        if not content:
            content = '<div class="w-full h-4"></div>'

        content = re.sub(r"\[\[Garden/([^\]]+)\]\]", r"[[\1]]", content)

        md += f"{content}\n\n"

        if "children" in block and len(block["children"]) > 0:
            inner_md, inner_assets = blocks_to_md(client, block["children"], indent + 1)
            md += inner_md
            assets.extend(inner_assets)

    if indent > 0:
        md += "</div>\n"

    return md, assets


def search_md_for_assets(md: str) -> tuple[str, list[Asset]]:
    assets = []

    image_matches = re.finditer(
        r"!\[.*?\]\(../assets/.*?\)(?:\{:height \d+, :width \d+\})?", md
    )

    new_md = md

    for match in image_matches:
        asset = asset_from_logseq_link(match.group(0))
        new_md = new_md.replace(match.group(0), asset_back_to_md(asset))

        assets.append(asset)

    return new_md, assets


def get_pages(client: httpx.Client) -> Generator[Page, None, None]:
    query = "(property public true)"
    result = query_logseq(client, query)

    logger.info(f"Found {len(result)} pages")

    names = [page["page"]["originalName"] for page in result]

    for name in names:
        page = get_page(client, name)
        md, assets = blocks_to_md(client, page)
        md, more_assets = search_md_for_assets(md)

        yield Page(
            name=name.removeprefix("Garden/"),
            markdown=md,
            assets=list(set(assets + more_assets)),
        )


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
def run_build(page_name: str | None = None):
    client = create_logseq_client()

    if page_name:
        page = get_page(client, f"Garden/{page_name}")
        md, assets = blocks_to_md(client, page)
        md, more_assets = search_md_for_assets(md)
        export_page(
            Page(
                name=page_name,
                markdown=md,
                assets=list(set(assets + more_assets)),
            )
        )
    else:
        export_pages(client)


@app.command(name="reload")
def run_reload(interval: int = 4):
    client = create_logseq_client()

    logger.info("Building first time")

    export_pages(client)

    logger.info(f"Watching for changes every {interval} seconds...")

    while True:
        current_cache = {}

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


@app.command(name="asset-manifest")
def run_build_asset_manifest():
    client = create_logseq_client()

    all_assets: list[Asset] = []

    for page in get_pages(client):
        for asset in page.assets:
            all_assets.append(asset)

    all_assets = list(set(all_assets))

    print(all_assets)


if __name__ == "__main__":
    app()
