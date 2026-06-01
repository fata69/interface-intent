# API Reference - Intent & Agent Management Console

Sumber: Swagger live `http://172.16.210.244:8080/swagger/doc.json`, Swagger HTML lokal terbaru, dan workflow n8n `update_vectordb_ultimate.json`.

Base URL yang dipakai dari link Swagger:

```text
http://172.16.210.244:8080
```

Webhook chat n8n yang dipakai UI berada di host berbeda dan tidak termasuk Swagger `:8080`:

```text
http://172.16.210.244:5678/webhook/eb70bb74-2714-4d79-b447-de3e7cd683cb/chat
```

Untuk development React, kosongkan `.env` agar request memakai Vite proxy `/api` dan tidak kena CORS:

```env
VITE_API_BASE_URL=
```

Catatan: endpoint di bawah diekstrak dari HTML Swagger lokal. API berada pada IP privat, jadi akses langsung hanya mungkin dari jaringan/VPN yang sama.

Frontend juga memakai proxy `/chat-webhook` untuk meneruskan chat ke n8n dan `/vector-webhook` untuk update VectorDB lewat n8n.

## Ringkasan Endpoint

### Actions

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/actions/` | Mendapatkan semua action |
| `POST` | `/api/actions/` | Membuat action baru |
| `GET` | `/api/actions/{id}` | Mendapatkan satu action berdasarkan ID |
| `PUT` | `/api/actions/{id}` | Memperbarui data action |
| `DELETE` | `/api/actions/{id}` | Menghapus data action |

Business rule dari Swagger: saat membuat action, hanya satu ID relasi yang boleh terisi, yaitu salah satu dari `semantic_search_id`, `external_data_id`, atau `ai_agent_id`.

### AI Agent

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/ai-agents/` | Mendapatkan semua AI agent |
| `POST` | `/api/ai-agents/` | Membuat AI agent baru |
| `GET` | `/api/ai-agents/{id}` | Mendapatkan satu AI agent berdasarkan ID |
| `PUT` | `/api/ai-agents/{id}` | Memperbarui AI agent |
| `DELETE` | `/api/ai-agents/{id}` | Menghapus AI agent |

### External Data

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/external-data/` | Mendapatkan semua external data |
| `POST` | `/api/external-data/` | Membuat external data baru |
| `GET` | `/api/external-data/{id}` | Mendapatkan satu external data |
| `PUT` | `/api/external-data/{id}` | Memperbarui external data |
| `DELETE` | `/api/external-data/{id}` | Menghapus external data |

### Intent

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/intents/` | Mendapatkan semua intent |
| `POST` | `/api/intents/` | Membuat intent baru |
| `GET` | `/api/intents/{id}` | Mendapatkan satu intent |
| `PUT` | `/api/intents/{id}` | Memperbarui intent |
| `DELETE` | `/api/intents/{id}` | Menghapus intent |

