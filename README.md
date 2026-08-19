# Gentan Storage - Object Storage Server

Sistem penyimpanan objek (*Object Storage*) mandiri (self-hosted) yang ringan, berkinerja tinggi, dan aman. Proyek ini didesain khusus untuk dijalankan di VPS remote (seperti **Server Gentan** Anda) dengan antarmuka dasbor admin yang modern dan responsif.

## Fitur Utama

- 📂 **Bucket Management**: Buat, hapus, dan atur visibilitas bucket (Publik atau Privat).
- 🖼️ **Foto HEIC iPhone**: didekode di peramban agar tetap bisa dipratinjau, plus tombol unduh sebagai JPG untuk perangkat yang tidak mengenal HEIC.
- 📏 **Kuota per Bucket**: Batasi tiap bucket dalam MB/GB/TB, dengan bilah pemakaian di dasbor dan penolakan unggahan (HTTP 413) saat kuota habis.
- 📤 **Media Streamer & Range Queries**: Mendukung penuh pemutaran video dan audio langsung di peramban (HTTP 206 Partial Content) tanpa lemot/buffering berlebih.
- 🛡️ **Security-First Design**:
  - **Path Traversal Protection**: Semua file disimpan menggunakan identitas fisik UUID di disk lokal untuk mencegah serangan pembacaan file sistem (`../`).
  - **API Key Hashing**: Token integrasi disimpan dalam hash SHA-256 di database SQLite.
  - **Fallback Authentication**: Endpoint media `/s/...` menerima query string `?token=...` untuk pemutaran video/gambar privat langsung di HTML `<video>` / `<img>`. Endpoint `/api/*` hanya menerima header `Authorization`, agar token tidak tercatat di log proxy.
  - **Anti Stored-XSS**: Berkas yang bisa dieksekusi peramban (HTML, SVG) dipaksa menjadi unduhan `application/octet-stream`, bukan dirender inline dari origin dasbor.
  - **Pembatasan Percobaan Login**: Blokir per IP dan jeda menanjak per username, tanpa memberi penyerang cara mengunci akun admin.
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
   Lalu isi `JWT_SECRET` dengan nilai acak — **server menolak start bila belum diisi**:
   ```bash
   openssl rand -base64 48
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
   > Password ini tertulis di berkas README yang Anda baca sekarang, jadi ia bukan
   > rahasia. Selama masih dipakai, dasbor akan menampilkan spanduk merah dan
   > server mencatat peringatan di log setiap kali start. Ganti di tab
   > **Pengaturan** sebelum instance ini bisa dijangkau dari internet.

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

## Kuota Bucket

Setiap bucket bisa diberi batas penyimpanan sendiri, terlepas dari kapasitas disk server. Kuota diatur saat membuat bucket, atau kapan saja lewat tombol **kuota** (ikon meter) di baris bucket pada tab **Buckets**.

- Satuan yang tersedia: **MB**, **GB**, **TB**. Minimum 1 MB.
- **Kosongkan kolomnya untuk tanpa batas** — bucket hanya dibatasi kapasitas disk.
- Kolom *Ukuran / Kuota* menampilkan pemakaian beserta bilah warna: hijau, kuning mulai 90%, merah saat penuh.

Kuota dihitung dari total ukuran berkas yang terdaftar di bucket itu, bukan dari ukuran folder di disk. Unggahan yang akan melewati batas ditolak dengan **HTTP 413** beserta pesan berapa sisa ruangnya — berlaku sama untuk unggahan dari dasbor, dari API Key, maupun dari tautan berbagi bertipe *editor*.

Menurunkan kuota di bawah isi bucket saat ini **diizinkan** dan tidak menghapus berkas apa pun; efeknya hanya unggahan berikutnya ditolak sampai ada berkas yang dihapus. Dasbor memberi tahu bila kuota yang Anda simpan sudah terlampaui.

> [!NOTE]
> Pemeriksaan kuota dilakukan sebelum berkas dipindahkan ke storage. Dua unggahan yang berjalan bersamaan bisa lolos berbarengan dan membuat total sedikit melewati batas; unggahan setelahnya langsung ditolak. Kuota di sini adalah plafon, bukan pagar byte yang presisi.

Lewat API, kolomnya bernama `quotaBytes` (satuan byte, `null` berarti tanpa batas):

```bash
# Buat bucket dengan kuota 5 GB
curl -X POST http://localhost:5000/api/buckets   -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json"   -d '{"name":"foto-2026","isPublic":false,"quotaBytes":5368709120}'

# Ubah kuota bucket yang sudah ada (respons memuat usedBytes)
curl -X PUT http://localhost:5000/api/buckets/foto-2026   -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json"   -d '{"quotaBytes":10737418240}'

