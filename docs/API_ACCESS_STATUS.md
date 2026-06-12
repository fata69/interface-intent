# API Access Status

Tanggal pengecekan: 2026-06-08

Sumber aktif:

- Swagger UI: `http://194.233.79.180:8080/swagger/index.html#/`
- Swagger JSON: `http://194.233.79.180:8080/swagger/doc.json`
- Internal app server: `litmas@172.16.210.244`, default app URL `http://172.16.210.244:5173/`

`GET http://194.233.79.180:8080/swagger/doc.json` berhasil mengembalikan `200` pada audit ini. API data menggunakan Bearer token. Request tanpa token ke endpoint data utama akan dianggap unauthorized.

## Runtime Target

Frontend memakai relative path dan proxy, bukan direct browser call ke backend:

```text
/api/*          -> http://194.233.79.180:8080/api/*
/chat-webhook   -> http://194.233.79.180:8081/api/v1/chat
/intent-sync    -> http://194.233.79.180:8081/api/v1/update
/vector-webhook -> http://127.0.0.1:8082/webhook/update-intent
```

Saat development dan production proxy, biarkan `VITE_API_BASE_URL=` kosong.

## Endpoint Swagger Aktif

Endpoint berikut muncul di Swagger JSON aktif dan sudah dipetakan ke frontend bila fitur UI-nya tersedia.

| Method | Endpoint |
| --- | --- |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/register` |
| `GET` | `/api/auth/me` |
| `GET`, `POST` | `/api/roles` |
| `GET`, `POST` | `/api/usecases` |
| `GET`, `PUT`, `DELETE` | `/api/usecases/{id}` |
| `GET`, `POST` | `/api/users` |
| `GET`, `PUT`, `DELETE` | `/api/users/{id}` |
| `PUT` | `/api/users/{id}/role` |
| `GET`, `POST` | `/api/actions/` |
| `GET`, `PUT`, `DELETE` | `/api/actions/{id}` |
| `GET`, `POST` | `/api/ai-agents/` |
| `GET`, `PUT`, `DELETE` | `/api/ai-agents/{id}` |
| `POST` | `/api/ai-agent-utilities/` |
| `GET`, `POST` | `/api/external-data/` |
| `GET`, `PUT`, `DELETE` | `/api/external-data/{id}` |
| `GET`, `POST` | `/api/intents/` |
| `GET`, `PUT`, `DELETE` | `/api/intents/{id}` |
| `GET`, `POST` | `/api/semantic-searches/` |
| `GET`, `PUT`, `DELETE` | `/api/semantic-searches/{id}` |
| `GET`, `POST` | `/api/utilities/` |
| `GET`, `POST` | `/api/vector-collections` |
| `GET` | `/api/vector-collections/{uuid}` |
| `POST` | `/api/vector-collections/{uuid}/upload` |

## Frontend Endpoint Map

`src/api/client.js` currently uses these runtime paths:

| Resource | Frontend path | Capability |
| --- | --- | --- |
| Auth login | `/api/auth/login` | Login |
| Auth profile | `/api/auth/me` | Profile load |
| Actions | `/api/actions/` | List, detail, create, update, delete |
| AI Agents | `/api/ai-agents/` | List, detail, create, update, delete |
| External Data | `/api/external-data/` | List, detail, create, update, delete |
| Intents | `/api/intents/` | List, detail, create, update, delete |
| Usecases | `/api/usecases/` | List, detail, create, update, delete |
| Users | `/api/users/` | List, detail, create, update, delete |
| Roles | `/api/roles/` | List and create |
| Semantic Search | `/api/semantic-searches/` | List, detail, create, update, delete |
| Utilities | `/api/utilities` | List and create |
| Agent Utilities | `/api/ai-agent-utilities/` | Create only |
| Vector Collections | `/api/vector-collections` | List saved collection rows, create row, upload original file, stream original file by UUID |

Runtime slash behavior has previously differed from Swagger for `roles`, `usecases`, `users`, `utilities`, and `vector-collections`. Keep `src/api/client.js` on the known working paths unless a new live probe proves a change is safe.

## Non-Swagger Endpoints Used by UI

| Method | Frontend path | Target | UI status |
| --- | --- | --- | --- |
| `POST` | `/chat-webhook` | AIWO chat service | Exposed by AI Chat |
| `POST` | `/intent-sync` | AIWO intent cache reload | Exposed by Intents sync button |
| `POST` | `/vector-webhook` | Go Vector Knowledge backend | Exposed by Vector Collections > Upload Knowledge for text/PDF indexing |
| `PUT` | `/vector-webhook` | Go Vector Knowledge backend | Backend-compatible sync path; hidden from UI to avoid duplicate vector rows |

Do not run write smoke tests against `/vector-webhook` without a cleanup path. If a test write is unavoidable, use `docs/VECTOR_TEST_CLEANUP.md` as the cleanup reference.

## Known Unsupported Swagger CRUD

These operations are still not available as complete CRUD in Swagger/API and should stay disabled in UI:

- `GET`, `PUT`, `DELETE` for `/api/ai-agent-utilities/`.
- Detail, update, and delete endpoints for Utilities.
- Direct CRUD for `n8n_vectors`.

Vector collection read/list/file upload is available through `/api/vector-collections`. Collection Files shows saved files in a paginated sortable table, displays upload time when the backend provides a timestamp, opens a frontend detail drawer before the original file is opened, and separates preview from explicit download. Vector chunk rows remain managed by n8n/PGVector rather than a frontend CRUD page.

## Frontend Behavior Notes

- There is no mock data.
- `normalizeList()` and `normalizeRecord()` support API wrappers such as `{ data: [...] }` and `{ data: {...} }`.
- All authenticated `/api/*` requests send `Authorization: Bearer <token>` after login.
- A `401` response triggers unauthorized session handling and returns the user to login.
- Some detail endpoints can return `404` for rows present in list responses; view/edit flows should fall back to the list row instead of blocking the user.
