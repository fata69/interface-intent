# Rencana Migrasi n8n VectorDB Workflow ke Backend Go

Tanggal: 2026-06-12

## Latar Belakang

Saat ini workflow chunking/vector-indexing knowledge dijalankan oleh n8n (`http://103.140.90.131:5678`). Frontend mengirim request ke `/vector-webhook` yang diproxy ke n8n `POST /webhook/update-intent`. Tujuan migrasi ini adalah **mengganti n8n sepenuhnya** dengan endpoint Go di backend yang sudah ada (`http://194.233.79.180:8080`), sehingga arsitektur lebih robust, maintainable, dan tidak bergantung pada n8n.

## Analisis n8n Workflow Aktif

Sumber: `update_vectordb_ultimate (2).json`

Workflow ini punya dua set node — satu set **disabled** (suffix `1`) dan satu set **active/enabled** (suffix `2`). Yang di-analisis di sini hanya **node active** sesuai instruksi.

### Endpoint yang Aktif

| Method | Path | Fungsi |
| --- | --- | --- |
| `POST` | `/webhook/update-intent` | Upload text atau PDF knowledge ke VectorDB |
| `PUT` | `/webhook/update-intent` | Sync semua intent dari database ke VectorDB |

### Flow POST (Upload Knowledge)

```text
Webhook (POST)2
  → Switch (POST)2: cek body.type
      ├─ "text"  → Satpam Teks (POST)2 → PGVector Store1
      ├─ "pdf"   → Satpam File (POST)2 → validasi → PGVector Store1
      └─ lainnya → Respond 400 (Invalid Type POST)
```

#### Jalur TEXT (`type: "text"`)

1. **Switch** mengarahkan ke output `TEXT` berdasarkan `body.type === "text"`.
2. **Satpam Teks (POST)2** — validasi:
   - `body.text` tidak boleh kosong.
   - `body.collection_name` tidak boleh kosong.
   - `body.text.length <= 50.000` karakter.
   - Gagal → Respond 400: "Pastikan parameter text dan collection_name terisi. Teks tidak boleh lebih dari 50.000 karakter."
3. **Postgres PGVector Store1** — insert ke PGVector:
   - Collection name dari `body.collection_name`.
   - Embedding batch size: `10`.
   - Mode: `insert`.
   - Sukses → Respond 200: `{ error_code: 0, message: "berhasil menambahkan intent" }`.
   - Gagal → Respond 500: "Gagal memproses dokumen! AI mengalami kendala."

#### Sub-node yang terlibat saat insert ke PGVector (TEXT & PDF):

- **Embeddings Google Gemini1**: model `models/gemini-embedding-2` (Google PaLM/Gemini API).
- **Default Data Loader1**: load data dari `$json.text || $json.body?.text`. Metadata:
  - `document_id`: nama file jika ada binary, atau `"Input_Teks_Manual"`.
- **Recursive Character Text Splitter2**: text splitting recursive character-based.
  - Default chunk size: `1000` karakter (default n8n).
  - Chunk overlap: `200` karakter.

#### Jalur PDF (`type: "pdf"`)

1. **Switch** mengarahkan ke output `DOCUMENT` berdasarkan `body.type === "pdf"`.
2. **Satpam File (POST)2** — validasi:
   - Binary file (`$binary.file`) harus ada.
   - `body.collection_name` tidak boleh kosong.
   - Gagal → Respond 400: "Pastikan collection_name terisi dan file tidak kosong."
3. **Satpam Jenis File1** — validasi MIME type:
   - `$binary.file.mimeType === "application/pdf"`.
   - Gagal → Respond 400: "File ditolak! Dokumen wajib berformat PDF."
4. **Satpam Ukuran 10MB1** — validasi ukuran:
   - `content-length <= 10485760` (10 MB).
   - Gagal → Respond 400: "File ditolak! Ukuran dokumen kebesaran, maksimal 10 MB."
   - Keputusan migrasi backend Go: naikkan limit operasional menjadi 20 MB (`20971520`) sesuai arahan terbaru, meskipun workflow n8n aktif aslinya 10 MB.
5. **Extract from File2** — extract text dari PDF binary (n8n built-in PDF parser).
6. **Satpam Halaman** — validasi jumlah halaman:
   - `info.numpages <= 50`.
   - Gagal → Respond 400: "File ditolak! Dokumen kepanjangan, maksimal 50 halaman."
