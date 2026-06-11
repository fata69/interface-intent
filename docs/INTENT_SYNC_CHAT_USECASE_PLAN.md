# Intent Sync and AI Chat Usecase Payload Plan

Tanggal: 2026-06-11

## Ringkasan Job

Ada dua perubahan baru dari mentor, dengan base URL AIWO engine/cache/chat baru:

```text
http://194.233.79.180:8081
```

1. Halaman `Intents` perlu tombol `Upload/Sync` di kanan atas untuk menyinkronkan data Intent di backend Go dengan cache engine AIWO. Mentor membuat mekanisme cache, jadi frontend perlu menyediakan trigger manual.
2. `AI Chat` perlu mengirim `usecaseId` ke webhook chat. Endpoint ini tidak ada di Swagger, tetapi dari Postman body yang diharapkan kurang lebih:

```json
{
  "sessionId": "session-dev-101",
  "chatInput": "Halo AIWO!",
  "usecaseId": 1
}
```

## Hasil Research Postman dan Probe

Sumber Postman lokal:

```text
C:\Users\User\Downloads\aiwo_postman_collection (1).json
```

Collection name: `AIWO API Collection`.

Postman variable `base_url` masih `http://localhost:8080`, tetapi mentor memberi base URL deploy `http://194.233.79.180:8081`, jadi frontend harus memetakan endpoint Postman ke host 8081.

Endpoint yang relevan:

| Fungsi | Method | Path | Base URL deploy |
| --- | --- | --- | --- |
| Health check | `GET` | `/health` | `http://194.233.79.180:8081` |
| AI Chat | `POST` | `/api/v1/chat` | `http://194.233.79.180:8081` |
| Intent cache reload | `GET` | `/update` | `http://194.233.79.180:8081` |
| Intent cache reload | `POST` | `/update` | `http://194.233.79.180:8081` |
| Intent cache reload v1 | `POST` | `/api/v1/update` | `http://194.233.79.180:8081` |
| JWT token utility | `GET` | `/token/generate?userId=developer-dev` | `http://194.233.79.180:8081` |

Safe probe yang sudah dilakukan:

- `GET http://194.233.79.180:8081/health` mengembalikan `200` dan JSON healthy.
- `OPTIONS /api/v1/chat`, `/update`, `/api/v1/update`, dan `/token/generate` mengembalikan `204`.
- Header yang diizinkan mencakup `Authorization` dan `X-API-Key`.
- Swagger/OpenAPI di `8081` tidak ditemukan: `/swagger/doc.json`, `/swagger/index.html`, `/openapi.json`, `/swagger.json`, `/docs`, dan `/api-docs` mengembalikan `404`.

Belum dilakukan:

- Belum menjalankan `GET /update` atau `POST /update` karena itu akan reload cache beneran.
- Belum menjalankan `POST /api/v1/chat` karena itu akan mengirim chat beneran.

## Status Implementasi

### Intents

- Page: `src/features/intents/Page.jsx`.
- Config: `src/features/intents/config.js`.
- CRUD memakai `useResourceCrud` dan endpoint Swagger `/api/intents/`.
- Header kanan atas memiliki filter Usecase dan tombol `Sync Intents`.
- Tombol sync memanggil helper `api.syncIntents()` ke proxy frontend `/intent-sync`.
- Status loading/success/error sync ditampilkan lewat `StatusStrip`.
- Setelah sync sukses, halaman memanggil `loadData()` untuk refresh data tabel.

### AI Chat

- Page: `src/features/ai-chat/Page.jsx`.
- Store: `src/features/ai-chat/chatStore.js`.
- Chat memakai helper `api.sendAiChat()` ke proxy frontend `/chat-webhook`.
- User harus memilih usecase sebelum bisa mengirim pesan.
- Payload sekarang mengirim shape strict sesuai Postman:

```json
{
  "sessionId": "...",
  "chatInput": "...",
  "usecaseId": 1
}
```

- Proxy dev: `vite.config.js`, `/chat-webhook` diarahkan ke AIWO `8081` path `/api/v1/chat`.
- Proxy production: `server-setup/prod-server.mjs`, `/chat-webhook` diarahkan ke AIWO `8081` path `/api/v1/chat`.
- App sudah punya data `usecases` dari API/profile dan user assignment helper di `src/features/auth/access.js`.

## Keputusan Endpoint Berdasarkan Postman

### Intent Sync

Gunakan endpoint engine/cache 8081, bukan endpoint CRUD Swagger 8080.

- Rekomendasi route frontend proxy: `/intent-sync`.
- Rekomendasi target: `http://194.233.79.180:8081`.
- Rekomendasi target path: `/api/v1/update`.
- Method: `POST`.
- Body: kemungkinan kosong `{}` karena Postman tidak mendefinisikan body untuk cache reload.

Alasan memilih `POST /api/v1/update`:

- Postman menyediakan tiga varian reload cache: `GET /update`, `POST /update`, dan `POST /api/v1/update`.
- UI button lebih aman memakai `POST` untuk action yang mengubah state/cache.
- Path `/api/v1/update` lebih eksplisit untuk API versioning dibanding root `/update`.

