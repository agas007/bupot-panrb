export function TableSkeletonRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  const widths = ["w-4/5", "w-3/5", "w-full", "w-2/3", "w-1/2"];
  return Array.from({ length: rows }, (_, row) => (
    <tr key={`skeleton-${row}`} className="animate-pulse" aria-hidden="true">
      {Array.from({ length: columns }, (__, column) => (
        <td key={column} className="p-4">
          <div className={`h-4 ${widths[(row + column) % widths.length]} rounded-md bg-muted-foreground/12`} />
          {(row + column) % 3 === 0 && <div className="mt-2 h-3 w-2/5 rounded-md bg-muted-foreground/8" />}
        </td>
      ))}
    </tr>
  ));
}

export function RecipientCardSkeletons({ count = 4 }: { count?: number }) {
  return <div className="grid gap-4" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <div key={index} className="glass-card animate-pulse p-5">
      <div className="flex justify-between gap-4"><div className="space-y-2"><div className="h-5 w-52 rounded-md bg-muted-foreground/12"/><div className="h-3 w-36 rounded-md bg-muted-foreground/8"/></div><div className="h-9 w-40 rounded-xl bg-muted-foreground/10"/></div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (__, item) => <div key={item} className="h-16 rounded-xl bg-muted-foreground/8"/>)}</div>
    </div>)}
  </div>;
}