7. **Postgres PGVector Store1** — insert vector ke PGVector (sama seperti TEXT path).

#### Jalur INVALID TYPE

- Jika `body.type` bukan `"text"` dan bukan `"pdf"` → Respond 400: "Parameter type wajib diisi dengan nilai text atau pdf."

### Flow PUT (Sync Intent ke VectorDB)

```text
Webhook (PUT)2
  → Satpam (PUT)2: cek body.collection_name tidak kosong
      ├─ valid   → SQL query intent+action → Satpam data kosong1
      │              ├─ ada data   → PGVector Store5 (insert per row)
      │              │                  ├─ sukses → Respond 200 PUT sukses
      │              │                  └─ gagal  → Respond 500 AI Error
      │              └─ data kosong → Respond 400 "Data intent kosong"
      └─ invalid → Respond 400 "collection_name wajib diisi"
```

1. **Satpam (PUT)2**: validasi `body.collection_name` tidak kosong.
2. **Execute a SQL query2**: jalankan query langsung ke PostgreSQL:

   ```sql
   SELECT
       i.context,
       i.action_id,
       a.action_type,
       a.parameter_needed
   FROM intent i
   JOIN action a ON i.action_id = a.id;
   ```

3. **Satpam data kosong1**: cek `$input.all().length > 0`.
4. **PGVector Store5**: insert tiap row intent ke PGVector.
   - Collection name dari `body.collection_name`.
   - Metadata per row: `action_id`, `action_type`, `parameter_needed`.
   - Data loader: `$json.context || $json.body.text`.
5. **Embeddings Google Gemini5**: sama, model `models/gemini-embedding-2`.

## Ringkasan Komponen yang Harus Direplikasi di Go

### 1. PDF Processing

| Komponen | n8n Node | Yang dilakukan |
| --- | --- | --- |
| PDF text extraction | `extractFromFile` (PDF mode) | Baca binary PDF, extract full text dari semua halaman |
| Page count | `extractFromFile` output `info.numpages` | Hitung jumlah halaman untuk validasi ≤50 |

**Go library kandidat**: `pdfcpu`, `unipdf`, atau `pdftotext` via CGo/exec. Alternatif: `github.com/ledongthuc/pdf` (pure Go, simple text extraction).

### 2. Text Chunking (Recursive Character Text Splitter)

| Parameter | Nilai |
| --- | --- |
| Chunk size | 1000 karakter (default) |
| Chunk overlap | 200 karakter |
| Separator strategy | Recursive character: `["\n\n", "\n", " ", ""]` |

**Go library kandidat**: implementasi manual (straightforward), atau port dari LangChain `RecursiveCharacterTextSplitter`.

### 3. Embedding Generation

| Parameter | Nilai |
| --- | --- |
| Provider | Google Gemini/PaLM API |
| Model | `models/gemini-embedding-2` |
| Batch size | 10 dokumen per batch |

**Go approach**: HTTP call ke Google Generative AI / Gemini embedding API. Bisa pakai `google.golang.org/genai` atau REST `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents`.

### 4. PGVector Store (PostgreSQL + pgvector)

| Parameter | Nilai |
| --- | --- |
| Storage | PostgreSQL dengan extension `pgvector` |
| Table | `n8n_vectors` (columns: `id uuid`, `text text`, `metadata jsonb`, `embedding vector`, `collection_id uuid`) |
| Collection table | `n8n_vector_collections` (columns: `uuid uuid`, `name varchar`, `cmetadata jsonb`) |
| Insert mode | `INSERT` (bukan upsert) |

**Go approach**: `pgx` driver + manual SQL `INSERT INTO n8n_vectors (id, text, metadata, embedding, collection_id) VALUES (...)`. Embedding disimpan sebagai `vector` type dari pgvector extension.

### 5. Validasi Input

| Validasi | Kondisi | Response |
| --- | --- | --- |
| Type wajib | `type` harus `"text"` atau `"pdf"` | 400 |
| Text tidak kosong | `text` wajib ada dan `collection_name` wajib ada | 400 |
| Text max length | `text.length <= 50.000` | 400 |
| File ada | binary file harus ada | 400 |
| File PDF only | MIME `application/pdf` | 400 |
| File max size | `<= 20 MB` untuk backend Go baru; n8n aktif lama memakai 10 MB | 400 |
| PDF max pages | `<= 50 halaman` | 400 |
| PUT collection_name | `collection_name` wajib | 400 |
| PUT data ada | query intent harus punya >= 1 row | 400 |

