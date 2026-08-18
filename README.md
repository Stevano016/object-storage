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

## Peran Pengguna (Role)

Setiap akun memiliki salah satu dari dua peran. Pembatasan diterapkan di sisi server, bukan sekadar disembunyikan di antarmuka.

| Kemampuan | Super Admin | User Biasa |
| --- | :---: | :---: |
| Melihat daftar bucket dan berkas | ✅ | ✅ |
| Mengunggah berkas | ✅ | ✅ |
| Mengunduh / streaming berkas | ✅ | ✅ |
| Menghapus berkas | ✅ | ❌ |
| Membuat, mengubah, menghapus bucket | ✅ | ❌ |
| Membuat dan mencabut API Key | ✅ | ❌ |
| Menambah, mengubah, menghapus pengguna | ✅ | ❌ |
| Membuat dan mencabut tautan berbagi | ✅ | ❌ |
| Mengganti password sendiri | ✅ | ✅ |

Akun `admin` bawaan otomatis berperan **Super Admin**. Database lama (sebelum fitur ini) akan dimigrasikan otomatis saat server dijalankan: kolom `role` ditambahkan dan seluruh akun yang sudah ada dipromosikan menjadi Super Admin.

Pengelolaan akun ada di tab **Manajemen User** pada dasbor (hanya terlihat oleh Super Admin). Beberapa pengaman yang berlaku:

- Super Admin tidak dapat mengubah peran atau menghapus akunnya sendiri.
- Super Admin terakhir tidak dapat diturunkan perannya atau dihapus, sehingga sistem tidak pernah kehilangan administrator.
- Perubahan peran langsung berlaku pada permintaan berikutnya tanpa perlu login ulang, karena peran dibaca ulang dari database di setiap permintaan.

Endpoint terkait (semua memerlukan JWT Super Admin):

```http
GET    /api/users            # daftar pengguna
POST   /api/users            # { username, password, role }
PUT    /api/users/:id        # { username?, password?, role? }
DELETE /api/users/:id
GET    /api/auth/me          # profil akun yang sedang masuk
```

---

## Tautan Berbagi (Share Link)

Mirip Google Drive: sebuah tautan yang bisa dibuka **tanpa login sama sekali**. Token di dalam URL adalah satu-satunya kredensial, jadi siapa pun yang memegang tautan mendapat akses sesuai izinnya.

Tersedia dua tingkat izin:

| | Lihat & Unduh (`viewer`) | Unggah & Hapus (`editor`) |
| --- | :---: | :---: |
| Membuka halaman berbagi tanpa login | ✅ | ✅ |
| Melihat pratinjau (foto, video, audio) | ✅ | ✅ |
| Mengunduh berkas | ✅ | ✅ |
| Mengunggah berkas baru | ❌ | ✅ |
| Menghapus berkas | ❌ | ✅ |
| Melihat dasbor, bucket lain, atau API Key | ❌ | ❌ |

### Cakupan tautan

- **Seluruh bucket** — dibuat dari tab **Tautan Berbagi**. Penerima melihat semua berkas di bucket itu, lengkap dengan pencarian dan halaman.
- **Satu berkas** — dibuat dari tombol **Buat Tautan Berbagi** di jendela detail berkas. Tautan ini hanya bisa membuka dan mengunduh berkas tersebut; berkas lain dalam bucket yang sama tetap tertutup, dan mengunggah lewat tautan ini ditolak.

### Membuat dan mencabut

Hanya **Super Admin** yang boleh membuat tautan, di tab **Tautan Berbagi**. Setiap tautan bisa diberi catatan dan masa berlaku (1 hari, 7 hari, 30 hari, 1 tahun, atau tanpa batas). Izin tautan dapat diubah kapan saja dari kolom **Izin** pada tabel, dan tombol hapus mencabutnya secara permanen — begitu dicabut atau kedaluwarsa, tautan langsung mati untuk semua orang yang menyimpannya.

Format URL yang dibagikan:

```text
http://<host>:5000/share/<token>
```

### Endpoint

Manajemen (butuh JWT Super Admin):

