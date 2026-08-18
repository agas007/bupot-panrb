# Bupot PANRB 📄

**Monitoring Bukti Potong - Kementerian PANRB**

Bupot PANRB adalah aplikasi internal untuk mendata, memonitor, dan menata bukti potong pajak (SPM/SP2D) secara efisien bagi pegawai di lingkungan Kementerian PANRB.

## 🚀 Fitur Utama

- **Import Excel Pintar**: Menggabungkan data dari dua sumber Excel berbeda secara otomatis menggunakan *Smart Matching*.
- **Task Management**: Penugasan bukti potong ke kolega/staff tertentu.
- **Monitoring Real-time**: Dashboard pemantauan status penyelesaian dokumen (Pending/Completed).
- **Analytics Dashboard**: Visualisasi data menggunakan grafik interaktif untuk melihat beban kerja dan progress.
- **Data Persistence**: Menggunakan database PostgreSQL dengan Prisma ORM.
- **Graphify Knowledge Graph**: Membuat graph relasi kode, dokumen, dan konfigurasi supaya eksplorasi repo lebih cepat tanpa grepping manual.

## 🛠️ Tech Stack

- **Frontend**: [Next.js 16.2.2](https://nextjs.org/) (App Router), React 19.2.4
- **Database**: PostgreSQL self-hosted atau managed
- **ORM**: [Prisma 6.2.1](https://www.prisma.io/)
- **Styling**: Tailwind CSS 4.2.2 & Lucide Icons 1.7.0
- **Charts**: Recharts 3.8.1
- **Excel Processor**: SheetJS (xlsx) latest
- **Graph**: [Graphify](https://github.com/Graphify-Labs/graphify)

## 📦 Dependencies Utama

- `@prisma/client` `^6.2.1`
- `prisma` `^6.2.1`
- `react` `19.2.4`
- `react-dom` `19.2.4`
- `next` `16.2.2`
- `eslint-config-next` `16.2.2`
- `tailwindcss` `^4.2.2`
- `@tailwindcss/postcss` `^4.2.2`
- `recharts` `^3.8.1`
- `lucide-react` `^1.7.0`
- `bcryptjs` `^3.0.3`
- `jspdf` `^4.2.1`
- `jspdf-autotable` `^5.0.7`
- `swagger-jsdoc` `^6.2.8`
- `swagger-ui-react` `^5.32.1`
- `next-swagger-doc` `^0.4.1`
- `xlsx` `https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`

## 📦 Instalasi Lokal

1. **Clone Repository**:
   ```bash
   git clone git@github.com:agas007/bupot-panrb.git
   cd bupot-panrb
   ```

2. **Install Dependensi**:
   ```bash
   npm install
   ```

3. **Siapkan Graphify**:
   ```bash
   pipx install graphifyy
   # atau: uv tool install graphifyy
   graphify install
   graphify .
   ```
   Hasil visualisasi graph akan tersimpan di `graphify-out/graph.html` dan `graphify-out/GRAPH_REPORT.md`.

4. **Setup Environment**:
   Buat file `.env` di root directory:
   ```env
   DATABASE_URL="postgresql://user:password@hostname:5432/neondb"
   ```

5. **Migrasi Database**:
   ```bash
   npx prisma db push
   ```

6. **Jalankan Aplikasi**:
   ```bash
   npm run dev
   ```

## 🔎 Graphify

Setelah graph terbentuk, kamu bisa query repo langsung dari CLI:

```bash
graphify query "how does authentication work?"
graphify path "Auth" "Database"
graphify explain "SPMRecord"
```

Untuk MCP server, Graphify bisa dijalankan dari graph yang sudah dibuat:

```bash
python -m graphify.serve graphify-out/graph.json
```

## 🌐 Deployment

Aplikasi ini dirancang untuk dideploy ke **Vercel**:

1. Push kodenya ke repo (GitHub/GitLab).
2. Hubungkan repo ke Vercel Dashboard.
3. Masukkan `DATABASE_URL` di Environment Variables.
4. Vercel akan otomatis melakukan build dan deploy.
5. Pastikan database bisa diakses publik dari Vercel, atau gunakan managed database yang memang terbuka dari internet.

---
Dikembangkan oleh Tim Developer Kemenpan.
