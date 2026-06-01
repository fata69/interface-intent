# Panduan Pengerjaan Web

Dokumen ini menjelaskan cara mengembangkan **Intent & Agent Management Console** dengan struktur yang sudah disepakati. Project ini adalah frontend React/Vite yang menembak REST API eksternal dan webhook n8n; tidak ada backend lokal di codebase ini.

## Prinsip Struktur

Gunakan pendekatan feature-based. Dalam project ini, **feature berarti page yang muncul di sidebar**.

```text
src/features/<feature-name>/
  Page.jsx      # layout page milik feature
  config.js     # field, kolom, label, icon, description
  components/   # optional, hanya untuk komponen khusus feature
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
- Ubah grouping sidebar: edit `src/config/resources.js`.
- Tambah page ke router internal: edit `src/features/index.js`.

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

Sidebar mengikuti arahan mentor:

```text
AI-Configuration
- Intents
- Actions
  - External Data
  - AI Agents
  - Agent Utilities
  - Semantic Search
- Utilities
- Vector Collections
- AI Chat
```

Submenu dapat di-hide/unhide. Jangan menambah level submenu baru di bawah Semantic Search kecuali diminta.

## Integrasi API

Request API memakai relative path `/api/...` dan diproxy oleh Vite ke `http://172.16.210.244:8080`. Chat memakai `/chat-webhook` dan diproxy ke n8n `:5678`. VectorDB memakai `/vector-webhook` dan diproxy ke `http://172.16.210.244:5678/webhook/update-intent`.

Jangan menambahkan mock data. Jika endpoint belum ada, biarkan capability di `src/api/client.js` bernilai `false` dan tampilkan unavailable state.

## AI Chat dan Semantic Search

AI Chat mengirim pesan ke webhook dengan payload:

```json
{
  "chatInput": "pesan user",
  "message": "pesan user",
  "sessionId": "uuid-session",
  "collection_name": "nama_collection_dari_semantic_search",
  "semantic_search_id": 1
}
```

`collection_name` dipilih dari data real Semantic Search agar nama collection yang dipakai webhook sama dengan data API.
## Vector Collections

Halaman Semantic Search adalah registry collection lewat `/api/semantic-searches/`. Halaman Vector Collections bisa mendaftarkan `collection_name` baru ke Semantic Search, memilih collection tersebut, lalu mengisi PGVector lewat n8n `/vector-webhook`.

Di ERD tidak ada FK antara `semantic_search` dan `n8n_vector_collections`. Hubungannya logical by name: `semantic_search.collection_name` harus sama dengan `n8n_vector_collections.name` yang dibuat/dipakai workflow n8n.

Aksi VectorDB yang tersedia:

```text
POST /vector-webhook  JSON: { type: "text", text, collection_name }
POST /vector-webhook  multipart/form-data: type=pdf, collection_name, file=<PDF>
PUT  /vector-webhook  JSON: { collection_name }
```

Existing `collection_name` diambil dari row Semantic Search real. Jika perlu collection baru, register dari halaman Vector Collections terlebih dahulu agar muncul juga di halaman Semantic Search, lalu jalankan upload text/PDF atau sync. Workflow n8n yang membuat atau memakai collection PGVector saat data dimasukkan.

Jangan test write endpoint `/vector-webhook` tanpa rencana cleanup. POST text/PDF akan menambah row ke `n8n_vectors`; hapus row test dengan exact text melalui endpoint cleanup atau SQL database sebelum handoff.

## Validasi Sebelum Handoff

Selalu jalankan:

```bash
npm run build
```

Untuk perubahan API, cek ulang Swagger dan update `docs/API_ACCESS_STATUS.md`. Untuk perubahan struktur atau UI, update `AGENTS.md`, `README.md`, dan `docs/UI_UX_PLAN.md` bila relevan.