```http
GET    /api/shares              # daftar seluruh tautan
POST   /api/shares              # { bucketName, permission, fileId?, label?, expiresInDays? }
PUT    /api/shares/:id          # { permission?, label? }
DELETE /api/shares/:id          # cabut tautan
```

Akses publik (tanpa autentikasi apa pun):

```http
GET    /api/share/:token                  # info tautan (izin, bucket, cakupan, masa berlaku)
GET    /api/share/:token/files            # daftar berkas (?page, ?limit, ?search)
POST   /api/share/:token/files            # unggah — hanya izin editor
DELETE /api/share/:token/files/:fileId    # hapus — hanya izin editor
GET    /s/:bucket/:file?id=<id>&share=<token>            # streaming / pratinjau
GET    /s/:bucket/:file?id=<id>&share=<token>&download=1 # paksa unduh (attachment)
```

Tautan yang tidak valid, sudah dicabut, atau kedaluwarsa selalu dijawab `404` yang sama, sehingga token tidak bisa ditebak dengan membedakan pesan galat.

> [!WARNING]
> Tautan **Unggah & Hapus** memberi orang tanpa akun kemampuan mengubah isi bucket. Gunakan masa berlaku, bagikan hanya ke pihak yang dipercaya, dan cabut setelah tidak diperlukan.

---

## Database: SQLite atau MySQL

Metadata (pengguna, bucket, berkas, API key, tautan berbagi) disimpan di salah satu dari dua engine, dipilih lewat `DB_CLIENT`. Berkas biner tetap di MinIO, apa pun pilihannya.

| | `sqlite` (bawaan) | `mysql` |
| --- | --- | --- |
| Setup | tanpa konfigurasi | butuh server MySQL/MariaDB |
| Lokasi data | `backend/data/database.sqlite` | database di server MySQL |
| Cocok untuk | pengembangan lokal | produksi, agar bisa dibackup lewat panel |

Konfigurasi di `.env`:

```ini
DB_CLIENT=mysql
DB_HOST=host.docker.internal   # MySQL yang berjalan di host, dari dalam container
DB_PORT=3306
DB_USER=nama_user
DB_PASSWORD=password_user
DB_NAME=nama_database
```

### Memindahkan data SQLite ke MySQL

```bash
cd /www/wwwroot/gentan.storage
docker compose run --rm -e DB_CLIENT=mysql app node dist/scripts/migrate-to-mysql.js
```

Skrip ini membuat skema, menyalin seluruh tabel sesuai urutan foreign key, menormalkan dua format tanggal peninggalan SQLite, lalu mencocokkan jumlah baris sumber dan tujuan. Skrip **menolak berjalan bila database tujuan sudah berisi data**, kecuali diberi `--replace`, supaya dua dataset tidak pernah tercampur diam-diam. Jalankan sebelum server pertama kali dinyalakan dengan `DB_CLIENT=mysql`, agar tidak ada admin bawaan yang ikut ter-seed.

Setelah migrasi sukses, ubah `DB_CLIENT=mysql` di `.env` lalu `docker compose up -d`. Berkas SQLite lama sengaja tidak dihapus dan bisa dipakai untuk kembali kapan saja.

### Dua syarat agar container bisa menjangkau MySQL di host

1. **Izin firewall.** Server ini memakai UFW dengan policy `DROP`, sehingga port 3306 tidak terjangkau dari jaringan Docker. Buka khusus untuk subnet bridge Docker, bukan untuk publik:

   ```bash
   ufw allow from 172.16.0.0/12 to any port 3306 proto tcp
   ```

2. **Izin host pada user database.** User yang dibuat panel biasanya hanya boleh terhubung dari `localhost`, sedangkan koneksi dari container datang sebagai `172.x.x.x`. Di aaPanel, buka Databases → pilih database → atur izin aksesnya agar mengizinkan koneksi dari luar localhost.

Tanpa keduanya, koneksi akan `ETIMEDOUT` (firewall) atau `ER_ACCESS_DENIED_ERROR` (izin host).

---

## Lokasi Deployment di Server

Stack berjalan di **`/www/wwwroot/gentan.storage`** pada VPS Server Gentan — direktori situs aaPanel yang isinya adalah clone repositori ini. Memperbarui aplikasi cukup:

