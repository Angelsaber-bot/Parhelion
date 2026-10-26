# Existing production deployment handoff

2026-10-26: user authorized publishing this update to the existing GitHub repository and existing website/server. This is not authorization to create hosting, domains, accounts, or credentials. The implementation used only the isolated cloud checkout. A later explicit user approval permits one separate Work task to deploy using the existing authenticated local environment; this cloud task itself does not access that computer.

## Verified targets

- Repository: `https://github.com/Angelsaber-bot/Parhelion` / `main`.
- Existing static site: `https://parhelion-game.pages.dev` (Cloudflare Pages project name: `parhelion-game`). HTTP 200 verified.
- Existing server: `wss://parhelion-arena.lejiazhang-us.workers.dev/arena`; `/health` returned `Parhelion Arena server OK`.
- Worker config: `arena-game/worker/wrangler.toml`, name `parhelion-arena`, existing Lobby/Room Durable Objects. Keep the existing v1 migration unchanged.
- Pages account ID, production branch, and current full site build source are **not present in this repository**. Confirm them in the existing authenticated account; do not guess an account or create a new project.

## Current cloud blocker

`wrangler whoami` reports **You are not authenticated**. No Cloudflare token/account environment variables or connected Cloudflare deploy tool are available. GitHub credentials are available through the connector, separately from Cloudflare. A GitHub push does **not** establish a website deployment.

A separately approved operator can use the existing authenticated environment for the following commands. This cloud task did not start OAuth login or create credentials. Do not paste secrets into chat. Do not use `--temporary`, create another account, deploy to a new project, or use a stale standalone website bundle.

## Paired rollout

Rules version 2 adds authoritative crouch. Old and new clients/servers must not silently interoperate. Schedule a brief online maintenance window: old sessions can disconnect when the Worker updates; old pages will need refresh. Offline play and World do not require the server. Prepare the static stage first, then deploy the Worker, run its two-client smoke test, and immediately deploy Pages. Do not publish the new static client if the Worker test fails. Retain the current production Worker and Pages deployment IDs before starting; roll back the pair if production verification fails.

From a fresh checkout of the published commit (Node 22+):

```sh
npm ci --prefix arena-game
npm ci --prefix world
npm test --prefix arena-game
npm test --prefix world
npm run build --prefix arena-game
npm run build --prefix world
```

Obtain the **current production** homepage/site resources and routing headers from the existing Pages source/deployment. This repo deliberately does not replace them with an older cloud ZIP. Stage a copy outside the repository and replace only the Arena/World build directories:

```sh
# Set STAGE to a new staging directory containing the current production shell.
# Verify STAGE/index.html, STAGE/site/, and any existing _headers/_redirects first.
rsync -a --delete arena-game/dist/ "$STAGE/arena/"
rsync -a --delete world/dist/ "$STAGE/world/"
# Ensure the stage keeps /, /arena/, /world/ and all current shell assets.

cd arena-game
npx wrangler whoami
npx wrangler pages project list
# Confirm the existing project/account and production branch before proceeding.
npm run worker:deploy
npx tsx test/worker-smoke.ts wss://parhelion-arena.lejiazhang-us.workers.dev/arena
npx wrangler pages deploy "$STAGE" --project-name=parhelion-game --branch="$CONFIRMED_PRODUCTION_BRANCH"
```

Post-deploy verify `/`, `/arena/`, `/world/`; compare deployed JS and weapon GLB hashes to this build; check both players' crouched snapshots in the Worker smoke test; check a legacy client is rejected explicitly; test settings save/rebind/reset and FPS/TPS/ADS in a real browser. The integration passed 104 Arena + 48 World automated tests and both builds, but cloud Chromium and local Durable Objects runtime are blocked by host restrictions. Browser/production verification is not claimed until performed.
