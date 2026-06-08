# Server Setup

Panduan ini untuk menjalankan Intent & Agent Management Console di server internal:

```text
litmas@172.16.210.244
```

Aplikasi tetap frontend React. `server-setup/prod-server.mjs` hanya serve static `dist` dan reverse proxy ke REST API serta n8n.

## Runtime Target

- App URL: `http://172.16.210.244:5173/`
- Swagger UI: `http://194.233.79.180:8080/swagger/index.html#/`
- API target: `http://194.233.79.180:8080`
- n8n target: `http://103.140.90.131:5678`
- PM2 process name: `interface-intent`
- Server project folder: `~/interface-intent/interface-intent`
- Project Node version: `.nvmrc` -> Node `22`

## Prasyarat

- Login sebagai user `litmas`.
- Server default Node boleh v18, tetapi project harus dijalankan dengan `nvm use` supaya memakai Node 22.
- Server bisa akses API target dan n8n target.
- Port aplikasi `5173` terbuka di jaringan kantor.

## Setup Node dengan nvm

Jalankan sebagai user `litmas` bila nvm belum ada:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
```

Di folder project:

```bash
cd ~/interface-intent/interface-intent
nvm install
nvm use
node -v
which node
```

`node -v` harus menunjukkan Node 22 sesuai `.nvmrc`. `which node` sebaiknya mengarah ke `/home/litmas/.nvm/versions/node/.../bin/node`, bukan `/usr/bin/node`.

## Git Workflow

Push dilakukan dari laptop/local development, bukan dari server production.

Di local:

```bash
git status
git add .
git commit -m "Update dashboard docs"
git push origin main
```

Setelah push selesai, masuk server dan pull update.

Di server:

```bash
ssh litmas@172.16.210.244
cd ~/interface-intent/interface-intent
nvm use
node -v
git status
git pull origin main
npm ci
npm run build
pm2 restart interface-intent --update-env
pm2 list
```

`nvm use` sengaja dijalankan sebelum `git pull` agar semua command berikutnya jelas berada dalam shell Node 22. `git pull` sendiri tidak butuh Node, tetapi `npm ci`, `npm run build`, dan PM2 restart harus memakai environment Node yang benar.

## Deploy Update Ringkas

Kalau sudah yakin working tree server bersih:

```bash
ssh litmas@172.16.210.244
cd ~/interface-intent/interface-intent
nvm use
node -v
git pull origin main
npm ci
npm run build
pm2 restart interface-intent --update-env
pm2 logs interface-intent --lines 30
```

Keluar dari log dengan `Ctrl + C`.

## First Run dengan PM2

Jika PM2 process belum ada:

```bash
cd ~/interface-intent/interface-intent
nvm install
nvm use
node -v
npm ci
cp .env.production.example .env.production
npm run build
pm2 start server-setup/prod-server.mjs --name interface-intent --update-env
pm2 save
```

Jika PM2 pernah dibuat saat shell masih memakai Node 18 dan app bermasalah, buat ulang process setelah `nvm use`:

```bash
cd ~/interface-intent/interface-intent
nvm use
node -v
pm2 delete interface-intent
pm2 start server-setup/prod-server.mjs --name interface-intent --update-env
pm2 save
pm2 list
```

## Cek PM2 Memakai Node yang Benar

Cek detail process:

```bash
pm2 show interface-intent
```

Pastikan app berjalan setelah shell sudah `nvm use`. Jika masih ada indikasi memakai Node lama, restart dari shell Node 22 atau buat ulang process seperti bagian sebelumnya.

## Konfigurasi Runtime

`.env.production` default:

```env
VITE_API_BASE_URL=
HOST=0.0.0.0
PORT=5173
API_TARGET=http://194.233.79.180:8080
N8N_TARGET=http://103.140.90.131:5678
CHAT_WEBHOOK_PATH=/webhook/eb70bb74-2714-4d79-b447-de3e7cd683cb/chat
VECTOR_WEBHOOK_PATH=/webhook/update-intent
```

Biarkan `VITE_API_BASE_URL=` kosong supaya browser memanggil relative path `/api`, `/chat-webhook`, dan `/vector-webhook`. `prod-server.mjs` yang meneruskan request ke server tujuan.

## Kalau `git pull` Gagal Karena `package-lock.json`

Jika server hanya punya perubahan lockfile dari install lokal:

```bash
git restore package-lock.json
git pull origin main
```

Jangan restore semua file tanpa mengecek perubahan tim:

```bash
git status
git diff --stat
```

## Smoke Check Aman

Setelah deploy, cek dari server:

```bash
curl http://localhost:5173/
curl http://localhost:5173/api/auth/me
```

`/api/auth/me` tanpa token boleh mengembalikan unauthorized; itu berarti proxy mencapai API. Untuk validasi UI, buka:

```text
http://172.16.210.244:5173/
```

Login, lalu cek flow utama:

- Intents list/load.
- Usecases list/load.
- Semantic Search list/load.
- Vector Collections list native collections.
- AI Chat kirim pesan.

Jangan smoke test `POST /vector-webhook` kecuali ada rencana cleanup, karena request itu menulis row ke PGVector.

## Alternatif Nginx

Jika server memakai Nginx, gunakan `nginx-interface-intent.conf` sebagai contoh static server dan reverse proxy. Dalam mode ini, Nginx menggantikan `prod-server.mjs` untuk serve app dan proxy request.