```bash
cd /www/wwwroot/gentan.storage
git pull
docker compose up -d --build
```

Seluruh rahasia dibaca dari berkas `.env` di direktori yang sama (lihat `backend/.env.example` untuk daftar lengkapnya). Berkas itu tidak masuk Git, dan `docker-compose.yml` menandai `JWT_SECRET`, `MINIO_ROOT_USER`, serta `MINIO_ROOT_PASSWORD` sebagai wajib — stack menolak menyala kalau salah satunya kosong, supaya tidak pernah diam-diam memakai nilai bawaan yang terpampang di repositori ini.

Dua hal yang tidak boleh diubah sembarangan:

- **`name: object-storage` di `docker-compose.yml`.** Compose menurunkan nama project dari nama folder; tanpa baris ini, memindahkan direktori akan membuat volume `minio_data` baru yang kosong dan seluruh objek tersimpan menjadi tidak terjangkau.
- **Apache**, bukan nginx, yang aktif di server. Situs `gentan.storage` hanyalah *reverse proxy* ke `127.0.0.1:5000`, dikonfigurasi di `/www/server/panel/vhost/apache/extension/gentan.storage/reverse-proxy.conf`. Berkas itu diletakkan di direktori *extension* aaPanel supaya tetap bertahan ketika panel menulis ulang vhost utama.

PHP, MySQL, dan FTP yang ikut dibuat aaPanel bersama situs tidak dipakai sama sekali oleh aplikasi ini — aman untuk dihapus.

---

## Menghubungkan Domain (Cloudflare Tunnel)

Server ini berada di belakang NAT dan **tidak punya IPv4 publik sendiri**, jadi A record tidak bisa dipakai. Aplikasi dipublikasikan lewat **Cloudflare Tunnel**, yang membuat koneksi keluar dari server ke edge Cloudflare — tanpa port forwarding dan tanpa membuka port apa pun di router.

### Yang tidak diperlukan

Gentan Storage adalah aplikasi **Node.js di dalam Docker** yang mendengarkan di port `5000`, memakai **SQLite** untuk metadata dan **MinIO** untuk berkas. Jadi jangan membuat situs PHP di panel hosting: PHP, MySQL, FTP, dan direktori `/www/wwwroot/...` sama sekali tidak dipakai aplikasi ini.

### Langkah

1. Buka **Cloudflare Zero Trust → Networks → Tunnels**, pilih tunnel yang sudah berjalan di server.
2. Tab **Public Hostname → Add a public hostname**.
3. **Subdomain**: misal `storage` · **Domain**: domain Anda · **Path**: kosongkan.
4. **Service**: Type `HTTP`, URL `localhost:5000`.
5. Save. Cloudflare otomatis membuat DNS CNAME (proxied) dan menyediakan HTTPS.

> [!IMPORTANT]
> **Pakai subdomain satu tingkat.** Universal SSL gratis dari Cloudflare hanya mencakup `domain.com` dan `*.domain.com`. Nama seperti `gentan.storage.domain.com` berada dua tingkat di bawah zona dan **tidak tercakup**, sehingga pengunjung akan mendapat galat sertifikat kecuali Anda berlangganan Advanced Certificate Manager. Gunakan `gentan-storage.domain.com` atau `storage.domain.com`.

### Batas unggah lewat domain

Cloudflare plan Free dan Pro menolak body request di atas **100 MB**. Dasbor sudah menolak berkas sebesar itu lebih dulu dengan pesan yang jelas ketika diakses lewat HTTPS, agar tidak berujung pada halaman galat 413 dari Cloudflare. Untuk berkas lebih besar, unggah lewat alamat lokal server (`http://<ip-lan>:5000`) yang tidak melewati proxy.

### CORS

`CORS_ORIGIN` menerima `*` (bawaan) atau daftar origin dipisah koma:

```ini
CORS_ORIGIN=https://storage.domain.com,http://192.168.111.5:5000
```

Perlu diingat, membatasi daftar ini akan memutus aplikasi lain yang memanggil API dari peramban pada origin berbeda. Tag `<img>` dan `<video>` tidak terpengaruh CORS, begitu pula pemanggilan server-ke-server.

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
