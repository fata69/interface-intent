# Panduan Pengerjaan Web

Dokumen ini menjelaskan cara mengembangkan Intent & Agent Management Console. Project ini berisi frontend React/Vite dan backend Go Vector Knowledge untuk indexing PGVector. REST CRUD utama tetap berasal dari API eksternal.

## Sumber Utama

- ERD terbaru ada di root repo: `ERD.mmd` dan `ERD_VIEW.html`.
- Swagger aktif: `http://172.16.210.244:8080/swagger/index.html#/`.
- Internal app server: `litmas@172.16.210.244`.
- Default app URL server: `http://172.16.210.244:5173/`.

## Prinsip Struktur

Gunakan pendekatan feature-based. Dalam project ini, feature berarti page yang muncul di sidebar.

```text
src/features/<feature-name>/
  Page.jsx
  config.js
  components/
```

Shared code hanya ditempatkan di `src/templates/` jika dipakai lintas feature:

```text
src/templates/hooks/useResourceCrud.js
src/templates/components/PageHeader.jsx
src/templates/components/ResourceToolbar.jsx
src/templates/components/ResourceTable.jsx
src/templates/components/ResourceModal.jsx
src/templates/components/DetailDrawer.jsx
```

Jangan membuat template page besar yang mengatur semua feature. Feature `Page.jsx` harus tetap menjadi tempat layout page terlihat dan mudah diubah.

## Kapan Edit File Apa

- Ubah field form, kolom tabel, title, icon, atau deskripsi: edit `src/features/<feature-name>/config.js`.
- Ubah tampilan spesifik page, posisi tombol, tambahan panel, atau layout: edit `src/features/<feature-name>/Page.jsx`.
- Tambah komponen yang hanya dipakai satu feature: buat `src/features/<feature-name>/components/`.
- Ubah logic CRUD semua page: edit `src/templates/hooks/useResourceCrud.js`.
- Ubah komponen reusable: edit `src/templates/components/`.
- Ubah endpoint/path/capability API: edit `src/api/client.js`.
- Ubah grouping sidebar atau path route: edit `src/config/resources.js`.
- Tambah page ke router internal: edit `src/features/index.js`, lalu tambahkan path di `routeByModule` pada `src/config/resources.js`.

## Menambah Feature CRUD Baru

1. Buat folder `src/features/<feature-name>/`.
2. Buat `config.js` untuk title, fields, columns, icon, dan pesan unavailable jika perlu.
3. Buat `Page.jsx` yang memakai `useResourceCrud`, `PageHeader`, `StatusStrip`, dan `ResourceCrudSurface`.
4. Tambahkan endpoint di `src/api/client.js`.
5. Register config di `src/config/resources.js`.
6. Register page di `src/features/index.js`.
7. Tambahkan nav item di `navGroups` jika harus muncul di sidebar.
8. Jalankan `npm run build`.

## Sidebar Saat Ini

```text
AI-Configuration
- Intents
- Usecases
- Actions
  - External Data
  - AI Agents
  - Agent Utilities
  - Semantic Search
- Utilities
- Vector Collections
- Roles
- Users
- AI Chat
```

Roles dan Users bersifat admin-only di UI. Jangan menambah level submenu baru di bawah Semantic Search kecuali diminta.

## Integrasi API

Request API memakai relative path `/api/...` dan diproxy oleh Vite/prod server ke `http://172.16.210.244:8080`.

```text
/api/*          -> http://172.16.210.244:8080/api/*
/chat-webhook   -> http://172.16.210.244:8081/api/v1/chat
/intent-sync    -> http://172.16.210.244:8081/api/v1/update
/vector-webhook -> http://127.0.0.1:8082/webhook/update-intent
```

Navigasi dashboard memakai `react-router-dom`. Route utama saat ini adalah `/intents`, `/usecases`, `/actions`, `/external-data`, `/agents`, `/agent-utilities`, `/semantic-search`, `/utilities`, `/vector-collections/upload`, `/vector-collections/files`, `/roles`, `/users`, dan `/chat`. Root `/` redirect ke `/intents`, sedangkan `/vector-collections` redirect ke `/vector-collections/upload`. Route `/vector-collections/files` tampil sebagai Collection Knowledge karena sekarang satu collection punya satu knowledge aktif.