## Rencana Endpoint Go Baru

### Endpoint POST: Upload Knowledge

```text
POST /api/vector-knowledge
Content-Type: application/json ATAU multipart/form-data
Authorization: Bearer <token>
```

**JSON body (text)**:

```json
{
  "type": "text",
  "text": "isi knowledge",
  "collection_name": "nama_collection"
}
```

**Multipart body (pdf)**:

```
type=pdf
collection_name=nama_collection
file=<binary PDF>
```

**Response sukses**:

```json
{
  "error_code": 0,
  "message": "berhasil menambahkan intent"
}
```

**Response error**: format sama `{ error_code, message }` dengan HTTP status yang sesuai.

### Endpoint PUT: Sync Intent ke VectorDB

```text
PUT /api/vector-knowledge
Content-Type: application/json
Authorization: Bearer <token>
```

**Body**:

```json
{
  "collection_name": "nama_collection"
}
```

**Flow internal**:

1. Validasi `collection_name`.
2. Query `intent JOIN action` dari database.
3. Cek data tidak kosong.
4. Untuk tiap intent: chunk context → embed → insert ke `n8n_vectors` dengan metadata `action_id`, `action_type`, `parameter_needed`.
5. Return sukses/error.

> [!IMPORTANT]
> Path endpoint Go baru perlu dikonfirmasi dengan mentor. Opsi:
> - `/api/vector-knowledge` (baru, terpisah dari `/api/vector-collections`)
> - `/api/vector-collections/knowledge` (sub-path dari existing)
> - Tetap pakai path lama `/webhook/update-intent` di Go server supaya minim perubahan frontend

## Dampak ke Frontend

### Perubahan Proxy

| Sebelum | Sesudah |
| --- | --- |
| `/vector-webhook` → n8n `http://103.140.90.131:5678/webhook/update-intent` | `/vector-webhook` → Go `http://194.233.79.180:8080/api/vector-knowledge` (atau path baru yang disepakati) |

File yang perlu diubah:

- `vite.config.js`: ubah proxy target `/vector-webhook` dari n8n ke Go backend.
- `server-setup/prod-server.mjs`: ubah `VECTOR_WEBHOOK_PATH` dan target.
- `.env.production.example`: update env variable jika path berubah.

### Perubahan Frontend Code

Jika path endpoint Go baru **tetap diproxy lewat `/vector-webhook`** dengan response shape yang sama (`{ error_code, message }`):

- **Tidak ada perubahan** di `VectorCollectionPanel.jsx` — `fetch('/vector-webhook', ...)` tetap bekerja.
- **Tidak ada perubahan** di `readWebhookResponse()` — parsing response tetap sama.

Jika path endpoint Go baru **memakai path berbeda** (misalnya `/api/vector-knowledge`):

- Ubah `fetch('/vector-webhook', ...)` jadi `fetch('/api/vector-knowledge', ...)` di `VectorCollectionPanel.jsx`.
- Atau tambahkan helper di `src/api/client.js` untuk consistency.

### Perubahan Auth

n8n webhook saat ini **tidak pakai auth**. Endpoint Go baru kemungkinan besar **pakai Bearer token** seperti endpoint Swagger lain. Frontend perlu menambahkan `Authorization` header saat `fetch` ke endpoint knowledge baru.

File: `src/features/vector-collections/components/VectorCollectionPanel.jsx` — tambahkan token dari auth store ke header request.

## Arsitektur Sesudah Migrasi

```text
Browser
  → React/Vite frontend
  → /api/vector-knowledge via proxy
  → http://194.233.79.180:8080/api/vector-knowledge
  → Go backend:
      1. Validasi input
      2. (PDF) Extract text dari PDF
      3. Recursive character text splitting (chunk 1000, overlap 200)
      4. Batch embedding via Google Gemini API (models/gemini-embedding-2)
      5. INSERT chunks + embeddings ke PostgreSQL pgvector (n8n_vectors table)
  → Response JSON ke frontend
```

```text
n8n (http://103.140.90.131:5678) → TIDAK LAGI DIGUNAKAN untuk VectorDB
```

