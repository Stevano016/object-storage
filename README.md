# Gentan Storage - Object Storage Server

Sistem penyimpanan objek (*Object Storage*) mandiri (self-hosted) yang ringan, berkinerja tinggi, dan aman. Proyek ini didesain khusus untuk dijalankan di VPS remote (seperti **Server Gentan** Anda) dengan antarmuka dasbor admin yang modern dan responsif.

## Fitur Utama

- 📂 **Bucket Management**: Buat, hapus, dan atur visibilitas bucket (Publik atau Privat).
- 📤 **Media Streamer & Range Queries**: Mendukung penuh pemutaran video dan audio langsung di peramban (HTTP 206 Partial Content) tanpa lemot/buffering berlebih.
- 🛡️ **Security-First Design**:
  - **Path Traversal Protection**: Semua file disimpan menggunakan identitas fisik UUID di disk lokal untuk mencegah serangan pembacaan file sistem (`../`).
  - **API Key Hashing**: Token integrasi disimpan dalam hash SHA-256 di database SQLite.
  - **Fallback Authentication**: Mendukung query string `?token=...` untuk pemutaran video/gambar privat langsung di HTML `<video>` / `<img>`.
- 🔑 **Programmatic API Keys**: Buat API Key untuk digunakan oleh skrip backup atau aplikasi luar lainnya.
- ⚡ **Zero Cache / Low Memory**: File dialirkan langsung dari filesystem (*readable streams*) tanpa membebani RAM server VPS.
- 📊 **Dasbor Admin Premium**: Didesain menggunakan sistem warna OKLCH dan Vanilla CSS yang bersih, interaktif, responsif, dan bebas dari clutter.

---

## Struktur Folder

```text
/
├── ARCHITECTURE.md     # Penjelasan lengkap arsitektur sistem
├── README.md           # Petunjuk penggunaan ini
├── backend/            # API Server (Node.js + TypeScript + SQLite)
│   ├── src/            # Kode sumber backend
│   └── data/           # Database SQLite & lokasi folder penyimpanan file (storage/)
└── web/                # Dasbor Admin (React + Vite + Vanilla CSS)
    └── src/            # Kode sumber frontend
```

---

## Langkah Menjalankan di Lokal (Development)

### Prasyarat
Pastikan Anda memiliki **Node.js (v18 ke atas)** dan **npm** terinstal di komputer Anda.

### 1. Setup Backend
1. Buka terminal di folder `backend/`.
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Buat file konfigurasi `.env`:
   ```bash
   copy .env.example .env
   ```
4. Jalankan backend dalam mode development:
   ```bash
   npm run dev
   ```
   Backend akan berjalan di **`http://localhost:5000`**.
   > [!NOTE]
   > Pada saat pertama kali dijalankan, sistem akan otomatis membuat database SQLite dan men-seed pengguna admin default:
   > - **Username**: `admin`
   > - **Password**: `admingentan123`
   > 
   > Harap segera ganti password ini di tab **Settings** dasbor setelah berhasil masuk.

### 2. Setup Frontend (Dashboard)
1. Buka terminal baru di folder `web/`.
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Jalankan dasbor dalam mode development:
   ```bash
   npm run dev
   ```
   Dasbor akan berjalan di **`http://localhost:5173`** (otomatis terhubung dengan backend port `5000`).

---

## Panduan Deployment ke VPS (Server Gentan)

Untuk menjalankan di VPS, Anda direkomendasikan menggunakan metode **Single Process Deployment** di mana server Express backend akan menyajikan file frontend React yang telah di-build secara otomatis.

### Langkah 1: Build Proyek
1. Di komputer lokal Anda, buka folder `web/` dan jalankan:
   ```bash
   npm run build
   ```
   Ini akan menghasilkan folder `web/dist` yang berisi file HTML/JS/CSS statis.
2. Buka folder `backend/` dan jalankan:
   ```bash
   npm run build
   ```
   Ini akan mengompilasi kode TypeScript backend ke folder `backend/dist/`.

