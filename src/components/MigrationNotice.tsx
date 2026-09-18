export function MigrationNotice() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
        <p className="text-sm font-medium">
          Informasi layanan: akses Bupot sekarang melalui alamat baru
          <span className="mx-1 font-bold">bupot.menpan.go.id</span>.
        </p>
        <a
          href="https://bupot.menpan.go.id"
          className="shrink-0 rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
        >
          Buka alamat baru
        </a>
      </div>
    </div>
  );
}
