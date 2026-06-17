# Intent & Agent Management Console

React/Vite dashboard for configuring AI chatbot resources from the active ERD and Swagger API. The repository also contains a local Go Vector Knowledge backend that replaces the old n8n vector indexing workflow. There is no mock data.

## Active Runtime

- Internal app server: `litmas@172.16.210.244`
- Default app URL: `http://172.16.210.244:5173/`
- Swagger UI: `http://172.16.210.244:8080/swagger/index.html#/`
- REST API backend: `http://172.16.210.244:8080`
- AIWO engine/chat/cache: `http://172.16.210.244:8081`
- Vector Knowledge backend: `http://127.0.0.1:8082`
- ERD source: `ERD.mmd` and `ERD_VIEW.html` in the repository root

## Stack

- React `^19.2.6`
- Vite `^8.0.14`
- `react-router-dom`
- `zustand`
- `lucide-react`

## Architecture

```text
Browser
  -> React/Vite frontend
  -> /api/... via proxy
  -> http://172.16.210.244:8080/api/...
  -> Existing REST API

Browser
  -> /chat-webhook via proxy
  -> http://172.16.210.244:8081/api/v1/chat
  -> AIWO chat service

Browser
  -> /intent-sync via proxy
  -> http://172.16.210.244:8081/api/v1/update
  -> AIWO intent cache reload

Browser
  -> /vector-webhook via proxy
  -> http://127.0.0.1:8082/webhook/update-intent
  -> Go Vector Knowledge backend
```

This repository does not contain fake local fixtures.

## Frontend Structure

```text
src/App.jsx                              Application shell and page router
src/features/<feature-name>/             Sidebar page feature folders
src/features/*/config.js                 Feature-specific resource config
src/features/*/Page.jsx                  Feature page entry point
src/features/auth/                       Login and auth store
src/features/ai-chat/                    AI Chat webhook workflow
src/features/vector-collections/         Vector collection upload and file browsing workflows
src/templates/hooks/useResourceCrud.js   Shared CRUD behavior
src/templates/components/                Shared layout, form, modal, drawer, table, toolbar, sidebar pieces
src/config/resources.js                  Feature registry, route map, and nav grouping
src/config/resourceOptions.js            Shared enum and relation maps
src/utils/resourceUtils.jsx              Labels, validation, payload transforms, table values
src/api/client.js                        REST endpoint map and request helper
```

Each sidebar page is a feature. New CRUD features should get a folder under `src/features/`, define `Page.jsx` and `config.js`, then be registered through `src/config/resources.js` and `src/features/index.js`.

Navigation uses `react-router-dom` with clean routes such as `/intents`, `/usecases`, `/actions`, `/semantic-search`, `/vector-collections/upload`, `/vector-collections/files`, `/users`, and `/chat`. The production server falls back to `index.html`, so direct refresh on those routes is supported.

## Development

Install dependencies:

```bash
nvm install
nvm use
npm install
```

Run the development server:

```bash
npm run dev
```

Vite runs on `0.0.0.0:5173`. Share the Network URL printed by Vite, not `localhost` or `127.0.0.1`.

Build for validation:

```bash
npm run build
```

Run the lightweight test command:

```bash
npm test
```

`npm test` currently runs `vite build`.

## Production on Internal Server

Recommended deployment uses `server-setup/prod-server.mjs`. It serves `dist` and proxies `/api`, `/chat-webhook`, `/intent-sync`, and `/vector-webhook`.

Push changes from local development first:

```bash
git status
git add .
git commit -m "Update dashboard"
git push origin main
```

Then pull and deploy on the internal server. The server default Node can be v18, so run `nvm use` first and confirm Node 22 before npm/build/PM2 commands:

```bash
ssh litmas@172.16.210.244
cd ~/interface-intent/interface-intent-migrate
nvm use
node -v
git pull origin main
npm ci
npm run build
pm2 restart interface-intent --update-env
```

Runtime defaults:

```text
App URL:           http://172.16.210.244:5173/
REST API proxy:    /api -> http://172.16.210.244:8080
AIWO chat:         /chat-webhook -> http://172.16.210.244:8081/api/v1/chat
Intent sync:       /intent-sync -> http://172.16.210.244:8081/api/v1/update
Vector webhook:    /vector-webhook -> http://127.0.0.1:8082/webhook/update-intent
```

Detailed server notes live in `server-setup/README.md`.

## API Configuration

During local development and internal deployment, keep `VITE_API_BASE_URL` empty so browser requests use relative paths and the proxy handles CORS:

```env
VITE_API_BASE_URL=
```