### Langkah 2: Unggah Berkas ke VPS
Unggah berkas-berkas berikut dari komputer lokal Anda ke VPS Anda (misalnya ke `/var/www/gentan-storage`):
- Folder `backend/dist/`
- Folder `backend/package.json` dan `backend/package-lock.json`
- File `backend/.env` (sesuaikan port & secret key di VPS)
- Folder `web/dist/` (pastikan diletakkan sejajar dengan folder `backend`, sehingga letaknya berada di `../web/dist` relatif terhadap server backend).

### Langkah 3: Jalankan di VPS
1. Hubungkan ke VPS Anda melalui SSH.
2. Masuk ke folder aplikasi di VPS, kemudian instal dependensi produksi di folder `backend`:
   ```bash
   npm install --omit=dev
   ```
3. Jalankan server menggunakan **PM2** agar tetap hidup di latar belakang:
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name gentan-storage
   ```
4. Anda sekarang dapat mengakses dashboard admin dan API di port yang telah dikonfigurasi (default: `5000`). Anda juga dapat mengarahkan Nginx atau sistem reverse proxy VPS Anda ke port tersebut.

---

## Panduan Self-Hosting MinIO (Object Storage) di VPS

Aplikasi ini mendukung penyimpanan lokal di disk server maupun penyimpanan berbasis **MinIO (S3-compatible Object Storage)**. MinIO sangat direkomendasikan untuk produksi karena performanya yang stabil, andal, dan kompatibel dengan API standar S3 AWS.

### 1. Menjalankan MinIO dengan Docker Compose
Di folder root proyek, sudah disediakan file `docker-compose.yml`. Untuk menjalankan MinIO di VPS:
1. Pastikan **Docker** dan **Docker Compose** sudah terinstal di VPS Anda.
2. Jalankan perintah berikut untuk mengaktifkan MinIO di background:
   ```bash
   docker compose up -d
   ```
3. MinIO akan berjalan pada dua port:
   - **`Port 9000`**: S3 API Endpoint (digunakan oleh backend aplikasi kita).
   - **`Port 9001`**: Web Console Admin (digunakan untuk login visual via browser, default: `minioadmin` / `minioadminpassword`).

### 2. Menghubungkan Aplikasi ke MinIO
Ubah file konfigurasi `backend/.env` di VPS Anda untuk mengalihkan penyimpanan dari disk lokal ke MinIO:
```ini
# Ubah provider penyimpanan ke 'minio'
STORAGE_PROVIDER=minio

# Konfigurasi S3 Endpoint MinIO
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadminpassword
S3_REGION=us-east-1
S3_BUCKET_PREFIX=gentan-
S3_FORCE_PATH_STYLE=true
```

Setelah mengubah konfigurasi `.env`, **restart** proses backend di PM2:
```bash
pm2 restart gentan-storage
```
Aplikasi Anda kini akan mengunggah file-file biner langsung ke MinIO, sementara metadata file tetap tersimpan di database SQLite lokal untuk performa query pencarian yang cepat.

---

## Panduan Akses API & Integrasi Programmatic

### 1. Mengunggah File via API
Kirim request POST multipart ke endpoint berikut dengan header `X-API-Key`:
```http
POST /api/buckets/[nama-bucket]/files
Host: http://<vps-ip>:5000
X-API-Key: gentan_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: multipart/form-data

file: [Raw File Payload]
```

### 2. Mengakses/Streaming File Privat
Untuk mengakses berkas dari bucket privat lewat tag media HTML, tambahkan parameter query `token` (untuk admin) atau `api_key` (untuk program/skrip):
```html
<!-- Menggunakan API Key -->
<video src="http://<vps-ip>:5000/s/my-private-bucket/video.mp4?api_key=gentan_xxxx" controls></video>

<!-- Menggunakan JWT Token Dashboard -->
<img src="http://<vps-ip>:5000/s/my-private-bucket/photo.jpg?token=ey..." />
```
