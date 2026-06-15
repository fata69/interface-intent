# API Reference - Intent & Agent Management Console

Sumber aktif: Swagger `http://194.233.79.180:8080/swagger/index.html#/` dan `http://194.233.79.180:8080/swagger/doc.json`.

Base API:

```text
http://194.233.79.180:8080
```

Frontend sebaiknya tetap memakai relative path melalui Vite/prod proxy:

```env
VITE_API_BASE_URL=
```

## Auth

### Login

```text
POST /api/auth/login
```

Payload:

```json
{
  "username": "string",
  "password": "string"
}
```

Response login berisi token dan user. Frontend menyimpan token di auth store dan mengirim header berikut untuk request API berikutnya:

```text
Authorization: Bearer <token>
```

### Profile

```text
GET /api/auth/me
```

Dipakai untuk memuat user aktif setelah token tersedia.

### Register

```text
POST /api/auth/register
```

Endpoint tersedia di Swagger, tetapi tidak diekspos sebagai self-register publik di login page. Dashboard memakai Users page admin-only untuk create user agar role dan usecase assignment jelas.

## Resource Endpoints

### Actions

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/actions/` | List action |
| `POST` | `/api/actions/` | Create action |
| `GET` | `/api/actions/{id}` | Detail action |
| `PUT` | `/api/actions/{id}` | Update action |
| `DELETE` | `/api/actions/{id}` | Delete action |

Payload create/update:

```json
{
  "action_type": "semantic_search",
  "semantic_search_id": 0,
  "external_data_id": 0,
  "ai_agent_id": 0,
  "parameter_needed": "{}"
}
```

`action_type` harus salah satu dari `semantic_search`, `external_data`, atau `ai_agent`. UI hanya menampilkan target relation yang sesuai dan membersihkan relation lain sebelum submit.

### AI Agents

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/ai-agents/` | List AI agent |
| `POST` | `/api/ai-agents/` | Create AI agent |
| `GET` | `/api/ai-agents/{id}` | Detail AI agent |
| `PUT` | `/api/ai-agents/{id}` | Update AI agent |
| `DELETE` | `/api/ai-agents/{id}` | Delete AI agent |

Payload create/update:

```json
{
  "agent_name": "string",
  "protocol_request": "http_get",
  "host": "string",
  "header": "{}",
  "default_param": "{}"
}
```

`protocol_request` options: `http_get`, `https_post`, `grpc`.

### External Data

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/external-data/` | List external data |
| `POST` | `/api/external-data/` | Create external data |
| `GET` | `/api/external-data/{id}` | Detail external data |
| `PUT` | `/api/external-data/{id}` | Update external data |
| `DELETE` | `/api/external-data/{id}` | Delete external data |

Payload create/update:

```json
{
  "protocol_request": "http_get",
  "host": "string",
  "header": "{}",
  "default_param": "{}"
}
```

### Intents

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/intents/` | List intent |
| `POST` | `/api/intents/` | Create intent |
| `GET` | `/api/intents/{id}` | Detail intent |
| `PUT` | `/api/intents/{id}` | Update intent |
| `DELETE` | `/api/intents/{id}` | Delete intent |

Payload create/update:

```json
{
  "usecase_id": 0,
  "context": "string",
  "action_id": 0
}
```

`usecase_id` dan `action_id` memakai dropdown dari data real API.

Relationship rule: one Intent stores exactly one `action_id`, but one Action may be reused by multiple Intents. The frontend therefore keeps all Actions selectable in the Intent form, including Actions already referenced by other Intents. If the API returns `intent_action_id_key`, the live database still has an obsolete unique constraint on `intent.action_id`; drop that constraint so `action_id` remains a normal foreign key.

### Usecases

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/usecases` | List usecase di Swagger; frontend memakai known-good `/api/usecases/` |
| `POST` | `/api/usecases` | Create usecase |
| `GET` | `/api/usecases/{id}` | Detail usecase |
| `PUT` | `/api/usecases/{id}` | Update usecase |
| `DELETE` | `/api/usecases/{id}` | Delete usecase |

Payload create/update:

```json
{
  "name": "string",
  "description": "string"
}
```

### Roles

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/roles` | List role di Swagger; frontend memakai known-good `/api/roles/` |
| `POST` | `/api/roles` | Create role |

Payload create:

```json
{
  "name": "string",
  "description": "string"
}
```

Roles page dan Users page hanya tersedia untuk admin di UI.

