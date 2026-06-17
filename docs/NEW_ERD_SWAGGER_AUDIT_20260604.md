# Current ERD and Swagger Audit

Tanggal audit dokumen: 2026-06-08

Audit ini membandingkan codebase React/Vite saat ini dengan ERD root repo dan Swagger aktif.

## Sumber Aktif

- ERD source: `ERD.mmd`
- ERD viewer: `ERD_VIEW.html`
- Swagger UI: `http://172.16.210.244:8080/swagger/index.html#/`
- Swagger JSON: `http://172.16.210.244:8080/swagger/doc.json`
- Internal app server: `litmas@172.16.210.244`
- Default app URL on internal server: `http://172.16.210.244:5173/`

`GET http://172.16.210.244:8080/swagger/doc.json` returned `200` during this audit.

## ERD Tables

The root ERD currently contains:

- `role`
- `user`
- `usecase`
- `user_usecase`
- `n8n_vector_collections`
- `n8n_vectors`
- `ai_agent`
- `external_data`
- `semantic_search`
- `utility`
- `action`
- `ai_agent_utility`
- `intent`

Important relations:

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

Enums in ERD:

- `action_types`: `semantic_search`, `external_data`, `ai_agent`
- `protocol_requests`: `http_get`, `https_post`, `grpc`

## Swagger Coverage in Frontend

The frontend currently implements these Swagger-backed areas:

- Auth: login, persisted Bearer token, profile load, logout, and unauthorized session handling.
- Intents: full CRUD with `usecase_id` and `action_id` relations.
- Usecases: full CRUD.
- Actions: full CRUD with conditional target relation by `action_type`.
- External Data: full CRUD.
- AI Agents: full CRUD.
- Semantic Search: full CRUD and Action target registry.
- Utilities: list and create only.
- Agent Utilities: create only.
- Roles: admin-only list and create.
- Users: admin-only list, detail, create, update, assign role, delete, and usecase assignment.
- Vector Collections: Upload Knowledge creates native collection rows when needed, uploads original TXT/PDF files, then calls Go backend indexing. Collection Files lists saved native collection rows in a paginated sortable table, displays upload time when available, opens a detail drawer first, then separates original file preview through Open File from explicit Download.

AI Chat is not Swagger CRUD. It posts to AIWO via `/chat-webhook` with `sessionId`, `chatInput`, and numeric `usecaseId`.

## Swagger Endpoint Set

The active Swagger JSON exposes:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET/POST /api/roles`
- `GET/POST /api/usecases`
- `GET/PUT/DELETE /api/usecases/{id}`
- `GET/POST /api/users`
- `GET/PUT/DELETE /api/users/{id}`
- `PUT /api/users/{id}/role`
- Full CRUD for Actions, AI Agents, External Data, Intents, and Semantic Search.
- `GET/POST /api/utilities/`
- `POST /api/ai-agent-utilities/`
- `GET/POST /api/vector-collections`
- `GET /api/vector-collections/{uuid}`
- `POST /api/vector-collections/{uuid}/upload`

The frontend keeps exact runtime paths in `src/api/client.js` because live slash behavior has differed from Swagger for some routes.

## Implementation Alignment

Current codebase matches the ERD/Swagger direction:

- `src/config/resourceOptions.js` uses protocol enum `http_get`, `https_post`, and `grpc`.
- `src/features/intents/config.js` includes required `usecase_id`.
- `src/features/users/config.js` includes `role_id` and `usecase_ids`.
- `src/api/client.js` includes auth, roles, usecases, users, and vector collection helpers.
- `src/features/vector-collections/components/VectorCollectionPanel.jsx` uses the native vector collection API before sending content to Go backend `/vector-webhook`.
- `src/features/vector-collections/metadata.js` parses `cmetadata` defensively for Collection Files display labels and search.
- `src/features/ai-chat/Page.jsx` and the chat store keep chat session state separate from Swagger CRUD.

## Product Decisions to Preserve

- Do not expose public self-register on the login page. User creation belongs in admin-only Users management.
- Keep Semantic Search as the Action-facing registry because `action.semantic_search_id` exists.
- Keep native Vector Collections for inspect/readable original file storage.
- Keep Go backend `/vector-webhook` for chunking/vector indexing.
- Do not add fake pages for `n8n_vectors`; there is no direct read CRUD endpoint for vector chunk rows.
- Do not run write smoke tests against real API/vector endpoints without a cleanup path.

## Remaining Gaps

- Utilities still do not have detail/update/delete endpoints in frontend because Swagger does not expose them.
- Agent Utilities remains create-only because Swagger does not expose list/update/delete.
- `n8n_vectors` remains backend/PGVector-managed and is not directly inspectable as a table from the web UI.
- Write-path testing needs manual approval and cleanup planning because API and PGVector data are real.

