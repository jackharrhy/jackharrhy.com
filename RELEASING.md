# Security image releases

Node is pinned to 26.12.1 in every Docker stage, with Alpine packages and
CA certificates refreshed during image builds. CI checks source tooling and
actual Node HTTPS trust, but deliberately does not publish a contentless image.

The normal release path is `pnpm run deploy`, not a Git push. It requires the
external Garden vault and assets, prompts on the production manifest diff,
builds Astro locally, **uploads assets to R2**, verifies assets, and publishes
`prebuilt-runtime` to GHCR. It does not restart production. Do not run it as a
runtime-only patch without reviewing those external writes.

For a release with no asset writes, on a machine with the approved Garden
snapshot, use the existing format/check, metadata validation and manifest review
steps; build the approved content with `pnpm run build`. Then build and test the
image separately before publishing:

```sh
revision=$(git rev-parse HEAD)
image=ghcr.io/jackharrhy/jackharrhy.com:sha-$revision
docker build --pull --target prebuilt-runtime \
  --label org.opencontainers.image.revision="$revision" \
  --label org.opencontainers.image.source=https://github.com/jackharrhy/jackharrhy.com \
  -t "$image" .
docker run --rm -v "$PWD/scripts/check-node-tls.mjs:/check-node-tls.mjs:ro" \
  "$image" node /check-node-tls.mjs
docker push "$image"
docker buildx imagetools inspect "$image"
```

Use a clean source checkout; retain the approved content manifest with the release
record because Git does not contain the Garden snapshot. Do not move `latest`
until the operator approves the content diff and rollout. Supply the immutable
registry digest to the deployment operator. Missing Garden content is a release
blocker, not permission to publish a site without its pages.
