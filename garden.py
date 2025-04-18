import time
import re
import shutil
from pathlib import Path
from typing import Generator
from cloudpathlib import S3Client
import subprocess
import shelve

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
import typer
from loguru import logger
import httpx

API_BASE = "http://127.0.0.1:12315"
API_TOKEN = "abc123"

LOGSEQ_DIR = Path("./logseq")
ASSETS_DIR = LOGSEQ_DIR / "assets"
ASSETS_STAGING_DIR = Path("./assets-staging")
DRAWS_DIR = LOGSEQ_DIR / "draws"

OUTPUT_DIR = Path("./site/src/data/garden")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ASSET_CACHE_FILE = Path("asset_cache.shelve")
IMG_EXTS = {"png", "jpg", "jpeg", "webp", "gif", "svg", "avif"}

app = typer.Typer()


class Settings(BaseSettings):
    r2_access_key: str
    r2_secret_key: str
    r2_bucket: str

    cloudflare_account_id: str

    model_config = SettingsConfigDict(
        env_prefix="garden_", env_file=".env", env_file_encoding="utf-8"
    )


settings = Settings()


def get_local_image_size(file_path: Path) -> tuple[int, int]:
    if file_path.suffix.lower() == ".svg":
        svg_text = file_path.read_text()
        width_match = re.search(r'width="(\d+)', svg_text)
        height_match = re.search(r'height="(\d+)', svg_text)
        if width_match and height_match:
            return int(width_match.group(1)), int(height_match.group(1))

        raise ValueError(f"No width or height found in SVG: {file_path}")
    else:
        # For GIFs, specify [0] to only get the first frame
        file_path_str = str(file_path)
        if file_path.suffix.lower() == ".gif":
            file_path_str = f"{file_path_str}[0]"

        command = ["convert", file_path_str, "-format", "%wx%h", "info:"]

        result = subprocess.run(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )

        if result.returncode != 0 or not result.stdout:
            raise ValueError(f"ImageMagick error for {file_path}: {result.stderr}")

        dims = result.stdout.strip().split("x")

        if len(dims) != 2:
            raise ValueError(
                f"Unexpected ImageMagick output for {file_path}: {result.stdout}"
            )

        return int(dims[0]), int(dims[1])


def get_local_video_size(file_path: Path) -> tuple[int, int]:
    """
    Use ffprobe (from the ffmpeg suite) to get the width and height of a video file.
    """

    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=s=x:p=0",
        str(file_path),
    ]

    # ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 /Users/jacks/Desktop/test.mp4

    result = subprocess.run(
        command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )

    if result.returncode != 0 or not result.stdout:
        raise ValueError(f"ffprobe error for {file_path}: {result.stderr}")

    dims = result.stdout.strip().split("x")

    if len(dims) != 2:
        raise ValueError(f"Unexpected ffprobe output for {file_path}: {result.stdout}")

    return int(dims[0]), int(dims[1])


def get_r2_client() -> S3Client:
    return S3Client(
        aws_access_key_id=settings.r2_access_key,
        aws_secret_access_key=settings.r2_secret_key,
        endpoint_url=f"https://{settings.cloudflare_account_id}.r2.cloudflarestorage.com",
    )


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
    description: str | None
    custom_layout: str | None
    og_image: Asset | None

    filename: str
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


def query_logseq(client: httpx.Client, query: str = "(property public true)") -> dict:
    logger.debug(f"Querying Logseq with: {query}")
    response = client.post("/api", json={"method": "logseq.db.q", "args": [query]})
    response.raise_for_status()
    return response.json()


def get_block_link(client: httpx.Client, block_uuid: str) -> str:
    logger.debug(f"Getting page of block {block_uuid}")
    query = f"""
[:find (pull ?b [* {{:block/page [:block/name]}}])
 :where
 [?b :block/uuid #uuid "{block_uuid}"]]
    """

    response = client.post(
        "/api", json={"method": "logseq.db.datascriptQuery", "args": [query]}
    )
    response.raise_for_status()
    result = response.json()

    if result and len(result) > 0:
        block = result[0][0]

        slug = block.get("properties", {}).get("slug", None)
        page_name = block["page"]["name"].removeprefix("garden")

        if slug:
            return f"{page_name}#{slug}"
        else:
            return page_name
    else:
        raise ValueError(f"No page found for block {block_uuid}")


def get_page(client: httpx.Client, page_name: str) -> list[dict]:
    response = client.post(
        "/api", json={"method": "logseq.Editor.getPageBlocksTree", "args": [page_name]}
    )
    response.raise_for_status()
    blocks = response.json()
    if not blocks[0]["properties"]["public"]:
        raise ValueError(f"Page {page_name} is not public")
    return blocks


def get_block(client: httpx.Client, block_id: str) -> dict:
    response = client.post(
        "/api", json={"method": "logseq.Editor.getBlock", "args": [block_id]}
    )
    response.raise_for_status()
    return response.json()


