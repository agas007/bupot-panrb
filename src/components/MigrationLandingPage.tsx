import { ArrowUpRight, FileSpreadsheet, ShieldCheck } from "lucide-react";

export function MigrationLandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070a12] px-6 py-12 text-white">
      <div className="w-full max-w-3xl text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-400 text-slate-950 shadow-[0_0_70px_rgba(34,211,238,0.25)]">
          <FileSpreadsheet size={42} strokeWidth={2.25} />
        </div>

        <p className="mb-4 text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">
          Informasi layanan Bupot PANRB
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
          Bupot sudah pindah ke alamat baru
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          Website lama ini sudah tidak menerima login maupun transaksi baru.
          Silakan gunakan website Bupot yang baru untuk melanjutkan pekerjaan.
        </p>

        <a
          href="https://bupot.menpan.go.id"
          className="mx-auto mt-9 inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-6 py-3.5 font-bold text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-[#070a12]"
        >
          Buka Bupot baru
          <ArrowUpRight size={19} />
        </a>

        <div className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-400">
          <ShieldCheck size={17} className="shrink-0 text-emerald-300" />
          Data dan transaksi baru diproses melalui alamat resmi yang baru.
        </div>
      </div>
    </main>
  );
}
