# Server Setup

Panduan ini untuk menjalankan Intent & Agent Management Console di server internal:

```text
litmas@172.16.210.244
```

Aplikasi tetap frontend React. `server-setup/prod-server.mjs` hanya serve static `dist` dan reverse proxy ke REST API, AIWO engine, serta backend Go Vector Knowledge.

## Runtime Target

- App URL: `http://172.16.210.244:5173/`
- Swagger UI: `http://172.16.210.244:8080/swagger/index.html#/`
- API target: `http://172.16.210.244:8080`
- AIWO engine target: `http://172.16.210.244:8081`
- Vector Knowledge backend target: `http://127.0.0.1:8082`
- PM2 process name: `interface-intent`
- Server project folder: `~/interface-intent/interface-intent-migrate`
- Project Node version: `.nvmrc` -> Node `22`

## Prasyarat

- Login sebagai user `litmas`.
- Server default Node boleh v18, tetapi project harus dijalankan dengan `nvm use` supaya memakai Node 22.
- Server bisa akses API target, AIWO engine, PostgreSQL/PGVector database, dan Gemini API dari backend Go.
- Port aplikasi `5173` terbuka di jaringan kantor.

## Setup Node dengan nvm

Jalankan sebagai user `litmas` bila nvm belum ada:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
```

Di folder project:

```bash
cd ~/interface-intent/interface-intent-migrate
nvm install
nvm use
node -v
which node
```

`node -v` harus menunjukkan Node 22 sesuai `.nvmrc`. `which node` sebaiknya mengarah ke `/home/litmas/.nvm/versions/node/.../bin/node`, bukan `/usr/bin/node`.

## Setup Go Lokal dengan `use-go-1.23`

Backend Go Vector Knowledge membutuhkan Go official 1.21+; gunakan Go 1.23 lokal di home user `litmas` supaya tidak mengubah Go global/mentor. Server default pernah memakai `/usr/bin/go` dari `gccgo` 1.18, dan itu tidak cukup karena dependency backend memakai standard library `slices`.

Install Go official lokal jika belum ada:

```bash
cd /tmp
wget https://go.dev/dl/go1.23.12.linux-amd64.tar.gz
mkdir -p ~/sdk
rm -rf ~/sdk/go1.23.12
tar -C ~/sdk -xzf go1.23.12.linux-amd64.tar.gz
mv ~/sdk/go ~/sdk/go1.23.12
```

Buat command mirip `nvm use`. Copy satu blok ini sekaligus; jangan beri spasi sebelum `EOF`:

```bash
cat >> ~/.bashrc <<'EOF'

use-go-1.23() {
  export PATH="$HOME/sdk/go1.23.12/bin:${PATH//:$HOME\/sdk\/go1.23.12\/bin/}"
  hash -r
  go version
  which go
}
EOF
source ~/.bashrc
```

Pakai hanya saat perlu build backend ini:

```bash
use-go-1.23
```

Expected:

```text
go version go1.23.12 linux/amd64
/home/litmas/sdk/go1.23.12/bin/go
```

Kalau terminal masuk prompt `>` saat membuat function, berarti heredoc belum tertutup. Tekan `Ctrl+C`, lalu ulang blok `cat >> ~/.bashrc ... EOF` dengan `EOF` persis di awal baris.

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
cd ~/interface-intent/interface-intent-migrate
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
cd ~/interface-intent/interface-intent-migrate
nvm use
node -v
git pull origin main
npm ci
npm run build
pm2 restart interface-intent --update-env
pm2 logs interface-intent --lines 30
```

Keluar dari log dengan `Ctrl + C`.

## Deploy / Update Backend Go Vector Knowledge

Jalankan dari server sebagai user `litmas` setelah `git pull` branch terbaru:

```bash
cd ~/interface-intent/interface-intent-migrate/backend
use-go-1.23
go version
which go
```

Jika `go test` atau `go build` meminta tidy, jalankan:

```bash
go mod tidy
```

Build backend:

```bash
go test ./...
mkdir -p bin
go build -o bin/vector-knowledge-backend ./cmd/server
ls -lh bin/vector-knowledge-backend
```

Pastikan file env backend tersedia dan tidak world-readable:

```bash
test -f .env && echo ".env exists" || echo ".env missing"
chmod 600 .env
```

Jika `.env missing`, upload dari laptop/local:

```powershell
scp ".\backend\.env" litmas@172.16.210.244:~/interface-intent/interface-intent-migrate/backend/.env
```

Start atau restart backend dengan PM2:

```bash
pm2 delete vector-knowledge-backend 2>/dev/null || true
pm2 start ./bin/vector-knowledge-backend --name vector-knowledge-backend --cwd "$(pwd)"
pm2 save
```

Validasi backend:

```bash
curl http://127.0.0.1:8082/health
```

Expected:

```json
{"service":"vector-knowledge-backend","status":"healthy"}
```

Jika backend gagal start, cek log:

```bash
pm2 logs vector-knowledge-backend --lines 80
```

Setelah backend healthy, deploy/restart frontend seperti bagian `Deploy Update Ringkas`, lalu validasi proxy vector tanpa token:

```bash
curl -i -X POST http://127.0.0.1:5173/vector-webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"invalid"}'
```

Expected tanpa login token:

```text
HTTP/1.1 401 Unauthorized
```

Jika hasilnya `502`, backend Go belum running atau `.env.production` frontend belum mengarah ke `VECTOR_BACKEND_TARGET=http://127.0.0.1:8082`.

## First Run dengan PM2

Jika PM2 process belum ada:

```bash
cd ~/interface-intent/interface-intent-migrate
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
cd ~/interface-intent/interface-intent-migrate
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
API_TARGET=http://172.16.210.244:8080
AIWO_ENGINE_TARGET=http://172.16.210.244:8081
VECTOR_BACKEND_TARGET=http://127.0.0.1:8082
CHAT_WEBHOOK_PATH=/api/v1/chat
INTENT_SYNC_PATH=/api/v1/update
VECTOR_WEBHOOK_PATH=/webhook/update-intent
```

Biarkan `VITE_API_BASE_URL=` kosong supaya browser memanggil relative path `/api`, `/chat-webhook`, `/intent-sync`, dan `/vector-webhook`. `prod-server.mjs` yang meneruskan request ke server tujuan.

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
- Vector Collections > Upload Knowledge untuk pilih collection dan upload Text/PDF.
- Vector Collections > Collection Files untuk buka detail file collection, lalu Open File untuk preview atau Download bila memang perlu unduh.
- AI Chat pilih usecase lalu kirim pesan.

Jangan smoke test `POST /vector-webhook` kecuali ada rencana cleanup, karena request itu menulis row ke PGVector.

## Alternatif Nginx

Jika server memakai Nginx, gunakan `nginx-interface-intent.conf` sebagai contoh static server dan reverse proxy. Dalam mode ini, Nginx menggantikan `prod-server.mjs` untuk serve app dan proxy request.

