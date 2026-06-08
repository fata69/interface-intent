# Panduan Pengerjaan Web

Dokumen ini menjelaskan cara mengembangkan Intent & Agent Management Console. Project ini adalah frontend React/Vite yang memakai REST API eksternal dan webhook n8n; tidak ada backend lokal di codebase ini.

## Sumber Utama

- ERD terbaru ada di root repo: `ERD.mmd` dan `ERD_VIEW.html`.
- Swagger aktif: `http://194.233.79.180:8080/swagger/index.html#/`.
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

Request API memakai relative path `/api/...` dan diproxy oleh Vite/prod server ke `http://194.233.79.180:8080`.

```text
/api/*          -> http://194.233.79.180:8080/api/*
/chat-webhook   -> http://103.140.90.131:5678/webhook/eb70bb74-2714-4d79-b447-de3e7cd683cb/chat
/vector-webhook -> http://103.140.90.131:5678/webhook/update-intent
```

Navigasi dashboard memakai `react-router-dom`. Route utama saat ini adalah `/intents`, `/usecases`, `/actions`, `/external-data`, `/agents`, `/agent-utilities`, `/semantic-search`, `/utilities`, `/vector-collections`, `/roles`, `/users`, dan `/chat`. Root `/` redirect ke `/intents`.

Jangan menambahkan mock data. Jika endpoint belum ada, biarkan capability di `src/api/client.js` bernilai `false` dan tampilkan unavailable state.

## Auth dan Admin Pages

API memakai Bearer token. Login dilakukan lewat `/api/auth/login`, profile lewat `/api/auth/me`, dan `401` akan memicu session reset.

Jangan expose self-register publik. Untuk dashboard, user dibuat dari admin-only Users page supaya `role_id` dan `usecase_ids` jelas.

## AI Chat

AI Chat mengirim pesan ke n8n dengan payload:

```json
{
  "chatInput": "pesan user",
  "message": "pesan user",
  "sessionId": "uuid-session"
}
```

Collection untuk retrieval ditentukan oleh workflow n8n dari prompt/chat logic, bukan dari selector frontend.

AI Chat menyimpan `sessionId`, pesan, dan draft di `sessionStorage` melalui store feature. Tombol reset chat membuat session baru dan menghapus state tersimpan.

## Vector Collections

Semantic Search adalah registry collection untuk Action target melalui `/api/semantic-searches/`. Vector Collections memakai nama collection dari Semantic Search dan native `/api/vector-collections`.

Current flow:

1. Buat atau pilih collection dari Semantic Search.
2. Vector Collections memastikan native collection row ada di `/api/vector-collections`.
3. Upload original TXT/PDF ke `/api/vector-collections/{uuid}/upload`.
4. Kirim konten yang sama ke n8n `/vector-webhook` untuk chunking/vector indexing.

Di ERD tidak ada FK antara `semantic_search` dan `n8n_vector_collections`. Hubungannya logical by name: `semantic_search.collection_name` harus sama dengan `n8n_vector_collections.name`.

Aksi n8n VectorDB yang tersedia:

```text
POST /vector-webhook  JSON: { type: "text", text, collection_name }
POST /vector-webhook  multipart/form-data: type=pdf, collection_name, file=<PDF>
PUT  /vector-webhook  JSON: { collection_name }
```

Endpoint `PUT /vector-webhook` tetap terdokumentasi untuk n8n, tetapi tidak diekspos di UI karena berisiko menambah row duplicate jika dipakai tanpa deduplication.

Jangan test write endpoint `/vector-webhook` tanpa rencana cleanup. POST text/PDF akan menambah row ke `n8n_vectors`; cleanup SQL terdokumentasi di `docs/VECTOR_TEST_CLEANUP.md`.

## Validasi Sebelum Handoff

Selalu jalankan:

```bash
npm run build
```

Untuk perubahan API, cek ulang Swagger dan update `docs/API_ACCESS_STATUS.md`. Untuk perubahan struktur atau UI, update `AGENTS.md`, `README.md`, dan `docs/UI_UX_PLAN.md` bila relevan.
