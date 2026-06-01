# API Access Status

Tanggal pengecekan: 2026-06-01

Sumber audit terbaru: `C:\Users\User\Downloads\Swagger UI (6_1_2026 10ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¼ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡04ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¼ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡07 AM).html` dan `http://172.16.210.244:8080/swagger/doc.json`.

Base API server:

```text
http://172.16.210.244:8080
```

Frontend development memakai Vite proxy:

```text
http://127.0.0.1:5173/api/* -> http://172.16.210.244:8080/api/*
http://127.0.0.1:5173/chat-webhook -> http://172.16.210.244:5678/webhook/eb70bb74-2714-4d79-b447-de3e7cd683cb/chat
http://127.0.0.1:5173/vector-webhook -> http://172.16.210.244:5678/webhook/update-intent
```

Alasan memakai proxy: API bisa di-hit dari shell/local network, tetapi request browser langsung ke IP server berpotensi gagal karena CORS. Dengan proxy, data tetap berasal dari API real, bukan data mock.

## Endpoint yang Dapat Diakses

Endpoint berikut sudah dites melalui proxy frontend `http://127.0.0.1:5173` dan mengembalikan status `200`.

| Method | Endpoint | Status | Dipakai untuk |
| --- | --- | --- | --- |
| `GET` | `/api/ai-agents/` | Bisa diakses | List AI Agent |
| `GET` | `/api/actions/` | Bisa diakses | List Action |
| `GET` | `/api/intents/` | Bisa diakses | List Intent |
| `GET` | `/api/external-data/` | Bisa diakses | List External Data |
| `GET` | `/api/semantic-searches/` | Bisa diakses | List Semantic Search |
| `GET` | `/api/utilities/` | Bisa diakses | List Utility |

Endpoint CRUD yang tersedia dari Swagger live:

| Resource | Create | Read List | Read Detail | Update | Delete |
| --- | --- | --- | --- | --- | --- |
| Actions | `/api/actions/` | `/api/actions/` | `/api/actions/{id}` | `/api/actions/{id}` | `/api/actions/{id}` |
| AI Agents | `/api/ai-agents/` | `/api/ai-agents/` | `/api/ai-agents/{id}` | `/api/ai-agents/{id}` | `/api/ai-agents/{id}` |
| External Data | `/api/external-data/` | `/api/external-data/` | `/api/external-data/{id}` | `/api/external-data/{id}` | `/api/external-data/{id}` |
| Intents | `/api/intents/` | `/api/intents/` | `/api/intents/{id}` | `/api/intents/{id}` | `/api/intents/{id}` |
| Semantic Search | `/api/semantic-searches/` | `/api/semantic-searches/` | `/api/semantic-searches/{id}` | `/api/semantic-searches/{id}` | `/api/semantic-searches/{id}` |
| Utilities | `/api/utilities/` | `/api/utilities/` | Belum terlihat | Belum terlihat | Belum terlihat |
| AI Agent Utilities | `/api/ai-agent-utilities/` | Belum tersedia | Belum terlihat | Belum terlihat | Belum terlihat |

## Endpoint Non-Swagger yang Dipakai

Endpoint ini tidak muncul di Swagger backend `:8080`, tetapi dipakai oleh halaman AI Chat dan halaman Vector Collections.

| Method | Frontend path | Target proxy | Status | Dipakai untuk |
| --- | --- | --- | --- | --- |
| `POST` | `/chat-webhook` | `http://172.16.210.244:5678/webhook/eb70bb74-2714-4d79-b447-de3e7cd683cb/chat` | Bisa diakses, proxy test `200` | Kirim pesan ke AI/n8n workflow |
| `POST` | `/vector-webhook` | `http://172.16.210.244:5678/webhook/update-intent` | Bisa diakses; write tests harus disertai cleanup row PGVector | Upload text/PDF ke VectorDB |
| `PUT` | `/vector-webhook` | `http://172.16.210.244:5678/webhook/update-intent` | Terpasang di UI; tidak di-smoke-test untuk menghindari duplicate insert Intent/Action | Sync Intent + Action ke VectorDB |

Contoh respons direct test:

```json
{
  "executionStarted": true,
  "executionId": "2507",
  "resumeToken": "..."
}
```

Jika workflow n8n belum mengembalikan teks jawaban langsung, UI akan menampilkan payload real tersebut, bukan jawaban mock.

Payload frontend:

```json
{
  "chatInput": "pesan user",
  "message": "pesan user",
  "sessionId": "uuid-session",
  "collection_name": "nama_collection_dari_semantic_search",
  "semantic_search_id": 1
}
```

`collection_name` otomatis diambil dari pilihan Semantic Search di halaman AI Chat agar nama collection yang dipakai webhook sama dengan data `/api/semantic-searches/`.

Payload VectorDB text:

```json
{
  "type": "text",
  "text": "isi knowledge",
  "collection_name": "nama_collection"
}
```

Payload VectorDB PDF memakai `multipart/form-data` dengan field `type=pdf`, `collection_name`, dan binary field `file`.

Di halaman Vector Collections, `collection_name` dipilih dari data real `/api/semantic-searches/`. Target baru didaftarkan dulu melalui `POST /api/semantic-searches/`, lalu nama yang sama dikirim ke n8n saat upload text/PDF atau sync dijalankan.

