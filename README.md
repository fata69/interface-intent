# Intent & Agent Management Console

Operational dashboard for managing chatbot intents, actions, agents, usecases, semantic search collections, vector knowledge, users, roles, and AI chat workflows.

The app is built around a Swagger-backed API and an ERD-driven resource model. It intentionally does not ship mock data: empty states mean the connected API returned no data, failed, or the endpoint is unavailable.

## Highlights

- Swagger-backed CRUD pages for chatbot configuration resources.
- Authenticated dashboard with persisted session handling and automatic unauthorized logout.
- Conditional Action configuration for external data, AI agents, and semantic search targets.
- Admin-only user, role, and usecase assignment workflows.
- Vector Collections workflow for original TXT/PDF uploads plus vector indexing.
- AI Chat screen that sends real messages to the configured chat engine.
- Local Go Vector Knowledge backend for chunking, embedding, and PGVector indexing.

## Tech Stack

- React `^19.2.6`
- Vite `^8.0.16`
- React Router `^7.16.0`
- Zustand `^5.0.14`
- Lucide React `^1.16.0`
- Go backend for vector knowledge processing

## Quick Start

Install dependencies:

```bash
nvm install
nvm use
npm install
```

Run the dashboard:

```bash
npm run dev
```

Validate a production build:

```bash
npm run build
```

Run the lightweight test command:

```bash
npm test
```

`npm test` currently runs the Vite production build.

## Configuration

Local development and internal deployment are designed to use relative browser paths such as `/api`, `/chat-webhook`, `/intent-sync`, and `/vector-webhook`. Keep `VITE_API_BASE_URL` empty when a Vite or production proxy is handling those routes:

```env
VITE_API_BASE_URL=
```

Runtime targets belong in environment files or deployment configuration, not in source code. Use the example files as templates:

```text
.env.example
.env.production.example
backend/.env.example
```

Do not commit real `.env` files, database credentials, API keys, exported tokens, or local workflow credentials.

## Project Structure

```text
src/App.jsx                              Application shell and page router
src/api/client.js                        Endpoint map and request helpers
src/config/resources.js                  Feature registry, routes, and navigation groups
src/config/resourceOptions.js            Shared enum options and relation maps
src/features/<feature-name>/             Feature-owned dashboard pages
src/templates/components/                Shared UI building blocks
src/templates/hooks/useResourceCrud.js   Shared Swagger-backed CRUD behavior
src/utils/resourceUtils.jsx              Labels, validation, transforms, and table rendering
backend/                                 Go Vector Knowledge backend
docs/                                    Project documentation and API notes
server-setup/                            Internal deployment helpers and production server
```

Each sidebar page lives in its own feature folder. For a new CRUD-backed page, add `src/features/<feature-name>/Page.jsx`, add `config.js`, register it in `src/config/resources.js`, and export it through `src/features/index.js`.

## Implemented Modules

- Auth
- Intents
- Usecases
- Actions
- External Data
- AI Agents
- Agent Utilities
- Semantic Search
- Utilities
- Roles
- Users
- Vector Collections
- AI Chat

## Vector Knowledge Flow

Semantic Search and native Vector Collections intentionally work together:

1. Semantic Search stores the Action-facing `collection_name` registry.
2. Upload Knowledge selects that collection target.
3. The dashboard creates or reuses the matching native vector collection row.
4. The original TXT/PDF is uploaded for file inspection and retrieval.
5. The same content is sent to the Go backend for chunking, embedding, and vector indexing.

The ERD does not define a foreign key between `semantic_search.collection_name` and the vector collection name. The UI keeps them aligned by using the same collection name across both workflows.

## Backend

The Go backend under `backend/` handles vector knowledge indexing:

- request validation
- PDF text extraction
- chunking
- embedding calls
- PGVector writes
- optional auth-token validation through the main API

See [backend/README.md](backend/README.md) for backend setup, environment variables, endpoints, and build commands.

## API Notes

The frontend is driven by the active Swagger API and uses authenticated requests after login. Unsupported backend endpoints should remain disabled in the UI; do not add fake client-side data for unavailable resources.

Primary covered resource groups:

```text
Auth
Roles
Usecases
Users
Actions
AI Agents
Agent Utilities
External Data
Intents
Semantic Search
Utilities
Vector Collections
AI Chat webhook workflow
```

Detailed API notes live in:

- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- [docs/API_ACCESS_STATUS.md](docs/API_ACCESS_STATUS.md)
- [docs/NEW_ERD_SWAGGER_AUDIT_20260604.md](docs/NEW_ERD_SWAGGER_AUDIT_20260604.md)

## Development Rules

- Keep page logic out of `src/App.jsx`.
- Keep feature-specific fields, columns, labels, and descriptions in each feature config.
- Use real API relations for foreign-key dropdowns.
- Keep JSON-like fields as validated JSON text when the Swagger schema expects strings.
- Keep unsupported endpoint actions disabled instead of inventing mock behavior.
- Keep deployment-specific notes in `server-setup/`.

## Deployment

Production deployment uses a built `dist` directory plus either:

- `server-setup/prod-server.mjs` for static serving and proxying, or
- the Nginx example in `server-setup/nginx-interface-intent.conf`.

Detailed deployment commands, PM2 notes, proxy targets, and server-specific paths are documented in [server-setup/README.md](server-setup/README.md). Treat that folder as internal operational documentation if this repository is public.

## Documentation

- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - endpoint payloads and API notes.
- [docs/API_ACCESS_STATUS.md](docs/API_ACCESS_STATUS.md) - endpoint availability audit.
- [docs/NEW_ERD_SWAGGER_AUDIT_20260604.md](docs/NEW_ERD_SWAGGER_AUDIT_20260604.md) - ERD and Swagger alignment notes.
- [docs/UI_UX_PLAN.md](docs/UI_UX_PLAN.md) - UI/UX status and optional polish.
- [docs/PANDUAN_PENGERJAAN.md](docs/PANDUAN_PENGERJAAN.md) - development guide.
- [docs/VECTOR_TEST_CLEANUP.md](docs/VECTOR_TEST_CLEANUP.md) - cleanup guidance for accidental vector write tests.
- [backend/README.md](backend/README.md) - Go backend setup and endpoint notes.
- [server-setup/README.md](server-setup/README.md) - internal deployment guide.

## Security

- Keep the repository private if it contains internal deployment notes or network topology.
- Keep `.env`, `.env.*`, backend `.env`, exported credentials, local uploads, and Postman exports out of Git.
- Rotate secrets after account or machine compromise, even if no secret is found in Git history.
- Do not run write smoke tests against vector indexing endpoints without a cleanup plan.

## ERD

The ERD is available as:

- [ERD.mmd](ERD.mmd) - Mermaid source.
- [ERD_VIEW.html](ERD_VIEW.html) - browser-viewable Mermaid renderer.
