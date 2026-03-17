freshen-vps:
  ssh jack@jackharrhy.dev "cd cookie-ops/core && docker compose pull && docker compose up -d"

lychee:
  lychee .
