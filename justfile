freshen-vps:
  ssh jack@jackharrhy.dev "cd cookie-ops/core && docker compose pull && docker compose up -d"

prepare:
  uv run garden.py sync-assets
  uv run garden.py build

lychee:
  lychee .