## Dependency Go yang Dibutuhkan

| Dependency | Kegunaan |
| --- | --- |
| `github.com/jackc/pgx/v5` | PostgreSQL driver (sudah mungkin ada di backend) |
| `github.com/pgvector/pgvector-go` | pgvector type support untuk Go |
| PDF text extraction library | Extract text + page count dari PDF |
| Google Generative AI SDK / HTTP client | Call Gemini embedding API |

## Konfigurasi yang Diperlukan

Backend Go perlu env/config baru:

```env
GEMINI_API_KEY=<Google Gemini/PaLM API key>
GEMINI_EMBEDDING_MODEL=models/gemini-embedding-2
EMBEDDING_BATCH_SIZE=10
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TEXT_MAX_LENGTH=50000
PDF_MAX_SIZE_BYTES=20971520
PDF_MAX_PAGES=50
```

> [!WARNING]
> `GEMINI_API_KEY` saat ini tersimpan di n8n credential store (`Google Gemini(PaLM) Api account`, credential ID `0DSVxlPfVcsS5OLM`). Key ini perlu dipindahkan ke config/env backend Go. Tanyakan ke mentor atau admin n8n untuk mendapatkan key-nya.

## Risiko dan Catatan

> [!CAUTION]
> - **Duplikasi vector**: n8n workflow melakukan `INSERT` (bukan upsert). Jika upload knowledge yang sama dua kali, vector rows akan duplikat. Backend Go sebaiknya mempertimbangkan deduplication atau clear-before-insert per collection.
> - **PUT sync tidak filter collection**: SQL query PUT mengambil SEMUA intent tanpa filter `collection_name`. Semua intent+action di-embed dan dimasukkan ke satu collection. Perlu konfirmasi apakah ini behavior yang diinginkan atau perlu filter by usecase/collection.
> - **Database credentials**: Backend Go perlu akses ke database PostgreSQL yang sama dengan n8n. Pastikan pgvector extension sudah terinstall.
> - **Embedding model**: `gemini-embedding-2` perlu diverifikasi bahwa output dimensi vector-nya sesuai dengan kolom `embedding` di `n8n_vectors`.

## Urutan Pengerjaan yang Disarankan

### Phase 1: Go Backend (dikerjakan di repo backend)

1. Tambah endpoint `POST /api/vector-knowledge` di Go.
2. Implementasi validasi input (text/pdf type, size, page limit).
3. Implementasi PDF text extraction.
4. Implementasi recursive character text splitter.
5. Implementasi Gemini embedding API call.
6. Implementasi PGVector insert.
7. Tambah endpoint `PUT /api/vector-knowledge` untuk sync intent.
8. Test dengan curl/Postman.

### Phase 2: Frontend Integration

1. Update proxy di `vite.config.js` dan `server-setup/prod-server.mjs`.
2. Tambahkan Bearer token ke request VectorDB di `VectorCollectionPanel.jsx`.
3. Update path jika endpoint Go berbeda dari `/vector-webhook`.
4. Test end-to-end upload text dan PDF.

### Phase 3: Cleanup

1. Hapus referensi n8n dari `AGENTS.md`, `README.md`, dan docs.
2. Update `docs/API_ACCESS_STATUS.md` dan `docs/API_REFERENCE.md`.
3. Nonaktifkan workflow n8n `update_vectordb_ultimate` setelah Go backend confirmed working.
4. `npm run build` final.

## Konfirmasi yang Diperlukan dari Mentor

1. **Path endpoint Go baru** — apakah `/api/vector-knowledge`, atau path lain?
2. **Auth requirement** — apakah endpoint knowledge baru juga pakai Bearer token?
3. **Gemini API key** — bagaimana mendapatkan key yang saat ini tersimpan di n8n?
4. **PUT sync behavior** — apakah sync tetap mengambil semua intent, atau perlu filter by usecase/collection?
5. **Deduplication strategy** — clear collection sebelum re-index, atau insert saja (duplikat diizinkan)?
6. **Database access** — apakah backend Go sudah connect ke database PostgreSQL yang sama dengan n8n? Apakah pgvector extension sudah ada?
7. **Embedding dimension** — berapa dimensi output `gemini-embedding-2` dan apakah kolom `embedding` di `n8n_vectors` sudah sesuai?