def return_mdx_component(component: str, properties: dict) -> str:
    props = ""
    for key, value in properties.items():
        props += f'{key}="{value}" '
    return f"<{component} {props}/>\n"


def ensure_asset_dimensions(asset: Asset) -> Asset:
    """
    Ensure that the asset has its width and height values.
    If not available in the cache, compute them using:
      - SVG parsing for .svg files,
      - ffprobe for video files (mp4, webm, mov),
      - And the PIL Image for other image types.
    """
    if asset.width is not None and asset.height is not None:
        return asset

    with shelve.open(str(ASSET_CACHE_FILE)) as db:
        if asset.path in db:
            info = db[asset.path]
            if info["width"] is not None and info["height"] is not None:
                asset.width = info["width"]
                asset.height = info["height"]
                return asset

        local_path = ASSETS_DIR / asset.path

        if not local_path.exists():
            raise ValueError(f"File not found on disk: {asset.path}")

        logger.info(f"Getting dimensions for {asset.path}")

        ext = asset.ext.lower().split(".")[-1]

        if ext == "svg":
            svg_text = local_path.read_text()
            width_match = re.search(r'width="(\d+)', svg_text)
            height_match = re.search(r'height="(\d+)', svg_text)
            if width_match and height_match:
                w, h = int(width_match.group(1)), int(height_match.group(1))
            else:
                raise ValueError(f"No width or height found in SVG: {asset.path}")
        elif ext in {"mp4", "webm", "mov"}:
            w, h = get_local_video_size(local_path)
        else:
            w, h = get_local_image_size(local_path)

        db[asset.path] = {"width": w, "height": h}
        asset.width = w
        asset.height = h

    return asset


def asset_from_logseq_link(link: str) -> Asset:
    pattern = r"!\[(?P<name>.+?)\.(?P<ext>[^)\s]+?)\]\((?P<path>.*?)\)(?:\{:height (?P<height>\d+), :width (?P<width>\d+)\})?"
    match = re.match(pattern, link)
    if not match:
        raise ValueError(f"Invalid asset link format: {link}")

    name = match.group("name")
    ext = match.group("ext")
    path = match.group("path")
    height = match.group("height")
    width = match.group("width")

    if (height is not None and width is None) or (height is None and width is not None):
        raise ValueError(f"Must provide *both* dimensions or neither in link: {link}")

    if not path.startswith("../assets/"):
        raise ValueError(f"Asset path must start with ../assets/: {path}")

    path = path.removeprefix("../assets/")

    timestamp = re.search(r"_(\d+)_", path)
    if not timestamp:
        raise ValueError(f"Could not extract timestamp from path: {path}")
    timestamp = timestamp.group(1)

    url = f"/asset/{path}"
    new_asset = Asset(
        name=name,
        ext=ext,
        path=path,
        timestamp=int(timestamp),
        url=url,
        height=int(height) if height else None,
        width=int(width) if width else None,
    )

    return new_asset


def asset_back_to_md(asset: Asset) -> str:
    audio_extensions = {"mp3", "wav", "ogg"}
    if asset.ext.lower() in audio_extensions:
        return f"<audio controls src='{asset.url}'></audio>"

    asset = ensure_asset_dimensions(asset)

    video_extensions = {"mp4", "webm", "mov"}
    if asset.ext.lower() in video_extensions:
        return f"<video controls src='{asset.url}' width='{asset.width}' height='{asset.height}'></video>"

    if asset.height is None or asset.width is None:
        raise ValueError(f"Missing dimensions for asset: {asset.path}")

    return f"<Image src='{asset.url}' alt='{asset.name}.{asset.ext}' width={{{asset.width}}} height={{{asset.height}}} />"


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

    asset = ensure_asset_dimensions(asset)

    return asset_back_to_md(asset), asset


