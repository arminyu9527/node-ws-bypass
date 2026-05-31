# Repository Guidelines

## Project Structure & Module Organization

This repository is a small Node.js WebSocket proxy service. The runtime entry point is `index.js`, which creates an Express HTTP server, handles WebSocket upgrades through `ws`, and optionally starts a Cloudflare tunnel when `TOKEN` is set. Package metadata and scripts live in `package.json`. Container packaging is defined in `Dockerfile`, and CI/CD workflow configuration is under `.github/workflows/`.

There is currently no separate `src/`, `test/`, or assets directory. Keep new runtime modules close to `index.js` unless the service grows enough to justify a `src/` split.

## Build, Test, and Development Commands

- `npm install`: install runtime dependencies (`express`, `ws`, `cloudflared`).
- `npm start`: run `node index.js` locally. Defaults to port `8080`.
- `PORT=3000 UUID=<uuid> TOKEN=<cloudflare-token> npm start`: run with explicit runtime configuration.
- `docker build -t node-ws-bypass .`: build the container image.
- `docker run -p 8080:8080 -e PORT=8080 node-ws-bypass`: run the service in Docker.

No build step is required; this project runs directly on Node.js.

## Coding Style & Naming Conventions

Use CommonJS modules (`require`) to match the current codebase. Keep indentation at two spaces and prefer `const`/`let` over `var`. Use lower camelCase for functions and variables, for example `targetHost`, `targetPort`, and `httpServer`.

Keep protocol parsing code explicit and easy to audit. Avoid broad rewrites unless they are needed for a specific behavior change. If adding formatting or linting tools, wire them through `package.json` scripts and document the command here.

## Testing Guidelines

There is no test suite configured yet. For behavior changes, add focused tests before expanding the service surface. A practical convention is to place tests under `test/` and name them after the behavior, such as `test/websocket-upgrade.test.js`.

Until automated tests exist, verify changes manually with `npm start`, a WebSocket client, and the expected `PORT`, `UUID`, and `TOKEN` combinations.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries such as `Update index.js` and `adjust code formart`. Keep commit messages concise and action oriented, for example `Fix websocket upgrade validation`.

Pull requests should include a brief description, the runtime configuration used for validation, and any manual test steps. Link related issues when available. Include logs or screenshots only when they clarify startup, tunnel, or connection behavior.

## Security & Configuration Tips

Do not commit real Cloudflare tunnel tokens or private UUIDs. Pass secrets through environment variables. Review changes to WebSocket parsing, TCP connection handling, and redirect behavior carefully because they affect network exposure.
