# Repository Guidelines

## Project Structure & Module Organization

This repository contains a React/Vite dashboard for configuring an AI chatbot system based on the root ERD and the active Swagger API.

- `src/App.jsx` is only the application shell/router. Do not move page logic back into this file.
- `src/config/resources.js` registers feature configs and defines sidebar grouping.
- `src/features/<feature-name>/` maps to sidebar pages/features. Each feature owns its page entry and config, for example `src/features/actions/Page.jsx`, `src/features/actions/config.js`, and `src/features/ai-chat/Page.jsx`.
- `src/config/resourceOptions.js` contains shared enum options, action target maps, and relation column maps.
- `src/templates/hooks/useResourceCrud.js` contains shared CRUD behavior for Swagger-backed feature pages.
- `src/templates/components/` contains shared building blocks such as layout, modal, drawer, form, table, toolbar, sidebar, and unavailable-state components.
- `src/utils/resourceUtils.jsx` contains resource labels, payload preparation, validation, and table value rendering.
- `src/api/client.js` contains the API endpoint map and request helpers. Update this file first when Swagger changes.
- `src/styles.css` contains the dashboard layout and component styling.
- `vite.config.js` proxies frontend `/api/*` requests to the active Swagger API target, `/chat-webhook` to the n8n chat webhook, and `/vector-webhook` to the n8n VectorDB workflow.
- `server-setup/` contains internal production deployment notes, a Node static/proxy server, and an optional Nginx config. Keep deployment-specific docs there.
- `docs/UI_UX_PLAN.md` tracks implemented UI/UX improvements and remaining optional polish.
- Keep future Markdown documentation in `docs/`; leave only `AGENTS.md` at the repository root.
- `docs/API_REFERENCE.md` documents payloads and Swagger-derived endpoint notes.
- `docs/API_ACCESS_STATUS.md` documents which endpoints were reachable and which ERD resources are not exposed by Swagger.
- `docs/NEW_ERD_SWAGGER_AUDIT_20260604.md` documents the new ERD and Swagger audit for `http://194.233.79.180:8080`.

There is intentionally no mock data. Empty states mean the API returned no data, failed, or the endpoint is unavailable.

## Current Migration Memory

Latest ERD and Swagger audit date: 2026-06-08. The current ERD source is `ERD.mmd` in the repository root, with `ERD_VIEW.html` as the browser-viewable renderer.

Active Swagger/API target is `http://194.233.79.180:8080`. The internal app server runs as `litmas@172.16.210.244`, usually serving the app at `http://172.16.210.244:5173/`.

The active API is reachable, and GET requests to the main data endpoints return `401 Unauthorized` without a Bearer token. Auth foundation and `/api` proxy defaults are already implemented for `http://194.233.79.180:8080`.

