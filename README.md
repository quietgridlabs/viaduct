# Viaduct Community

[![License: BUSL-1.1](https://img.shields.io/badge/license-BUSL--1.1-blue.svg)](./LICENSE)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)

**Viaduct** by [Quiet Grid Labs](https://quietgridlabs.com) — design, explore, and document architecture with the [C4 model](https://c4model.com/), Magic flows, docs, and contracts. Runs locally in the browser. No account.

Hosted team product (collab, MCP, change sets): **[Viaduct Cloud](https://c4.quietgridlabs.com)**

> Not a fork of `archivisio/c4_modelizer`. This is the Quiet Grid Labs Community edition.

---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173/editor

Or with Docker:

```bash
docker compose up --build
```

Then open http://localhost:8080

## What you get

- C4 levels 1–4 (system → container → component → code)
- Magic flows: edit, playback, generate PlantUML sequence, validation
- Markdown docs on elements, PlantUML sequences, OpenAPI endpoints, ER on datastores
- Domains as grouping **inside one project**
- Browser persistence (`localStorage`) + JSON import/export
- i18n and dark theme
- Sample starter model on first launch

## Community vs Cloud

| | Community | Cloud |
|---|---|---|
| Local single-user editor | ✓ | ✓ |
| Magic flows / docs / contracts | ✓ | ✓ |
| Realtime collab, orgs, sharing | | ✓ |
| Hosted MCP + tokens | | ✓ |
| Change sets / agent handoff | | ✓ |
| Cross-project domains | | ✓ |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite local editor |
| `npm run build` | Production static build |
| `npm run type-check` | TypeScript |
| `npm run lint` | ESLint |
| `npm run test:node` | Jest unit tests |

## License

[Business Source License 1.1](./LICENSE) (BUSL-1.1). Change license on **2030-09-12**: Apache-2.0.

You may use this for production **except** offering a competing hosted multi-tenant C4 modelling service. See `LICENSE` and `NOTICE`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and discussions welcome once the GitHub repo is public.