# Lepas kuota
curl -X PUT http://localhost:5000/api/buckets/foto-2026   -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json"   -d '{"quotaBytes":null}'
```

`PUT /api/buckets/:name` bersifat parsial: kirim `isPublic` saja, `quotaBytes` saja, atau keduanya. Kolom yang tidak dikirim tidak berubah.

## Format Berkas dan Foto HEIC

Unggahan menerima **semua format** — tidak ada penyaring jenis berkas. Yang berbeda hanyalah cara berkas disajikan kembali (lihat *Penyajian berkas* di bagian Keamanan).

### Tipe berkas disimpulkan dari ekstensi

Tipe MIME sebuah unggahan ditentukan oleh perangkat pengirim, dan peramban hanya mengenal ekstensi yang terdaftar di sistem operasinya. Chrome di Windows mengirim `application/octet-stream` untuk `.heic`, `.heif`, `.avif`, `.opus`, `.flac`, `.mkv`, `.m4v`, dan `.3gp` — sementara berkas yang sama dari iPhone datang dengan tipe yang benar. Akibatnya satu foto bisa berperilaku berbeda tergantung diunggah dari mana.

Server sekarang menyimpulkan tipe dari ekstensi **hanya bila** klien mengirim tipe generik atau kosong. Klien yang mengirim tipe sungguhan selalu dipercaya. Berkas yang sudah terlanjur tersimpan sebagai `application/octet-stream` diperbaiki otomatis saat server dijalankan.

### HEIC ditampilkan lewat dekoder di peramban

`.heic` adalah format bawaan foto iPhone, dan **tidak ada peramban selain Safari yang bisa menampilkannya** — seberapa benar pun tipe MIME-nya. Dasbor karena itu mendekodenya sendiri memakai libheif (WebAssembly, pustaka `heic-to`).

- Berkas dekodernya ±3 MB dan **dimuat hanya saat ada HEIC yang dibuka**, jadi tidak membebani pemuatan dasbor biasa.
- Dekode berjalan **satu per satu** untuk seluruh aplikasi, dan hasilnya di-cache. Membuka galeri berisi banyak HEIC akan mengisi thumbnail satu demi satu, bukan membekukan tab.
- Hasil dekode diperkecil sebelum disimpan di memori: thumbnail ke sisi terpanjang 480 px, tampilan besar ke 2000 px. Tanpa ini, satu foto 24 MP menyita ±4 MB memori tab.
- **Dekode itu mahal**: satu foto iPhone 24 MP butuh ±7 detik di peramban. Ini biaya HEVC di WebAssembly, bukan sesuatu yang bisa dihilangkan di sisi klien. Bila nanti terasa mengganggu, jalan keluarnya adalah membuat thumbnail di server saat unggah.

### Tombol "Unduh sebagai JPG"

Mengunduh HEIC apa adanya tidak selalu menolong: Windows tidak bisa membukanya tanpa *HEIF Image Extensions* dari Microsoft Store, dan kebanyakan aplikasi foto di luar ekosistem Apple menolaknya. Pada berkas HEIC, modal pratinjau menyediakan tombol **Unduh sebagai JPG** yang menyimpan salinan resolusi penuh dalam format yang bisa dibuka di mana saja. Tombol **Unduh** biasa tetap memberi berkas HEIC asli, byte per byte tanpa perubahan.

> [!NOTE]
> Menyajikan berkas tidak pernah mengubah isinya. Yang berubah hanya header HTTP: server memutuskan peramban sebaiknya *menampilkan* atau *menyimpan*. Berkas yang diunduh selalu identik dengan yang diunggah.

## Keamanan

Instance ini dipublikasikan ke internet lewat Cloudflare Tunnel, jadi pengamanannya diperlakukan sebagai bagian dari fitur, bukan tambahan.

### Sesi dan password

- **`JWT_SECRET` wajib**, minimal 32 karakter, dan tidak boleh nilai placeholder dari repo ini. Bila salah satu syarat tidak dipenuhi, server berhenti dengan pesan yang menjelaskan cara memperbaikinya. Dulu ada nilai bawaan di kode — siapa pun yang membaca repo bisa memalsukan token Super Admin.
- Umur token **24 jam** (bisa diatur lewat `JWT_EXPIRES_IN`), sebelumnya 7 hari.
- **Mengganti password mencabut semua sesi lama** akun itu, termasuk sesi yang mungkin sedang dipegang penyusup. Tab yang melakukan penggantian langsung mendapat token baru sehingga tidak perlu login ulang. Super Admin yang mereset password orang lain juga mengeluarkan sesi orang tersebut.
- Password minimal **10 karakter**, tidak boleh memuat username, dan tidak boleh berupa password yang sudah tersiar (termasuk `admingentan123`).
- Token sesi **hanya diterima dari header `Authorization`** pada endpoint `/api/*`. Sebelumnya `?token=` juga diterima, dan itu membuat token tercatat di log Apache, log Cloudflare, serta header `Referer`. Endpoint media `/s/...` tetap menerima `?token=` karena `<video>` dan `<img>` tidak bisa mengirim header.

### Percobaan login

- Per alamat IP: 15 kegagalan dalam 5 menit → diblokir 15 menit (**HTTP 429** dengan header `Retry-After`).
- Per username: **tidak pernah diblokir**, tetapi setiap kegagalan menambah jeda balasan 0,5 detik hingga maksimum 4 detik. Blokir per username akan memberi penyerang cara mengunci akun admin dengan sengaja; jeda yang menanjak membuat penebakan tersebar dari ribuan IP tetap tidak praktis tanpa menutup pintu bagi pemilik akun.
- Username yang tidak ada tetap diperiksa terhadap hash tiruan, supaya lama respons tidak membocorkan akun mana yang benar-benar ada.
- Endpoint tautan berbagi dibatasi 120 permintaan per menit per IP.

### Penyajian berkas

Tipe MIME sebuah berkas ditentukan oleh pengunggah, dan berkas disajikan dari origin yang sama dengan dasbor. Berkas HTML atau SVG yang dirender langsung bisa membaca token sesi dari `localStorage`. Karena itu:

- Hanya **gambar (kecuali SVG), video, audio, PDF, dan teks biasa** yang disajikan `inline`.
- Tipe lain dipaksa menjadi `Content-Disposition: attachment` dengan `Content-Type: application/octet-stream` plus `Content-Security-Policy: default-src 'none'; sandbox`.
- Semua respons berkas membawa `X-Content-Type-Options: nosniff`.
- Nama berkas pada header `Content-Disposition` di-escape (bentuk ASCII bersih + `filename*=UTF-8''`), sehingga nama bertanda kutip atau berisi baris baru tidak bisa memecah atau menyuntikkan header.

### Header dan konfigurasi

- Dasbor dikirim dengan `Content-Security-Policy` yang membatasi skrip ke bundle sendiri, ditambah `Cross-Origin-Opener-Policy`.
- Semua respons: `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, dan `Strict-Transport-Security` saat diakses lewat HTTPS.
- `X-Powered-By` dimatikan; body JSON dibatasi 256 KB.
- `TRUST_PROXY` default `loopback` sehingga hanya reverse proxy di mesin yang sama boleh menetapkan `X-Forwarded-For`. Alamat asli pengunjung dibaca dari `CF-Connecting-IP`, tetapi **hanya** bila permintaan datang lewat proxy lokal — klien di LAN yang menembak port 5000 langsung tidak bisa memalsukannya untuk mengelabui pembatas login.

### Yang masih perlu Anda kerjakan sendiri

- **API Key belum punya cakupan**: satu key berlaku untuk semua bucket, dan boleh menghapus berkas. Perlakukan setiap key seperti password Super Admin, dan cabut yang tidak dipakai.
- `?api_key=` masih diterima di endpoint `/api/*` agar skrip lama tidak rusak. Kalau bisa, pindahkan ke header `X-API-Key` supaya key tidak tercatat di log.
- **Port MinIO (9001 dan 9010) jangan dipublikasikan** lewat tunnel atau firewall. Keduanya dirancang untuk diakses dari LAN/Tailscale saja.
- `CORS_ORIGIN` bawaan `*`. Bila hanya dasbor sendiri yang memakai API, isi daftar origin yang spesifik.
- Belum ada catatan audit (siapa mengunggah atau menghapus apa).

## Peran Pengguna (Role)

Setiap akun memiliki salah satu dari dua peran. Pembatasan diterapkan di sisi server, bukan sekadar disembunyikan di antarmuka.

| Kemampuan | Super Admin | User Biasa |
| --- | :---: | :---: |
| Melihat daftar bucket dan berkas | ✅ | ✅ |
| Mengunggah berkas | ✅ | ✅ |
| Mengunduh / streaming berkas | ✅ | ✅ |
| Menghapus berkas | ✅ | ❌ |
| Membuat, mengubah, menghapus bucket | ✅ | ❌ |
| Mengatur kuota bucket | ✅ | ❌ |
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

> [!IMPORTANT]
> Aplikasi kini juga menolak start bila `JWT_SECRET` **kurang dari 32 karakter** atau masih berisi placeholder `ganti_dengan_nilai_acak_yang_panjang`. Periksa sebelum `git pull` berikutnya:
> ```bash
> cd /www/wwwroot/gentan.storage
> awk -F= '/^JWT_SECRET=/{print length($2)" karakter"}' .env
> ```
> Kalau kurang dari 32, ganti dulu (`openssl rand -base64 48`). Menggantinya mengeluarkan semua sesi dasbor yang sedang aktif — cukup login ulang.

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
