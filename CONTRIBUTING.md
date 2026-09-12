# Contributing to Viaduct Community

Thanks for helping improve the local C4 editor.

## Scope

This repository is the **Community** edition: single-user / local browser editor.

Cloud-only features (collaboration, hosted MCP, change sets, cross-project
domains, org sharing, webhooks, AI metering) live in a private product line and
are out of scope here. See the Community vs Cloud section in [README.md](README.md).

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173/editor — no account required.

## Checks

```bash
npm run type-check
npm run lint
npm run build
npm run test:node
```

## Pull requests

- Prefer small, focused PRs.
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Do not add OAuth, multi-tenant project APIs, Yjs collab, or secret-bearing
  deploy configs.
- Do not commit `.env`, customer models, or SQLite databases.

## License

By contributing, you agree that your contributions are licensed under the same
BUSL-1.1 terms as this repository (see `LICENSE`).