Catatan ERD: `semantic_search.collection_name` dan `n8n_vector_collections.name` bukan relasi FK. Keduanya disamakan secara logical by name. Row `semantic_search` membuat collection muncul di halaman Semantic Search dan bisa dipilih oleh Action; workflow n8n membuat/mengisi `n8n_vector_collections` dan `n8n_vectors` memakai nama yang sama.

Catatan cleanup: smoke test write pernah dilakukan ke collection `peraturan` dengan text `Frontend smoke test VectorDB setelah n8n publish. Abaikan dokumen ini jika terlihat di hasil retrieval.` dan `Frontend proxy smoke test VectorDB setelah page dipisah.`. Belum dihapus karena tidak ada delete endpoint/credential database di repo. SQL cleanup disiapkan di `docs/VECTOR_TEST_CLEANUP.md`.

Payload VectorDB sync:

```json
{
  "collection_name": "nama_collection"
}
```

## Endpoint yang Tidak Dapat Diakses / Belum Tersedia

Endpoint berikut sudah dites dan mengembalikan `404`, atau tidak muncul di Swagger live.

| Method | Endpoint | Status | Dampak di UI |
| --- | --- | --- | --- |
| `GET` | `/api/ai-agent-utilities/` | `404 Not Found` | Menu Agent Utilities tidak bisa menampilkan list mapping real. Create tetap tersedia karena `POST` ada di Swagger. |
| `GET` | `/api/vector-collections/` | `404 Not Found` | Tidak bisa menampilkan tabel `n8n_vector_collections`. |
| `GET` | `/api/n8n-vector-collections/` | `404 Not Found` | Tidak bisa menampilkan tabel `n8n_vector_collections`. |
| `GET` | `/api/n8n_vector_collections/` | `404 Not Found` | Tidak bisa menampilkan tabel `n8n_vector_collections`. |
| `GET` | `/api/vectors/` | `404 Not Found` | Tidak bisa menampilkan tabel `n8n_vectors`. |
| `GET` | `/api/n8n-vectors/` | `404 Not Found` | Tidak bisa menampilkan tabel `n8n_vectors`. |
| `GET` | `/api/n8n_vectors/` | `404 Not Found` | Tidak bisa menampilkan tabel `n8n_vectors`. |

## Relasi ERD dan Status Implementasi

| ERD | UI | API status |
| --- | --- | --- |
| `ai_agent` | AI Agents | Tersedia |
| `action` | Actions | Tersedia |
| `intent` | Intents | Tersedia |
| `external_data` | External Data | Tersedia |
| `semantic_search` | Semantic Search | Tersedia |
| `utility` | Utilities | List/create tersedia, update/delete belum terlihat |
| `ai_agent_utility` | Agent Utilities | Create tersedia, list belum tersedia |
| `n8n_vector_collections` | Vector Collections | Tidak ada Swagger read endpoint; dibuat/dipakai oleh n8n PGVector lewat `collection_name` |
| `n8n_vectors` | Vector Collections | Tidak ada Swagger read endpoint; diisi oleh n8n PGVector dari text/PDF/sync |

## Catatan Frontend

- Tidak ada mock data di aplikasi.
- Jika endpoint gagal, UI menampilkan data kosong dan status error, bukan mengisi data palsu.
- Tombol Add/Edit/Delete hanya aktif jika method terkait tersedia di konfigurasi API frontend.
- Tombol Edit untuk resource CRUD lengkap mengambil data detail dari `GET /api/.../{id}` sebelum membuka form.
- Data collection existing diambil dari `semantic_search.collection_name` melalui endpoint `/api/semantic-searches/`.
- Halaman Vector Collections melakukan `POST /api/semantic-searches/` untuk mendaftarkan collection baru agar muncul juga di halaman Semantic Search. Setelah terdaftar, `POST` text, `POST` PDF, atau `PUT` sync ke n8n memakai `collection_name` yang sama untuk mengisi PGVector.
- Halaman AI Chat memakai respons real dari `/chat-webhook`; tidak ada fallback jawaban mock. Jika n8n mengembalikan `executionStarted`, UI menampilkan status workflow yang lebih readable, bukan JSON mentah.


## UI/UX Implementation Notes

Implemented on 2026-06-01:

- Action form is conditional by `action_type` and only shows the relevant target dropdown.
- Action payload clears non-selected target relation fields before submit.
- Tables now show relationship-aware labels and target summaries instead of only raw foreign key IDs.
- JSON fields have inline validation, placeholders, and a `Format JSON` control.
- Modules without read endpoints show unavailable panels with the missing endpoint names.
- Table rows can open a read-only detail drawer; CRUD-complete resources fetch `GET /api/.../{id}` before edit/detail where available.
- Intent Action dropdown now shows detailed Action labels: id, action type, target, and parameter summary.
- AI Chat page is available and posts to the n8n webhook through the Vite `/chat-webhook` proxy.
- AI Chat sends selected Semantic Search `collection_name` and `semantic_search_id` to the webhook.

REST API availability was rechecked on 2026-06-01. The active/missing endpoint set is unchanged from the prior audit.