Auth uses `POST /api/auth/login`, stores the Bearer token, loads profile from `GET /api/auth/me`, and sends `Authorization: Bearer <token>` for API requests. A `401` response resets the session.

## Implemented Modules

- Auth: login, persisted Bearer token, profile load, logout, and unauthorized session handling.
- Intents: list, detail, create, update, delete, including `usecase_id` and `action_id` relations.
- Usecases: list, detail, create, update, delete.
- Actions: list, detail, create, update, delete, with conditional target relation by `action_type`.
- External Data: list, detail, create, update, delete.
- AI Agents: list, detail, create, update, delete.
- Semantic Search: list, detail, create, update, delete; remains Action target registry.
- Utilities: list and create.
- Agent Utilities: create mapping only.
- Roles: admin-only list and create.
- Users: admin-only list, detail, create, update, assign role, delete, and usecase assignment.
- Vector Collections: split into Upload Knowledge and Collection Files. Upload Knowledge selects a collection target, creates a native row when needed, uploads the original TXT/PDF file, and sends content to the Go Vector Knowledge backend for indexing. Collection Files lists saved collection files in a paginated sortable table with upload time when the backend provides it, opens a detail drawer first, then separates original file preview through Open File from explicit Download.
- AI Chat: sends real messages to AIWO through `/chat-webhook`, with a selected `usecaseId`.

## Vector Collections Flow

Semantic Search and native Vector Collections intentionally work together:

1. Semantic Search stores the Action-facing `collection_name` registry.
2. Upload Knowledge uses that name to find or create a native `/api/vector-collections` row.
3. The app uploads the original TXT/PDF to `/api/vector-collections/{uuid}/upload`.
4. The app posts the same content to `/vector-webhook` so the Go backend performs chunking/vector indexing.
5. Collection Files lists saved native Vector Collection rows, opens a detail drawer before any original file is opened, and keeps Download as a separate explicit action.

`semantic_search.collection_name` and `n8n_vector_collections.name` have no FK in the ERD. The UI keeps them aligned by using the same name.

Vector Collection file labels are parsed defensively from `cmetadata`. The frontend tolerates plain path strings, JSON objects, and JSON arrays so future backend metadata formats can still be displayed as readable file labels.

## API Coverage

Latest Swagger source checked:

```text
http://172.16.210.244:8080/swagger/doc.json
```

Covered by frontend:

```text
POST           /api/auth/login
GET            /api/auth/me
GET/POST       /api/roles
GET/POST       /api/usecases
GET/PUT/DELETE /api/usecases/{id}
GET/POST       /api/users
GET/PUT/DELETE /api/users/{id}
PUT            /api/users/{id}/role
GET/POST       /api/actions/
GET/PUT/DELETE /api/actions/{id}
GET/POST       /api/ai-agents/
GET/PUT/DELETE /api/ai-agents/{id}
POST           /api/ai-agent-utilities/
GET/POST       /api/external-data/
GET/PUT/DELETE /api/external-data/{id}
GET/POST       /api/intents/
GET/PUT/DELETE /api/intents/{id}
GET/POST       /api/semantic-searches/
GET/PUT/DELETE /api/semantic-searches/{id}
GET/POST       /api/utilities/
GET/POST       /api/vector-collections
GET            /api/vector-collections/{uuid}
POST           /api/vector-collections/{uuid}/upload
```

Unsupported or partial:

```text
GET/PUT/DELETE /api/ai-agent-utilities/
GET/PUT/DELETE /api/utilities/{id}
Direct CRUD for n8n_vectors
```

Do not add fake client-side data for unsupported endpoints.

## Documentation

Project documentation lives in `docs/`:

- `docs/API_REFERENCE.md` - endpoint payloads and API notes.
- `docs/API_ACCESS_STATUS.md` - latest endpoint availability audit.
- `docs/NEW_ERD_SWAGGER_AUDIT_20260604.md` - current ERD and Swagger alignment notes.
- `docs/UI_UX_PLAN.md` - implemented UI/UX status and remaining optional polish.
- `docs/PANDUAN_PENGERJAAN.md` - development guide.
- `docs/VECTOR_TEST_CLEANUP.md` - cleanup note for accidental vector write tests.
- `backend/README.md` - Go Vector Knowledge backend setup and endpoint notes.

Root-level contributor instructions are in `AGENTS.md`. Production deployment files and server notes live in `server-setup/`.

## ERD

The latest ERD is available as:

- `ERD.mmd` - Mermaid source.
- `ERD_VIEW.html` - browser-viewable Mermaid renderer.

When the dev server is running, open the viewer from the Vite URL, for example:

```text
http://172.16.210.244:5173/ERD_VIEW.html
```
