# Project Memory - Gentan Storage

## Status Terakhir
Seluruh komponen dasar Object Storage (**Gentan Storage**) untuk VPS Server Gentan telah selesai dikembangkan, divalidasi, dan diuji kompilasinya baik untuk sisi backend maupun frontend. Dukungan folder pada tautan berbagi publik (dengan opsi editor) dan perbaikan unggah banyak file sekaligus dari perangkat seluler telah diimplementasikan dan diverifikasi berjalan dengan baik.

## Catatan Environment & Teknologi
- **Workspace**: `D:\Coding\Object Storage`
- **Backend API**:
  - Node.js (ES Modules, TypeScript, Express).
  - Database: SQLite (menggunakan library `sqlite` dan `sqlite3`).
  - File Upload: Multer (menyimpan file fisik dengan UUID dan ekstensi `.dat` di folder `backend/data/storage/` untuk mencegah path traversal).
  - Autentikasi: JWT (untuk dasbor) dan SHA-256 Hashed API Keys (untuk akses programmatic luar).
  - Fitur Khusus: Dukungan HTTP Range Queries (status `206 Partial Content`) untuk streaming video/audio yang mulus di browser.
- **Frontend Dashboard**:
  - React v19, Vite, TypeScript.
  - Styling: Vanilla CSS dengan sistem warna modern OKLCH dan neutral-tinted dark mode.
  - Iconography: Lucide-react (tidak memakai emoji di antarmuka UI sesuai standar anti-slop).
  - Kompatibilitas Media: Menampilkan visual preview untuk foto dan menyertakan HTML5 media player untuk file video.

## Riwayat Pekerjaan & Progress
1. **Rencana Arsitektur**: Membuat berkas [ARCHITECTURE.md](file:///C:/Users/U%20S%20E%20R/.gemini/antigravity-cli/brain/cc244975-720f-4f64-ad97-6bfa0d6081ed/ARCHITECTURE.md) yang menjelaskan skema DB, model keamanan, dan alur performa.
2. **Inisialisasi Proyek**:
   - Menyiapkan `backend/package.json` dan `tsconfig.json`.
   - Menginisialisasi frontend React menggunakan `create-vite` di folder `web/`.
3. **Pembangunan Sisi Backend**:
   - `utils/db.ts`: Inisialisasi SQLite, pembuatan tabel, indeks performa, dan seeding admin default (`admin` / `admingentan123`).
   - `middleware/auth.ts`: Middleware pemrosesan token JWT dan kecocokan hash API key.
   - `controllers/authController.ts`: Handler login, ganti password, dan metadata/disk statistik VPS.
   - `controllers/bucketController.ts`: Manajemen CRUD bucket dan penghapusan fisik file di disk lokal VPS.
   - `controllers/fileController.ts`: Handler upload (Multer), listing, penghapusan, dan streaming/download dengan range support.
   - `controllers/keyController.ts`: Manajemen pembuatan dan pencabutan API Key kriptografis.
   - `server.ts`: Konfigurasi routing Express, CORS, dan penyajian static React assets dari folder `../web/dist`.
4. **Pembangunan Sisi Frontend**:
   - `index.css`: Implementasi design tokens dengan OKLCH, layout sidebar, dan flex grid.
   - `context/AuthContext.tsx`: Mengatur state token admin, auto-logout, dan custom fetch wrapper.
   - `App.tsx`: Seluruh fungsionalitas visual dasbor admin (tabel bucket, upload dropzone, streaming previews, generator tautan, manajemen API key, dan ubah password).
5. **Quality Assurance & Perbaikan Tipe**:
   - Menyelesaikan error kompilasi TypeScript terkait variable tidak terpakai (`Shield`, `ExternalLink`, `statsLoading`, `useEffect`), safe token parameter checking (`token?.substring`), dan style property typo (`justifyCenter` -> `justifyContent`).
   - Memastikan `npm run build` sukses 100% untuk backend dan frontend.
6. **Integrasi MinIO & Git Push**:
   - Menghubungkan repositori lokal dan melakukan *initial commit*.
   - Melakukan push kode dasar ke repositori GitHub privat pengguna di `https://github.com/Stevano016/object-storage.git`.
   - Mengembangkan `storageProvider.ts` untuk abstraksi penyimpanan dinamis (`local` atau `minio`/`s3`).
   - Mengintegrasikan AWS S3 SDK pada `bucketController.ts` dan `fileController.ts` agar mendukung unggah, hapus, dan stream data privat langsung ke server MinIO.
   - Membuat file `docker-compose.yml` untuk mempermudah pemasangan dan hosting mandiri (*self-host*) kontainer MinIO di VPS Server Gentan.
   - Mengunggah revisi kode integrasi MinIO ini ke GitHub pada commit kedua.
7. **Penyempurnaan Tautan Berbagi Publik & Unggah Seluler**:
   - Menambahkan navigasi dan pembuatan folder di dalam tautan berbagi publik (`shareController.ts`, `SharePage.tsx`, `useShareBrowser.ts`).
   - Menyempurnakan elemen input file pada `UploadModal.tsx` agar tidak menggunakan `display: none`, melainkan memposisikannya secara transparan di dalam layout. Hal ini menyelesaikan batasan pada iOS Safari/Chrome Seluler sehingga pengguna dapat memilih dan mengunggah banyak berkas secara bersamaan.

## Kredensial Default (Inisialisasi)
- **Username**: `admin`
- **Password**: `admingentan123`
- *Catatan: Sistem akan otomatis menginstruksikan pengguna untuk mengubah password pada login pertama.*

## Langkah Selanjutnya (Untuk User)
1. Jalankan aplikasi di lokal terlebih dahulu untuk pengujian (`npm run dev` pada backend dan frontend).
2. Nyalakan layanan MinIO di VPS Anda menggunakan perintah `docker compose up -d` di root folder.
3. Ubah setting `STORAGE_PROVIDER` ke `minio` pada file `.env` di server backend Anda, lalu masukkan kredensial MinIO Anda.
4. Ikuti instruksi pada [README.md](file:///D:/Coding/Object/Storage/README.md) bagian "Panduan Deployment ke VPS" untuk memindahkan dan menjalankan aplikasi di **Server Gentan (VPS)** menggunakan **PM2**.