### Users

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/users` | List user di Swagger; frontend memakai known-good `/api/users/` |
| `POST` | `/api/users` | Create user |
| `GET` | `/api/users/{id}` | Detail user |
| `PUT` | `/api/users/{id}` | Update user |
| `DELETE` | `/api/users/{id}` | Delete user |
| `PUT` | `/api/users/{id}/role` | Assign role |

Payload form UI:

```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "role_id": 0,
  "usecase_ids": [0]
}
```

During edit, password can be omitted if it is not being changed. Role assignment also calls `/api/users/{id}/role` when needed.

### Semantic Search

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/semantic-searches/` | List semantic search registry |
| `POST` | `/api/semantic-searches/` | Create collection registry |
| `GET` | `/api/semantic-searches/{id}` | Detail registry row |
| `PUT` | `/api/semantic-searches/{id}` | Update registry row |
| `DELETE` | `/api/semantic-searches/{id}` | Delete registry row |

Payload:

```json
{
  "collection_name": "string"
}
```

Semantic Search remains the Action target registry because `action.semantic_search_id` exists in ERD/Swagger.

### Utilities

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/utilities/` | List utility in Swagger; frontend uses known-good `/api/utilities` |
| `POST` | `/api/utilities/` | Create utility |

Payload:

```json
{
  "key": "string",
  "value": "string"
}
```

Swagger does not expose detail/update/delete for Utilities, so those actions stay disabled.

### Agent Utilities

| Method | Path | Fungsi |
| --- | --- | --- |
| `POST` | `/api/ai-agent-utilities/` | Create AI agent to utility mapping |

Payload:

```json
{
  "ai_agent_id": 0,
  "utility_id": 0,
  "client_id": "string"
}
```

Swagger does not expose list/update/delete for this mapping, so the page is create-only.

## Vector Collections

Native Swagger endpoint:

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/vector-collections` | List vector collections |
| `POST` | `/api/vector-collections` | Create native vector collection row |
| `GET` | `/api/vector-collections/{uuid}` | Detail vector collection row |
| `DELETE` | `/api/vector-collections/{uuid}` | Delete native vector collection and related file |
| `GET` | `/api/vector-collections/{uuid}/download` | Stream original uploaded file |
| `POST` | `/api/vector-collections/{uuid}/upload` | Upload original TXT/PDF file |

Payload create native collection:

```json
{
  "uuid": "string",
  "name": "string",
  "cmetadata": "{}"
}
```

Current UI flow:

1. User creates/selects `collection_name` from Semantic Search.
2. Upload Knowledge lists names from Semantic Search and native `/api/vector-collections`.
3. If selected name has no native vector collection row, UI creates one with `/api/vector-collections`.
4. UI uploads the original TXT/PDF to `/api/vector-collections/{uuid}/upload`.
5. UI then sends the same content to Go backend `/vector-webhook` so chunking/vector indexing runs without n8n. Uploading to an existing `collection_name` replaces the old vector rows in `n8n_vectors` before inserting the latest chunks.
6. Collection Knowledge lists saved native vector collection rows as one active knowledge entry per collection, fetches fresh detail through `GET /api/vector-collections/{uuid}` before opening the drawer, displays upload time when a timestamp exists, separates original file preview through Open File from explicit Download, and can delete the native vector collection/file row.

`cmetadata` parsing is defensive in the frontend. Supported display formats include plain path strings, JSON objects, and JSON arrays. File preview/download uses `GET /api/vector-collections/{uuid}/download`.

ERD note: `semantic_search.collection_name` and `n8n_vector_collections.name` are not connected by FK. UI keeps them aligned by name. When deleting a Semantic Search row, the frontend first deletes the matching native vector collection by name through `DELETE /api/vector-collections/{uuid}` when that native row exists, then deletes the Semantic Search registry row.

## AI Chat Webhook

```text
POST /chat-webhook
```

Proxy target:

```text
http://194.233.79.180:8081/api/v1/chat
```

Payload:

```json
{
  "sessionId": "string",
  "chatInput": "string",
  "usecaseId": 1
}
```

AI Chat is separate from Swagger CRUD. User must select a usecase before sending a message. The frontend sends `usecaseId` as a number and does not send legacy n8n fields such as `action` or `message`.

## Intent Sync

```text
POST /intent-sync
```

Proxy target:

```text
http://194.233.79.180:8081/api/v1/update
```

Payload:

```json
{}
```

This endpoint reloads/synchronizes the AIWO intent cache from backend data. The Intents page exposes it as the `Sync Intents` button.

## VectorDB Go Backend Webhook

```text
POST /vector-webhook
```

Text upload payload:

```json
{
  "type": "text",
  "text": "isi knowledge",
  "collection_name": "nama_collection"
}
```

PDF upload uses multipart form-data:

```text
type=pdf
collection_name=nama_collection
file=<binary PDF>
```

`PUT /vector-webhook` remains available for backend sync compatibility, but is hidden in the frontend because casual use can create duplicate vector rows.

## JSON-like Fields

Swagger defines these JSON-like fields as strings:

- `parameter_needed`
- `header`
- `default_param`
- `cmetadata`

Frontend validates JSON text with `JSON.parse`, then sends the string value to match Swagger.