def blocks_to_md(
    client: httpx.Client,
    blocks: list[dict],
    level: int = 0,
) -> tuple[str, list[Asset]]:
    assets: list[Asset] = []

    if level == 0:
        md = ""
    else:
        md = '<div class="ml-[2rem] mb-8">\n'

    for block in blocks:
        content = block["content"]

        slug = None

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

            has_an_id = properties.get("id") is not None
            is_just_an_id = has_an_id and len(properties) == 1

            if has_an_id:
                content = re.sub(r"\s*id::\s*[a-f0-9-]+($|\n)", "", content)

            has_a_slug = properties.get("slug") is not None

            if has_a_slug:
                content = re.sub(r"\s*slug::\s*[a-z0-9-]+($|\n)", "", content)
                slug = properties.get("slug")

            if not is_just_a_heading and not is_just_an_id and not has_a_slug:
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
            content, embed_assets = blocks_to_md(client, blocks, level + 1)
            assets.extend(embed_assets)

        video_match = re.match(
            r"\{\{video\s+https://www\.youtube\.com/watch\?v=([a-zA-Z0-9_-]+)\}\}",
            content,
        )
        if video_match:
            video_id = video_match.group(1)
            content = f"""<iframe
    class="my-2"
    width="100%"
    height="400"
    src="https://www.youtube.com/embed/{video_id}"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
></iframe>"""

        if not content:
            content = '<div class="w-full h-4"></div>'

        content = re.sub(r"\[\[Garden/([^\]]+)\]\]", r"[[\1]]", content)

        block_ref_match = re.search(
            r"\[\s*(.+?)\s*\]\s*\(\(\(([0-9a-f-]+)\)\)\)", content
        )
        if block_ref_match:
            _link_text = block_ref_match.group(1)
            uuid = block_ref_match.group(2)

            block_link = get_block_link(client, uuid)

            content = content.replace(f"(({uuid}))", block_link)

        if slug:
            content = f'<a name="{slug}"></a>\n{content}'

        md += f"{content}\n\n"

        if "children" in block and len(block["children"]) > 0:
            inner_md, inner_assets = blocks_to_md(client, block["children"], level + 1)
            md += inner_md
            assets.extend(inner_assets)

    if level > 0:
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
    result = query_logseq(client)

    logger.info(f"Found {len(result)} pages")

    names = [page["page"]["originalName"] for page in result]

    for name in names:
        page = get_page(client, name)

        first_block = page[0]
        if not first_block["properties"].get("public", False):
            raise ValueError(f"Page {name} is not public")

        md, assets = blocks_to_md(client, page)
        md, more_assets = search_md_for_assets(md)

        name = name.removeprefix("Garden/")

        filename = (
            name.replace("?", "")
            .replace(" ", "-")
            .replace("&", "and")
            .replace(".", "-")
            .replace(":", "-")
        )

        yield Page(
            name=name,
            description=first_block["properties"].get("description", None),
            custom_layout=first_block["properties"].get("customLayout", None),
            og_image=asset_from_logseq_link(page[0]["properties"]["ogImage"])
            if page[0]["properties"].get("ogImage")
            else None,
            filename=filename,
            markdown=md,
            assets=list(set(assets + more_assets)),
        )


def export_page(page: Page):
    path = OUTPUT_DIR / f"{page.filename}.mdx"
    path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Exporting {page.name} to {path}")

    content = "---\n"
    content += f'name: "{page.name.replace('"', '\\"')}"' + "\n"
    if page.description:
        content += f'description: "{page.description.replace('"', '\\"')}"' + "\n"
    if page.custom_layout:
        content += f'customLayout: "{page.custom_layout}"' + "\n"
    if page.og_image:
        content += f'ogImage: "{page.og_image.url}"\n'
    content += "---\n\n"

    content += page.markdown

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
                description=page[0]["properties"].get("description", None),
                custom_layout=page[0]["properties"].get("customLayout", None),
                og_image=asset_from_logseq_link(page[0]["properties"]["ogImage"])
                if page[0]["properties"].get("ogImage")
                else None,
                filename=page_name,
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


@app.command(name="sync-assets")
def run_build_asset_manifest():
    client = create_logseq_client()

    all_assets: list[Asset] = []

    for page in get_pages(client):
        if page.og_image:
            all_assets.append(page.og_image)

        for asset in page.assets:
            all_assets.append(asset)

    all_assets = list(set(all_assets))

    logger.info(f"Syncing {len(all_assets)} assets to staging directory...")

    ASSETS_STAGING_DIR.mkdir(parents=True, exist_ok=True)

    for asset in all_assets:
        src_path = ASSETS_DIR / asset.path
        dst_path = ASSETS_STAGING_DIR / asset.path
        dst_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            shutil.copy2(src_path, dst_path)
        except Exception as e:
            logger.error(f"Failed to copy {src_path} to {dst_path}: {e}")
            raise typer.Exit(1)

    logger.info("Running rclone sync...")
    result = subprocess.run(
        ["rclone", "sync", "./assets-staging/", "garden:jacks-garden"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(f"rclone sync failed: {result.stderr}")
        raise typer.Exit(1)
    logger.info("Asset sync complete")


@app.command(name="clear-cache")
def clear_cache():
    if ASSET_CACHE_FILE.exists():
        ASSET_CACHE_FILE.unlink()
    logger.info("Asset cache cleared.")


@app.command(name="process-cache")
def process_cache():
    client = create_logseq_client()
    logger.info("Re-processing all assets into shelve cache...")
    for page in get_pages(client):
        if page.og_image and page.og_image.ext.lower() in IMG_EXTS:
            page.og_image = ensure_asset_dimensions(page.og_image)
        for asset in page.assets:
            if asset.ext.lower() in IMG_EXTS:
                asset = ensure_asset_dimensions(asset)
    logger.info("All assets processed into cache.")


if __name__ == "__main__":
    app()