New Swagger adds auth, roles, usecases, and user-management endpoints: `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, `GET /api/roles`, `POST /api/roles`, `GET/POST /api/usecases`, `GET/PUT/DELETE /api/usecases/{id}`, `GET/POST /api/users`, `GET/PUT/DELETE /api/users/{id}`, and `PUT /api/users/{id}/role`.

Auth test on 2026-06-05 confirmed `POST /api/auth/login` returns `{ message, token, user }`. Use `Authorization: Bearer <token>` for authenticated API calls. Do not store test credentials in repository files.

New API list responses use `{ data: [...] }` wrappers. Current `normalizeList()` and `normalizeRecord()` already support this shape.

Runtime path caveat for the new API: some live routes differ from Swagger trailing slashes. Authenticated reads worked with `/api/roles/`, `/api/utilities`, and `/api/vector-collections`. The variants `/api/roles`, `/api/utilities/`, and `/api/vector-collections/` returned `401` during testing, so use exact known-good paths when updating `src/api/client.js`.

The new ERD adds tables `user`, `role`, `usecase`, and `user_usecase`. It also updates `intent` with `usecase_id`. Runtime probes on 2026-06-05 confirmed authenticated reads for `/api/usecases/` and `/api/users/` now return `200`, so the frontend can populate Intent `usecase_id` from the Usecases API and expose admin-only user management.

New ERD relations to remember:

- `role.id -> user.role_id`
- `user.id -> user_usecase.user_id`
- `usecase.id -> user_usecase.usecase_id`
- `usecase.id -> intent.usecase_id`
- `n8n_vector_collections.uuid -> n8n_vectors.collection_id`
- `semantic_search.id -> action.semantic_search_id`
- `external_data.id -> action.external_data_id`
- `ai_agent.id -> action.ai_agent_id`
- `action.id -> intent.action_id`
- `ai_agent.id -> ai_agent_utility.ai_agent_id`
- `utility.id -> ai_agent_utility.utility_id`

New Swagger/ERD protocol enum is `http_get`, `https_post`, and `grpc`. Keep frontend protocol options aligned with this enum before writing `AI Agents` or `External Data` to the new API.

New Swagger defines JSON-like fields as strings: `parameter_needed`, `header`, `default_param`, and `cmetadata`. Current frontend behavior of validating JSON text but sending string values matches this Swagger shape.

Register caveat: `POST /api/auth/register` can create a user without Bearer token, and a probe without `role_id` created a test user with `role_id: null`. Do not expose public self-register on the login page. For the dashboard UI, prefer the admin-only Users page with `POST /api/users` because it supports role and usecase assignment in one clear flow.

Vector Collections migration decision:

- Swagger `/api/vector-collections` is used to read/list/inspect collections and to create a native vector collection row when a selected Semantic Search collection does not yet exist there.
- Swagger `GET /api/vector-collections/{uuid}` is used to view/download the original uploaded file stored from `cmetadata`.
- Swagger `POST /api/vector-collections/{uuid}/upload` is used to upload the original TXT/PDF file so knowledge can be viewed as a coherent file, not only as vector chunks.
- The n8n `/vector-webhook` upload still runs after the Swagger upload so the existing chunking/vector indexing workflow and AI search behavior remain intact.
- Keep Semantic Search as the Action target registry because `action.semantic_search_id` still exists in the new ERD/Swagger.

AI Chat remains separate from Swagger CRUD. It sends messages to n8n through `/chat-webhook` with `chatInput`, `message`, and `sessionId`. The n8n workflow decides collection routing from prompt/chat logic.

## Build, Test, and Development Commands

- `npm install` installs dependencies.
- `nvm install && nvm use` selects the project Node version from `.nvmrc` without changing the server/global Node installation.
- `npm run dev` starts Vite on `0.0.0.0:5173`, so teammates on the same WiFi can open the Network URL.
- `npm run build` verifies the production bundle.
- `npm start` serves the production `dist` build through `server-setup/prod-server.mjs` and proxies `/api`, `/chat-webhook`, and `/vector-webhook`.
- `npm test` currently runs `vite build` as a lightweight validation step.

Share the WiFi URL shown by Vite, for example `http://192.168.77.163:5173/`; do not share `localhost` or `127.0.0.1`.

## Implemented Product Scope

The web app currently implements these ERD modules:

- AI Agents: list, detail-on-edit, create, update, delete.
- Actions: list, detail-on-edit, create, update, delete.
- Auth: login, persisted Bearer token, profile load, logout, and unauthorized session handling.
- Intents: list, detail-on-edit, create, update, delete, including `usecase_id` relation.
- Usecases: list, detail-on-edit, create, update, delete.
- Roles: admin-only list and create, used by User Management role assignment.
- Users: admin-only list, detail-on-edit, create, update, assign role, delete with role and usecase assignment fields.
- External Data: list, detail-on-edit, create, update, delete.
- Semantic Search: list, detail-on-edit, create, update, delete.
- Vector Collections: read/list Swagger vector collections for inspection, choose an existing Semantic Search collection, then `POST` text or `POST` PDF to n8n via `/vector-webhook`. Create collection names from the Semantic Search page.
- Utilities: list and create only, matching Swagger.
- Agent Utilities: create only, matching Swagger.
- `n8n_vector_collections` and `n8n_vectors`: managed by the Vector Collections page through n8n PGVector until direct read endpoints exist.
- AI Chat: sends real messages to the n8n webhook through `/chat-webhook`; it is not part of Swagger. The payload includes `chatInput`, `message`, and `sessionId`; the n8n workflow decides which collection to use from prompt/chat logic.

