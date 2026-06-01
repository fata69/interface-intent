# Repository Guidelines

## Project Structure & Module Organization

This repository contains a React/Vite dashboard for configuring an AI chatbot system based on the provided ERD and local Swagger API.

- `src/App.jsx` is only the application shell/router. Do not move page logic back into this file.
- `src/config/resources.js` registers feature configs and defines sidebar grouping.
- `src/features/<feature-name>/` maps to sidebar pages/features. Each feature owns its page entry and config, for example `src/features/actions/Page.jsx`, `src/features/actions/config.js`, and `src/features/ai-chat/Page.jsx`.
- `src/config/resourceOptions.js` contains shared enum options, action target maps, and relation column maps.
- `src/templates/hooks/useResourceCrud.js` contains shared CRUD behavior for Swagger-backed feature pages.
- `src/templates/components/` contains shared building blocks such as layout, modal, drawer, form, table, toolbar, sidebar, and unavailable-state components.
- `src/utils/resourceUtils.jsx` contains resource labels, payload preparation, validation, and table value rendering.
- `src/api/client.js` contains the API endpoint map and request helpers. Update this file first when Swagger changes.
- `src/styles.css` contains the dashboard layout and component styling.
- `vite.config.js` proxies frontend `/api/*` requests to `http://172.16.210.244:8080`, `/chat-webhook` to the n8n chat webhook, and `/vector-webhook` to the n8n VectorDB workflow.
- `server-setup/` contains internal production deployment notes, a Node static/proxy server, and an optional Nginx config. Keep deployment-specific docs there.
- `docs/UI_UX_PLAN.md` tracks implemented UI/UX improvements and remaining optional polish.
- Keep future Markdown documentation in `docs/`; leave only `AGENTS.md` at the repository root.
- `docs/API_REFERENCE.md` documents payloads and Swagger-derived endpoint notes.
- `docs/API_ACCESS_STATUS.md` documents which endpoints were reachable and which ERD resources are not exposed by Swagger.

There is intentionally no mock data. Empty states mean the API returned no data, failed, or the endpoint is unavailable.

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
- Intents: list, detail-on-edit, create, update, delete.
- External Data: list, detail-on-edit, create, update, delete.
- Semantic Search: list, detail-on-edit, create, update, delete.
- Vector Collections: register new collection names through `/api/semantic-searches/`, choose a Semantic Search collection, then `POST` text, `POST` PDF, or `PUT` sync to n8n via `/vector-webhook`.
- Utilities: list and create only, matching Swagger.
- Agent Utilities: create only, matching Swagger.
- `n8n_vector_collections` and `n8n_vectors`: managed by the Vector Collections page through n8n PGVector until direct read endpoints exist.
- AI Chat: sends real messages to the n8n webhook through `/chat-webhook`; it is not part of Swagger. The payload includes `collection_name` from the selected Semantic Search record so webhook collection naming stays aligned with `/api/semantic-searches/`.

ERD note: `semantic_search.collection_name` and `n8n_vector_collections.name` are separate columns with no FK in the ERD. The UI keeps them aligned by using the same name: register the Semantic Search row first, then send that `collection_name` to n8n so PGVector uses the matching `n8n_vector_collections.name`.

## API Usage Status

Live Swagger checked at `http://172.16.210.244:8080/swagger/doc.json`.

Fully utilized Swagger endpoints:

- `/api/actions/` and `/api/actions/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/ai-agents/` and `/api/ai-agents/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/external-data/` and `/api/external-data/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/intents/` and `/api/intents/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/semantic-searches/` and `/api/semantic-searches/{id}`: `GET`, `POST`, `PUT`, `DELETE` as exposed.
- `/api/utilities/`: `GET` and `POST`.
- `/api/ai-agent-utilities/`: `POST`.

Additional non-Swagger endpoint used by the UI:

- `/chat-webhook`: `POST`, proxied to `http://172.16.210.244:5678/webhook/eb70bb74-2714-4d79-b447-de3e7cd683cb/chat`.
- `/vector-webhook`: `POST` and `PUT`, proxied to `http://172.16.210.244:5678/webhook/update-intent`. `POST` supports text JSON and PDF multipart upload; `PUT` inserts/syncs Intent/Action data by `collection_name`. The n8n workflow creates or uses the target collection when data is inserted. Do not run write smoke tests without a cleanup path because POST inserts rows into PGVector.

Endpoints not present in Swagger / not available:

- `GET`, `PUT`, `DELETE` for `/api/ai-agent-utilities/`.
- Detail, update, and delete endpoints for `/api/utilities/`.
- Any CRUD endpoints for `n8n_vector_collections`.
- Any CRUD endpoints for `n8n_vectors`.

Do not add fake client-side data for unavailable endpoints. Disable unsupported actions and show a clear unavailable state.

For `/vector-webhook` testing, avoid real write tests unless a cleanup endpoint or database credential is available. If a test row is inserted into `n8n_vectors`, delete it by exact test text from the PGVector database before handoff. Existing smoke-test cleanup SQL is documented in `docs/VECTOR_TEST_CLEANUP.md`.

## Coding Style & Naming Conventions

Use React functional components and hooks. Keep module resource keys stable because they connect UI definitions to `src/api/client.js`: `chat`, `vectorCollections`, `agents`, `actions`, `intents`, `externalData`, `semanticSearches`, `utilities`, and `mappings`.

Keep pages feature-based. Add or change resource fields in the matching `src/features/<feature-name>/config.js` file and register it through `src/config/resources.js`. Each sidebar feature must have a `Page.jsx` that owns its layout and may call shared hooks/components from `src/templates/`. Avoid adding unrelated page state, modal logic, or table logic to `App.jsx`.

Use descriptive field names matching API payloads, such as `agent_name`, `action_type`, `semantic_search_id`, and `collection_name`. JSON-like fields should be validated with `JSON.parse` before submit. For VectorDB uploads, register/select `collection_name` from Semantic Search first, then send that same value to n8n; keep multipart field name `file` for PDF uploads.

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

Sidebar navigation should stay grouped as a collapsible sub-sidebar. `AI-Configuration` contains Intents, Actions, External Data, AI Agents, Agent Utilities, Semantic Search, Utilities, Vector Collections, and AI Chat. Do not add a separate empty Vectors CRUD page until real read endpoints exist. Do not add another nested level under Semantic Search unless explicitly requested.

## Testing Guidelines

Before handing off changes, run:

```bash
npm run build
```

For API-related changes, verify Swagger live again and update `docs/API_ACCESS_STATUS.md` if endpoint availability changes. For UI/UX planning changes, update `docs/UI_UX_PLAN.md`.

## Security & Configuration Tips

Keep `.env` out of git. During local development, leave `VITE_API_BASE_URL` empty so the app uses the Vite proxy. If deploying without Vite proxy, set `VITE_API_BASE_URL` to the real API base URL and handle CORS on the server.

For internal production, prefer `npm run build` plus `npm start` or the Nginx config in `server-setup/`. Keep `VITE_API_BASE_URL=` empty in production when using the provided proxy server so browser requests stay relative to the app host.



