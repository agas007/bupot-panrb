# Bupot PANRB 📄

**Monitoring Bukti Potong - Kementerian PANRB**

Bupot PANRB adalah aplikasi internal untuk mendata, memonitor, dan menata bukti potong pajak (SPM/SP2D) secara efisien bagi pegawai di lingkungan Kementerian PANRB.

## 🚀 Fitur Utama

- **Import Excel Pintar**: Menggabungkan data dari dua sumber Excel berbeda secara otomatis menggunakan *Smart Matching*.
- **Task Management**: Penugasan bukti potong ke kolega/staff tertentu.
- **Monitoring Real-time**: Dashboard pemantauan status penyelesaian dokumen (Pending/Completed).
- **Analytics Dashboard**: Visualisasi data menggunakan grafik interaktif untuk melihat beban kerja dan progress.
- **Data Persistence**: Menggunakan database PostgreSQL (Neon) dengan Prisma ORM.

## 🛠️ Tech Stack

- **Frontend**: [Next.js 15+](https://nextjs.org/) (App Router), React 19
- **Database**: PostgreSQL via [Neon](https://neon.tech/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Styling**: Tailwind CSS & Lucide Icons
- **Charts**: Recharts
- **Excel Processor**: SheetJS (xlsx)

## 📦 Instalasi Lokal

1. **Clone Repository**:
   ```bash
   git clone git@gitlab.com:kemenpan-developer/bupot-panrb.git
   cd bupot-panrb
   ```

2. **Install Dependensi**:
   ```bash
   npm install
   ```

3. **Setup Environment**:
   Buat file `.env` di root directory:
   ```env
   DATABASE_URL="postgres://user:password@hostname/neondb?sslmode=require"
   ```

4. **Migrasi Database**:
   ```bash
   npx prisma db push
   ```

5. **Jalankan Aplikasi**:
   ```bash
   npm run dev
   ```

## 🌐 Deployment

Aplikasi ini dirancang untuk dideploy ke **Vercel**:

1. Push kodenya ke repo (GitHub/GitLab).
2. Hubungkan repo ke Vercel Dashboard.
3. Masukkan `DATABASE_URL` di Environment Variables.
4. Vercel akan otomatis melakukan build dan deploy.

---
Dikembangkan oleh Tim Developer Kemenpan.