ERD note: `semantic_search.collection_name` and `n8n_vector_collections.name` are separate columns with no FK in the ERD. The UI keeps them aligned by using the same name: register the Semantic Search row first, then send that `collection_name` to n8n so PGVector uses the matching `n8n_vector_collections.name`.

## API Usage Status

Active Swagger/current code default was checked at `http://194.233.79.180:8080/swagger/doc.json`. Do not use the internal app server host as the API target; `172.16.210.244` is for serving the frontend app.

Active Swagger was checked on 2026-06-08 at `http://194.233.79.180:8080/swagger/doc.json`. The API is authenticated; unauthenticated GET requests to data endpoints return `401 Unauthorized`, and the frontend already handles login/Bearer token requests.

Fully utilized Swagger endpoints:

- `/api/actions/` and `/api/actions/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/ai-agents/` and `/api/ai-agents/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/external-data/` and `/api/external-data/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/intents/` and `/api/intents/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/usecases/` and `/api/usecases/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/users/` and `/api/users/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed, admin-only in UI.
- `/api/roles/`: `GET` and `POST` as exposed; used by user-management relations.
- `/api/semantic-searches/` and `/api/semantic-searches/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/utilities`: `GET` and `POST`.
- `/api/ai-agent-utilities/`: `POST`.

Additional non-Swagger endpoint used by the UI:

- `/chat-webhook`: `POST`, proxied to public n8n `http://103.140.90.131:5678/webhook/eb70bb74-2714-4d79-b447-de3e7cd683cb/chat`.
- `/vector-webhook`: `POST` and `PUT`, proxied to public n8n `http://103.140.90.131:5678/webhook/update-intent`. UI exposes only `POST` text JSON and PDF multipart upload; `PUT` sync remains a documented n8n endpoint but is hidden from UI because it can duplicate Intent/Action vectors. Do not run write smoke tests without a cleanup path because POST inserts rows into PGVector.

Endpoints not present in Swagger / not available:

- `GET`, `PUT`, `DELETE` for `/api/ai-agent-utilities/`.
- Detail, update, and delete endpoints for `/api/utilities/`.
- Any CRUD endpoints for `n8n_vector_collections`.
- Any CRUD endpoints for `n8n_vectors`.

Migration caveat: the new Swagger at `194.233.79.180:8080` exposes `/api/vector-collections` for read/list/inspect, native collection creation, original file upload, and file view/download. Text/PDF knowledge upload still also posts to public n8n `/vector-webhook` for vector indexing.

Do not add fake client-side data for unavailable endpoints. Disable unsupported actions and show a clear unavailable state.

For `/vector-webhook` testing, avoid real write tests unless a cleanup endpoint or database credential is available. If a test row is inserted into `n8n_vectors`, delete it by exact test text from the PGVector database before handoff. Existing smoke-test cleanup SQL is documented in `docs/VECTOR_TEST_CLEANUP.md`.

Some Swagger detail endpoints can return 404 for rows that are present in list endpoints. View/Edit flows should fall back to the list row instead of blocking the user.

## Coding Style & Naming Conventions

Use React functional components and hooks. Keep module resource keys stable because they connect UI definitions to `src/api/client.js`: `chat`, `vectorCollections`, `agents`, `actions`, `intents`, `externalData`, `semanticSearches`, `utilities`, and `mappings`.