Jangan menambahkan mock data. Jika endpoint belum ada, biarkan capability di `src/api/client.js` bernilai `false` dan tampilkan unavailable state.

## Auth dan Admin Pages

API memakai Bearer token. Login dilakukan lewat `/api/auth/login`, profile lewat `/api/auth/me`, dan `401` akan memicu session reset.

Jangan expose self-register publik. Untuk dashboard, user dibuat dari admin-only Users page supaya `role_id` dan `usecase_ids` jelas.

## AI Chat

AI Chat mengirim pesan ke AIWO chat service dengan payload:

```json
{
  "sessionId": "uuid-session",
  "chatInput": "pesan user",
  "usecaseId": 1
}
```

User harus memilih usecase sebelum pesan dikirim. `usecaseId` dikirim sebagai number dan tidak boleh di-hardcode.

AI Chat menyimpan `sessionId`, pesan, draft, dan selected usecase di `sessionStorage` melalui store feature. Tombol reset chat membuat session baru dan menghapus pesan/draft, tetapi mempertahankan usecase yang dipilih.

## Vector Collections

Semantic Search adalah registry collection untuk Action target melalui `/api/semantic-searches/`. Vector Collections memakai nama collection dari Semantic Search dan native `/api/vector-collections`.

Current flow:

1. Buat atau pilih collection dari Semantic Search.
2. Upload Knowledge memastikan native collection row ada di `/api/vector-collections`.
3. Upload original TXT/PDF ke `/api/vector-collections/{uuid}/upload`.
4. Kirim konten yang sama ke Go backend `/vector-webhook` untuk chunking/vector indexing. Jika `collection_name` sudah punya vector lama, backend Go menghapus row lama di `n8n_vectors` lalu memasukkan chunk terbaru.
5. Collection Knowledge menampilkan satu isi knowledge aktif per collection, membuka drawer detail dulu, memisahkan preview file lewat Open File dari Download yang eksplisit, dan bisa menghapus native vector collection/file lewat `/api/vector-collections/{uuid}`.

Label isi knowledge di Collection Knowledge dibaca dari `cmetadata` secara defensif. Format yang ditoleransi: path string biasa, JSON object, dan JSON array.

Di ERD tidak ada FK antara `semantic_search` dan `n8n_vector_collections`. Hubungannya logical by name: `semantic_search.collection_name` harus sama dengan `n8n_vector_collections.name`.

Delete Semantic Search dari dashboard akan mencoba menghapus native Vector Collection yang namanya sama lebih dulu melalui `DELETE /api/vector-collections/{uuid}`, lalu menghapus registry Semantic Search. Replace isi knowledge tetap terjadi saat upload ulang ke `collection_name` yang sama melalui backend Go.

Aksi Go Vector Knowledge backend yang tersedia:

```text
POST /vector-webhook  JSON: { type: "text", text, collection_name }
POST /vector-webhook  multipart/form-data: type=pdf, collection_name, file=<PDF>
PUT  /vector-webhook  JSON: { collection_name }
```

Endpoint `PUT /vector-webhook` tetap terdokumentasi untuk sync backend, tetapi tidak diekspos di UI karena berisiko menambah row duplicate jika dipakai tanpa deduplication.

Jangan test write endpoint `/vector-webhook` tanpa rencana cleanup. POST text/PDF akan menambah row ke `n8n_vectors`; cleanup SQL terdokumentasi di `docs/VECTOR_TEST_CLEANUP.md`.

## Validasi Sebelum Handoff

Selalu jalankan:

```bash
npm run build
```

Untuk perubahan API, cek ulang Swagger dan update `docs/API_ACCESS_STATUS.md`. Untuk perubahan struktur atau UI, update `AGENTS.md`, `README.md`, dan `docs/UI_UX_PLAN.md` bila relevan.