### Semantic Search

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/semantic-searches/` | Mendapatkan semua data semantic search |
| `POST` | `/api/semantic-searches/` | Membuat data semantic search baru |
| `GET` | `/api/semantic-searches/{id}` | Mendapatkan satu data semantic search |
| `PUT` | `/api/semantic-searches/{id}` | Memperbarui data semantic search |
| `DELETE` | `/api/semantic-searches/{id}` | Menghapus data semantic search |

### Utility dan Mapping

| Method | Path | Fungsi |
| --- | --- | --- |
| `GET` | `/api/utilities/` | Mendapatkan semua utility |
| `POST` | `/api/utilities/` | Membuat utility baru |
| `POST` | `/api/ai-agent-utilities/` | Menghubungkan AI agent ke utility |

Swagger HTML tidak menampilkan endpoint detail/update/delete untuk utility dan mapping. Untuk web, siapkan UI list/create dulu dan aktifkan aksi lain hanya setelah endpoint dikonfirmasi.

### AI Chat Webhook

| Method | Frontend Path | Target | Fungsi |
| --- | --- | --- | --- |
| `POST` | `/chat-webhook` | `:5678/webhook/.../chat` | Mengirim pesan user ke workflow AI/n8n |

Endpoint ini bukan bagian dari Swagger, tetapi dipakai oleh halaman AI Chat. Frontend mengirim `chatInput`, `message`, `sessionId`, `collection_name`, dan `semantic_search_id`.
### VectorDB n8n Webhook

| Method | Frontend Path | Target | Fungsi |
| --- | --- | --- | --- |
| `POST` | `/vector-webhook` | `:5678/webhook/update-intent` | Upload text knowledge atau PDF ke collection VectorDB |
| `PUT` | `/vector-webhook` | `:5678/webhook/update-intent` | Sync Intent + Action dari backend ke collection VectorDB |

Endpoint ini bukan bagian dari Swagger `:8080`; endpoint berasal dari workflow n8n `update_vectordb_ultimate`. UI-nya berada di halaman Vector Collections. Target dipilih dari data real `/api/semantic-searches/`; target baru didaftarkan dulu lewat `POST /api/semantic-searches/` agar muncul juga di halaman Semantic Search.

Sesuai ERD, `semantic_search.collection_name` tidak memiliki FK ke `n8n_vector_collections.name`. Integrasi dilakukan by name: nama yang sama didaftarkan di Semantic Search dan dikirim ke n8n untuk membuat/mengisi PGVector.

## Payload Utama

### AI Agent

Dipakai untuk `POST /api/ai-agents/` dan `PUT /api/ai-agents/{id}`.

```json
{
  "agent_name": "string",
  "default_param": "string",
  "header": "string",
  "host": "string",
  "id": 0,
  "protocol_request": "http_get"
}
```

Field UI: `agent_name`, `protocol_request`, `host`, `header`, dan `default_param`.

### Action

Dipakai untuk `POST /api/actions/` dan `PUT /api/actions/{id}`.

```json
{
  "action_type": "semantic_search",
  "ai_agent_id": 0,
  "external_data_id": 0,
  "parameter_needed": "string",
  "semantic_search_id": 0
}
```

Swagger example juga menampilkan nested object `ai_agent`, `external_data`, `intent`, dan `semantic_search`, tetapi untuk form sebaiknya kirim ID relasi saja kecuali API menolak.

Validasi UI penting:

- `action_type` wajib diisi.
- Hanya satu dari `semantic_search_id`, `external_data_id`, atau `ai_agent_id` yang boleh aktif.
- `parameter_needed` diperlakukan sebagai JSON/string parameter.

### Intent

Dipakai untuk `POST /api/intents/` dan `PUT /api/intents/{id}`.

```json
{
  "action_id": 0,
  "context": "string",
  "id": 0
}
```

Field UI: `context` dan dropdown `action_id` dari `GET /api/actions/`.

### External Data

Dipakai untuk `POST /api/external-data/` dan `PUT /api/external-data/{id}`.

```json
{
  "default_param": "string",
  "header": "string",
  "host": "string",
  "id": 0,
  "protocol_request": "http_get"
}
```

Field UI sama seperti AI agent tanpa `agent_name`.

### Semantic Search

Dipakai untuk `POST /api/semantic-searches/` dan `PUT /api/semantic-searches/{id}`.

```json
{
  "collection_name": "string",
  "id": 0
}
```

### Utility

Dipakai untuk `POST /api/utilities/`.

```json
{
  "id": 0,
  "key": "string",
  "value": "string"
}
```

### AI Agent Utility Mapping

Dipakai untuk `POST /api/ai-agent-utilities/`.

```json
{
  "ai_agent_id": 0,
  "client_id": "string",
  "id": 0,
  "utility_id": 0
}
```

Swagger example juga menampilkan nested `ai_agent` dan `utility`, tetapi form cukup memakai dropdown `ai_agent_id` dan `utility_id` plus input `client_id`.

### VectorDB n8n Upload dan Sync

Dipakai oleh halaman Vector Collections.

POST text knowledge:

```json
{
  "type": "text",
  "text": "isi knowledge",
  "collection_name": "nama_collection"
}
```

POST PDF upload memakai `multipart/form-data`:

```text
type=pdf
collection_name=nama_collection
file=<binary PDF>
```

PUT sync Intent + Action:

```json
{
  "collection_name": "nama_collection"
}
```

`file` harus tetap menjadi nama field binary PDF karena workflow n8n membaca field tersebut. Jangan kirim mock collection. Collection baru harus didaftarkan ke Semantic Search terlebih dahulu, lalu `collection_name` yang sama dikirim ke n8n untuk membuat/mengisi PGVector.
### AI Chat

Dipakai untuk `POST /chat-webhook`.

```json
{
  "chatInput": "string",
  "message": "string",
  "sessionId": "string",
  "collection_name": "string",
  "semantic_search_id": 0
}
```

`collection_name` berasal dari data real Semantic Search agar webhook memakai nama collection yang sama dengan `/api/semantic-searches/`.

Respons webhook bisa berupa JSON atau text. UI membaca field umum seperti `output`, `text`, `response`, `message`, atau `answer`. Jika n8n mengembalikan response async seperti `executionStarted`, UI menampilkan status workflow readable, bukan bubble JSON mentah.

## Model dan Enum

Model yang tampil di Swagger:

- `models.AIAgent`
- `models.AIAgentUtility`
- `models.Action`
- `models.ActionType`
- `models.ExternalData`
- `models.Intent`
- `models.ProtocolRequest`
- `models.SemanticSearch`
- `models.Utility`

Enum yang terdeteksi:

- `ActionType`: Swagger menyebut enum berisi 3 nilai. Nilai yang terlihat di example: `semantic_search`. Berdasarkan ERD/action relation, siapkan opsi UI `semantic_search`, `external_data`, dan `ai_agent`, lalu konfirmasi ke Swagger live.
- `ProtocolRequest`: Swagger menyebut enum berisi 3 nilai. Nilai yang terlihat di example: `http_get`. Nilai lain perlu dikonfirmasi dari Swagger live.

## Standar Implementasi Frontend

- Semua request frontend memakai relative path `/api/...` saat `VITE_API_BASE_URL` kosong. Vite proxy meneruskan request ke `http://172.16.210.244:8080`.
- Request chat memakai relative path `/chat-webhook`; Vite proxy meneruskan request ke webhook n8n `:5678`.
- Request VectorDB memakai relative path `/vector-webhook`; Vite proxy meneruskan request ke `http://172.16.210.244:5678/webhook/update-intent`.
- Gunakan trailing slash sesuai Swagger untuk collection endpoint, contoh `/api/intents/`.
- Untuk detail/update/delete, ganti `{id}` dengan ID numerik.
- Selalu tampilkan loading, error, empty state, dan konfirmasi delete.
- Field foreign key wajib berupa dropdown dari endpoint terkait, bukan input angka manual.
- Field `header`, `default_param`, dan `parameter_needed` ditampilkan sebagai textarea JSON, lalu dikirim sebagai string JSON jika API mengikuti example Swagger.

## Catatan untuk Pengerjaan Berikutnya

- Jangan mengubah nama endpoint tanpa mengecek Swagger live.
- Jika API mengembalikan shape response berbeda dari example `{ "additionalProp1": {} }`, adaptasi mapping data di layer `src/api/` saja. Semua tampilan harus berasal dari API real.
- Jika POST/PUT menolak field `id`, hapus `id` dari payload create/update di adapter API.
- Jika POST/PUT action menolak nested object, kirim payload ringkas berbasis ID relasi seperti contoh di bagian Action.