Keep pages feature-based. Add or change resource fields in the matching `src/features/<feature-name>/config.js` file and register it through `src/config/resources.js`. Each sidebar feature must have a `Page.jsx` that owns its layout and may call shared hooks/components from `src/templates/`. Avoid adding unrelated page state, modal logic, or table logic to `App.jsx`.

Use descriptive field names matching API payloads, such as `agent_name`, `action_type`, `semantic_search_id`, and `collection_name`. JSON-like fields should be validated with `JSON.parse` before submit. For VectorDB uploads, create/select `collection_name` from Semantic Search first, then send that same value to n8n; keep multipart field name `file` for PDF uploads.

## Feature Development Pattern

Treat every sidebar page as a feature folder. A standard feature should look like this:

```text
src/features/<feature-name>/
  Page.jsx      # page layout owned by the feature
  config.js     # title, fields, columns, icon, unavailable messages
  components/   # optional feature-only components
```

Use this decision rule:

- Change form fields, table columns, labels, or descriptions in `src/features/<feature-name>/config.js`.
- Change a page-specific layout, button position, toolbar arrangement, or special section in `src/features/<feature-name>/Page.jsx`.
- Add feature-only UI pieces under `src/features/<feature-name>/components/`.
- Change behavior shared by all CRUD pages in `src/templates/hooks/useResourceCrud.js`.
- Change shared reusable UI in `src/templates/components/`.
- Change endpoint availability, paths, or HTTP behavior in `src/api/client.js`.
- Register new feature configs in `src/config/resources.js` and new page components in `src/features/index.js`.

Do not turn `src/templates/` into a large all-knowing page template. Templates should stay as small building blocks and hooks. Feature `Page.jsx` files should remain the place where page layout is readable and customizable.

For a new CRUD-backed sidebar page:

1. Create `src/features/<feature-name>/config.js`.
2. Create `src/features/<feature-name>/Page.jsx` using `useResourceCrud`, `PageHeader`, `StatusStrip`, and `ResourceCrudSurface` as needed.
3. Add the endpoint capability in `src/api/client.js`.
4. Register the config in `src/config/resources.js`.
5. Register the page component in `src/features/index.js`.
6. Add the nav item under `navGroups` only if it should appear in the sidebar.

## UI/UX Rules

This is an operational dashboard, not a landing page. Keep the UI focused: sidebar navigation, compact header, status strip, search, table, and modal forms. Do not reintroduce summary card rows unless the user explicitly asks for analytics.

Use `lucide-react` icons. Do not use emoji icons. Foreign key fields must use dropdowns populated from real API data, not free-text numeric inputs. The Action form is conditional by `action_type`; keep non-selected target relation fields cleared before submit. Action labels should stay detailed enough for Intent selection, including id, type, target, and parameter summary.

Sidebar navigation should stay grouped as a collapsible sub-sidebar. `AI-Configuration` contains Intents, Usecases, Actions, External Data, AI Agents, Agent Utilities, Semantic Search, Utilities, Vector Collections, Roles, Users, and AI Chat. Do not add a separate empty Vectors CRUD page until real read endpoints exist. Do not add another nested level under Semantic Search unless explicitly requested.

## Testing Guidelines

Before handing off changes, run:

```bash
npm run build
```

For API-related changes, verify Swagger live again and update `docs/API_ACCESS_STATUS.md` if endpoint availability changes. For UI/UX planning changes, update `docs/UI_UX_PLAN.md`.

## Security & Configuration Tips

Keep `.env` out of git. During local development, leave `VITE_API_BASE_URL` empty so the app uses the Vite proxy. If deploying without Vite proxy, set `VITE_API_BASE_URL` to the real API base URL and handle CORS on the server.

For internal production, prefer `npm run build` plus `npm start` or the Nginx config in `server-setup/`. Keep `VITE_API_BASE_URL=` empty in production when using the provided proxy server so browser requests stay relative to the app host.