Catatan: jika mentor secara eksplisit meminta root `/update`, tinggal ganti proxy path tanpa mengubah UI button.

### Untuk AI Chat `usecaseId`

AI Chat wajib memilih usecase sebelum pesan dikirim karena satu user bisa memiliki lebih dari satu usecase.

- Pilihan usecase berasal dari assignment akun melalui profile user.
- Jika profile belum membawa detail usecase lengkap, label diperkaya dari `data.usecases` yang sudah diload aplikasi.
- Jika user tidak membawa assignment tetapi `data.usecases` tersedia, opsi itu dipakai sebagai fallback untuk admin/testing.
- Tidak ada hardcoded `usecaseId`.
- Tombol Send disabled sampai usecase dipilih dan draft pesan terisi.
- Pilihan usecase disimpan di `sessionStorage` bersama session chat, tetapi otomatis dikosongkan jika tidak valid setelah user/profile berubah.

## Rencana Implementasi 1: Intent Sync Button

### 1. Tambah API Helper

File: `src/api/client.js`

Tambahkan helper khusus:

```js
syncIntents: () => requestContent('/intent-sync', {
  method: 'POST',
  body: JSON.stringify({}),
})
```

Gunakan proxy app, jangan direct browser call ke `http://194.233.79.180:8081`, supaya CORS dan deployment tetap konsisten.

### 2. Update Proxy untuk Service 8081

- `vite.config.js`: tambah proxy `/intent-sync`.
- `server-setup/prod-server.mjs`: tambah env target/path dan route proxy.
- `.env.production.example`: tambah `AIWO_ENGINE_TARGET`, `INTENT_SYNC_PATH`, dan `CHAT_WEBHOOK_PATH`.
- `server-setup/README.md`: update runtime proxy docs.

Nama route rekomendasi direvisi agar tidak menyebut webhook karena ini service AIWO/engine, bukan n8n:

```text
/intent-sync -> http://194.233.79.180:8081/api/v1/update
```

Env production rekomendasi:

```env
AIWO_ENGINE_TARGET=http://194.233.79.180:8081
INTENT_SYNC_PATH=/api/v1/update
CHAT_WEBHOOK_PATH=/api/v1/chat
```

### 3. Update Intents Page UI

File: `src/features/intents/Page.jsx`

Tambahkan tombol di kanan atas melalui prop `actions` pada `PageHeader`.

Layout rekomendasi:

- Usecase filter tetap ada.
- Tombol sync di kanan atas, di sebelah refresh.
- Gunakan icon lucide seperti `UploadCloud`, `RefreshCw`, atau `CloudUpload`.
- Label tombol: `Sync Engine` atau `Sync Intents`.
- Saat sync berjalan, tombol disabled dan status strip menampilkan `Menyinkronkan intent ke engine...`.

Behavior rekomendasi:

- Sync dari Postman reload cache dari database, jadi payload awal cukup `{}`.
- Usecase filter di halaman hanya filter table, bukan parameter sync, kecuali mentor nanti minta sync per usecase.
- Setelah sync sukses, panggil `loadData()` agar table mengambil data terbaru dari backend.
- Tampilkan status hasil sync dari response.

### 4. Error Handling

- `403`: tampilkan pesan akses tidak cukup.
- `409` atau conflict cache: tampilkan pesan dari backend.
- Network error: status strip warning.
- Jangan insert mock/synthetic data ke table.

## Rencana Implementasi 2: AI Chat Kirim `usecaseId`

### 1. Data Usecase untuk Chat

File: `src/features/ai-chat/Page.jsx`

Ubah signature agar menerima `data` dan `user` dari `App.jsx` seperti page lain:

```js
export function ChatPage({ data, user }) { ... }
```

Ambil pilihan usecase dari:

- Utama: profile user lewat helper `getUserUsecases(user)`.
- Fallback label: `data.usecases` jika tersedia.
- Fallback admin/testing: `data.usecases` jika user tidak membawa assignment.

### 2. Tambah Usecase Selector di AI Chat

Lokasi UI:

- Area `chat-meta`, dekat Session ID.
- Selalu tampilkan `<select>` agar user memilih context chat dengan sadar.
- Jika tidak ada usecase, Send tetap disabled dan status menampilkan akses chat belum aktif. Namun global guard saat ini sudah memblok employee tanpa usecase.

State kandidat:

- Simpan selected usecase per session di `chatStore` agar refresh browser tidak hilang.
- Field baru: `usecaseId` atau `selectedUsecaseId`.
- Reset chat mempertahankan selected usecase karena usecase adalah context kerja, bukan pesan.

### 3. Update Proxy Chat ke Service 8081

AI Chat sebaiknya dipindah dari n8n `/chat-webhook` lama ke service AIWO 8081:

```text
/chat-webhook -> http://194.233.79.180:8081/api/v1/chat
```

Alternatif jika ingin tidak mengubah route internal lama:

- Tetap pakai URL frontend `/chat-webhook`.
- Ubah target proxy dev/prod dari n8n lama ke 8081 `/api/v1/chat`.
- Ini minim perubahan di `chatStore.js` karena fetch tetap ke `/chat-webhook`.

Alternatif lebih eksplisit:

```text
/aiwo-chat -> http://194.233.79.180:8081/api/v1/chat
```

Rekomendasi: pakai `/chat-webhook` existing untuk minim perubahan UI, tetapi update docs bahwa targetnya bukan n8n lama lagi.

### 4. Update Payload Chat

File: `src/features/ai-chat/chatStore.js`

Ubah `sendMessage` agar menerima selected usecase:

```js
chatStore.sendMessage({ usecaseId: selectedUsecaseId })
```

Payload sesuai Postman:

```json
{
  "sessionId": "...",
  "chatInput": "...",
  "usecaseId": 1
}
```

Karena service baru dari Postman menunjukkan body strict sederhana, hapus field lama `action` dan `message` dari request ke AIWO service kecuali mentor meminta compatibility dengan n8n lama.

### 5. Validasi Sebelum Send

- Jika `usecaseId` kosong, tombol Send disabled.
- Status strip: `Pilih usecase sebelum mengirim pesan.`
- Convert `usecaseId` ke number sebelum dikirim.
- Jangan kirim `usecase_id`; mentor contoh pakai camelCase `usecaseId`.

## Dampak RBAC dan Assignment Guard

Saat ini sudah ada global guard:

- Employee tanpa usecase assignment tidak bisa membuka halaman konfigurasi normal.
- Employee dengan usecase bisa membuka halaman non-admin.
- Admin bisa membuka semua.

Untuk AI Chat dengan `usecaseId`:

- Employee tanpa usecase tetap tidak bisa chat.
- Employee dengan satu atau banyak usecase tetap harus memilih usecase sebelum kirim pesan.
- Admin perlu pilih usecase dari opsi yang tersedia sebelum kirim pesan.

Untuk Intent Sync:

- Jika sync berdampak ke semua engine/cache, admin-only mungkin lebih aman.
- Jika sync scoped by usecase, employee boleh sync hanya usecase miliknya jika backend mengizinkan.
- Frontend harus mengikuti permission backend dan menampilkan error rapi jika ditolak.

## UI/UX Detail

### Intent Sync Button

- Posisi kanan atas di header Intents.
- Tombol bukan floating dan bukan card baru.
- Gunakan label pendek: `Sync Intents`.
- Tooltip/title: `Synchronize intents with engine cache`.
- Disabled saat page loading, CRUD busy, atau sync busy.
- Status result masuk ke `StatusStrip`, bukan alert browser.

### AI Chat Usecase Selector

- Jangan membuat page baru.
- Selector masuk ke panel chat meta, bukan header global jika terlalu penuh.
- Label pendek: `Usecase`.
- Tombol Send disabled jika usecase belum dipilih.
- Error dari webhook tetap masuk sebagai pesan assistant seperti sekarang.

## Test Plan

Jalankan:

```bash
npm run build
```

Manual test Intent Sync:

- Tombol sync muncul di kanan atas halaman Intents.
- Klik sync men-disable tombol selama request.
- Success response tampil di StatusStrip.
- Error response tampil jelas di StatusStrip.
- Setelah sukses, data reload.
- Tidak ada data dummy yang ditambahkan ke table.

Manual test AI Chat:

- User dengan satu atau banyak usecase harus memilih usecase sebelum chat.
- User/admin dengan banyak usecase bisa memilih usecase yang sesuai.
- Send disabled jika usecase belum dipilih.
- Payload memuat `sessionId`, `chatInput`, dan `usecaseId`.
- Response AIWO tetap dirender dengan parser chat response yang sudah ada, selama response berupa text atau JSON sederhana.

## Acceptance Criteria

- `Intents` memiliki tombol `Sync Intents` di kanan atas.
- Tombol sync memanggil endpoint mentor yang benar dan menampilkan status loading/success/error.
- AI Chat mengirim `usecaseId` di body webhook.
- `usecaseId` berasal dari usecase yang dipilih/assigned, bukan hardcoded.
- Chat tidak bisa dikirim tanpa selected usecase.
- Proxy dev/prod diperbarui ke service AIWO 8081 untuk sync intent dan AI Chat.
- `npm run build` berhasil.

## Konfirmasi Opsional dari Mentor

Implementasi saat ini memakai asumsi dari Postman dan arahan mentor:

1. Sync Intents memakai `POST /api/v1/update`.
2. Request lewat proxy frontend tetap membawa Bearer token dashboard jika user sedang login.
3. AI Chat pindah dari n8n lama ke `POST /api/v1/chat` di service AIWO `8081`.
4. AI Chat mengirim strict hanya `sessionId`, `chatInput`, dan `usecaseId`.

Jika mentor nanti meminta root `/update`, API key khusus, atau nama route internal baru, perubahan cukup dilakukan di proxy/helper tanpa mengubah layout UI.
