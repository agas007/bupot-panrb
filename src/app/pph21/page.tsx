"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Loader2, Plus, ReceiptText, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PPH21_TAX_OBJECTS } from "@/lib/pph21";
import { RecipientCardSkeletons, TableSkeletonRows } from "@/components/TableSkeleton";

type Code = keyof typeof PPH21_TAX_OBJECTS;
type Line = { nik: string; name: string; taxObjectCode: Code; gross: string };
type Batch = { id: number; status: string; withholdingDate: string | null; issueNotes?: string | null; _count?: { withholdings: number }; withholdings?: Array<{ id: number; recipient: { nik: string; name: string }; recipientName: string; taxObjectCode: Code; gross: number; calculatedTax: number }> };
type RecordRow = { id: number; spmNumber: string; sp2dNumber: string | null; sp2dDate: string | null; deductionAmount: number; recipient?: string | null; canManage: boolean; pph21Batch: Batch | null };
type Recipient = { id: number; nik: string; name: string; defaultTaxObjectCode: Code; transactionCount: number; totalGross: number; totalTax: number; exportedGross: number; exportedTax: number; monthlySummary: Array<{ period: string; count: number; gross: number; tax: number }>; transactions: Array<{ id: number; spmNumber: string; sp2dNumber: string | null; sp2dDate: string | null; status: string; taxObjectCode: string; gross: number; calculatedTax: number }> };
type ImportReport = { fileName: string; totalRows: number; totalDocuments: number; importedCount: number; matchCount: number; mismatchCount: number; notFoundCount: number; groups: Array<{ documentNumber: string; spmNumber: string | null; recipientCount: number; xmlGross: number; xmlTax: number; sp2dDeduction: number | null; difference: number | null; status: "IMPORTED" | "MISMATCH" | "NOT_FOUND" | "ALREADY_FILLED" | "FORBIDDEN" | "INVALID_DATES" }> };

const codes = Object.keys(PPH21_TAX_OBJECTS) as Code[];
const money = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const emptyLine = (): Line => ({ nik: "", name: "", taxObjectCode: "21-402-02", gross: "" });
const pph21ProcessBadgeClass = (status?: string | null) => {
  if (status === "COMPLETED" || status === "DATA_ENTERED") return "badge-completed";
  if (status === "ISSUES") return "bg-rose-500/10! text-rose-600!";
  return "badge-pending";
};

export default function Pph21Page() {
  const { user, isAdmin, getAuthHeaders, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<"sp2d" | "recipients">("sp2d");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [search, setSearch] = useState("");
  const [recipientTaxObjectFilter, setRecipientTaxObjectFilter] = useState<"all" | Code>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [withholdingDate, setWithholdingDate] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [issueNotes, setIssueNotes] = useState("");
  const [expandedRecipient, setExpandedRecipient] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [isImportingXml, setIsImportingXml] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [isRecipientsLoading, setIsRecipientsLoading] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  const loadRecipients = useCallback(async () => {
    if (!user) return;
    setIsRecipientsLoading(true);
    try {
      const response = await fetch("/api/pph21/recipients", { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Gagal memuat master penerima");
      setRecipients(await response.json());
    } finally { setIsRecipientsLoading(false); }
  }, [getAuthHeaders, user]);

  const openEditor = useCallback(async (record: RecordRow) => {
    setBusy(true); setFeedback(null);
    try {
      const [detailRes] = await Promise.all([
        fetch(`/api/pph21?recordId=${record.id}`, { headers: getAuthHeaders() }),
        recipients.length === 0 ? loadRecipients() : Promise.resolve(),
      ]);
      if (!detailRes.ok) throw new Error("Gagal memuat rincian PPh 21");
      const detail: RecordRow = await detailRes.json();
      setEditing(detail);
      setWithholdingDate(detail.pph21Batch?.withholdingDate?.slice(0, 10) || "");
      setLines(detail.pph21Batch?.withholdings?.length ? detail.pph21Batch.withholdings.map((line) => ({ nik: line.recipient.nik, name: line.recipientName, taxObjectCode: line.taxObjectCode, gross: String(line.gross) })) : [emptyLine()]);
      setIssueNotes(detail.pph21Batch?.issueNotes || "");
    } catch (error) { setFeedback({ type: "error", message: error instanceof Error ? error.message : "Gagal memuat rincian" }); }
    finally { setBusy(false); }
  }, [getAuthHeaders, loadRecipients, recipients.length]);

  const load = useCallback(async () => {
    if (!user) return;
    setIsTableLoading(true);
    try {
      const headers = getAuthHeaders();
      const recordRes = await fetch("/api/pph21", { headers });
      if (!recordRes.ok) throw new Error("Gagal memuat data PPh 21");
      const recordData = await recordRes.json();
      setRecords(recordData);
      const requestedId = Number(new URLSearchParams(window.location.search).get("recordId"));
      if (requestedId) {
        const requested = recordData.find((item: RecordRow) => item.id === requestedId);
        if (requested) void openEditor(requested);
        window.history.replaceState({}, "", "/pph21");
      }
    } finally { setIsTableLoading(false); }
  }, [getAuthHeaders, openEditor, user]);

  useEffect(() => { if (!authLoading && user) void load().catch((error) => setFeedback({ type: "error", message: error.message })); }, [authLoading, load, user]);
  useEffect(() => { if (tab === "recipients" && recipients.length === 0) void loadRecipients().catch((error) => setFeedback({ type: "error", message: error.message })); }, [loadRecipients, recipients.length, tab]);

  function chooseRecipient(index: number, nik: string) {
    const recipient = recipients.find((item) => item.nik === nik);
    setLines((current) => current.map((line, i) => i === index ? { ...line, nik, name: recipient?.name || line.name, taxObjectCode: recipient?.defaultTaxObjectCode || line.taxObjectCode } : line));
  }

  const editorTax = useMemo(() => lines.reduce((sum, line) => {
    const rule = PPH21_TAX_OBJECTS[line.taxObjectCode];
    return sum + Math.floor((Number(line.gross) || 0) * rule.deemed / 100 * rule.rate / 100);
  }, 0), [lines]);

  async function saveDetails() {
    if (!editing) return;
    setBusy(true); setFeedback(null);
    try {
      const res = await fetch("/api/pph21", { method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ recordId: editing.id, withholdingDate, lines }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFeedback({ type: data.isBalanced ? "success" : "error", message: data.isBalanced ? "Rincian tersimpan dan total pajak cocok." : `Tersimpan, tetapi total pajak Rp${money.format(data.totalTax)} belum sama dengan potongan Rp${money.format(data.expectedTax)}.` });
      await load(); setEditing(null);
    } catch (error) { setFeedback({ type: "error", message: error instanceof Error ? error.message : "Gagal menyimpan" }); }
    finally { setBusy(false); }
  }

  async function setIssue() {
    if (!editing) return;
    const res = await fetch("/api/pph21", { method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ recordId: editing.id, status: "ISSUES", issueNotes }) });
    const data = await res.json();
    if (!res.ok) return setFeedback({ type: "error", message: data.error });
    await load(); setEditing(null); setFeedback({ type: "success", message: "Status ISSUES disimpan." });
  }

  async function exportXml() {
    if (!selected.size) return setFeedback({ type: "error", message: "Pilih minimal satu SP2D." });
    setBusy(true); setFeedback(null);
    try {
      const res = await fetch("/api/pph21/export", { method: "POST", headers: { ...getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ recordIds: Array.from(selected) }) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error); }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || "Bupot_PPh21.xml";
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url);
      setSelected(new Set()); await load(); setFeedback({ type: "success", message: "XML berhasil dibuat. Status SP2D menjadi COMPLETED." });
    } catch (error) { setFeedback({ type: "error", message: error instanceof Error ? error.message : "Export gagal" }); }
    finally { setBusy(false); }
  }

  async function updateRecipient(recipient: Recipient) {
    const res = await fetch("/api/pph21/recipients", { method: "PATCH", headers: { ...getAuthHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ id: recipient.id, name: recipient.name, defaultTaxObjectCode: recipient.defaultTaxObjectCode }) });
    const data = await res.json(); if (!res.ok) return setFeedback({ type: "error", message: data.error });
    await loadRecipients(); setFeedback({ type: "success", message: "Master penerima diperbarui tanpa mengubah histori." });
  }

  async function checkImportedXml(file: File) {
    setBusy(true); setIsImportingXml(true); setFeedback(null);
    try {
      const formData = new FormData(); formData.append("xml", file);
      const res = await fetch("/api/pph21/import", { method: "POST", headers: getAuthHeaders(), body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportReport(data);
      await Promise.all([load(), loadRecipients()]);
      setFeedback({ type: data.mismatchCount || data.notFoundCount ? "error" : "success", message: `${data.importedCount} SP2D berhasil diisi, ${data.mismatchCount} selisih, ${data.notFoundCount} tidak ditemukan.` });
    } catch (error) { setFeedback({ type: "error", message: error instanceof Error ? error.message : "Gagal memeriksa XML" }); }
    finally { setBusy(false); setIsImportingXml(false); }
  }

  const visibleRecords = records.filter((record) => [record.spmNumber, record.sp2dNumber, record.recipient].some((value) => value?.toLowerCase().includes(search.toLowerCase())));
  const visibleRecipients = recipients.filter((recipient) => {
    const matchesSearch = `${recipient.name} ${recipient.nik}`.toLowerCase().includes(search.toLowerCase());
    const matchesTaxObject = recipientTaxObjectFilter === "all" || recipient.defaultTaxObjectCode === recipientTaxObjectFilter;
    return matchesSearch && matchesTaxObject;
  });

  return <div className="flex flex-col gap-6 pb-10 text-left">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-3xl font-black flex items-center gap-3"><ReceiptText className="text-accent" /> PPh 21</h1>
        <p className="text-sm text-muted-foreground mt-1">Master penerima, rincian SP2D, dan export XML Coretax.</p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end lg:w-auto">
        <label className={`w-full sm:w-auto px-5 py-3 rounded-xl border border-accent/30 text-accent font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-accent/10 ${isImportingXml ? "opacity-80 pointer-events-none" : ""}`}>
          {isImportingXml ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17}/>}
          {isImportingXml ? "Mengimpor XML..." : "Import & Check XML"}
          <input type="file" accept=".xml,application/xml,text/xml" className="hidden" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void checkImportedXml(file); event.target.value = ""; }}/>
        </label>
        <button onClick={exportXml} disabled={busy || !selected.size} className="w-full sm:w-auto premium-button px-5 py-3 flex items-center justify-center gap-2 disabled:opacity-40">
          <Download size={17} /> Export {selected.size} SP2D ke XML
        </button>
      </div>
    </header>
    {feedback && <div className={`p-4 rounded-2xl border flex items-center gap-3 ${feedback.type === "error" ? "bg-rose-500/10 border-rose-500/20 text-rose-600" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"}`}>{feedback.type === "error" ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>} {feedback.message}</div>}
    {importReport && <section className="glass-card p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-lg">Hasil import dan pengecekan XML</h2><p className="text-sm text-muted-foreground">{importReport.fileName} · {importReport.totalRows} recipient dalam {importReport.totalDocuments} SP2D</p></div><button onClick={() => setImportReport(null)}><X size={20}/></button></div><div className="grid grid-cols-3 gap-3 mt-4"><div className="rounded-xl bg-emerald-500/10 text-emerald-600 p-3"><div className="text-xs font-bold uppercase">Berhasil diisi</div><div className="text-2xl font-black">{importReport.importedCount}</div></div><div className="rounded-xl bg-amber-500/10 text-amber-600 p-3"><div className="text-xs font-bold uppercase">Selisih</div><div className="text-2xl font-black">{importReport.mismatchCount}</div></div><div className="rounded-xl bg-rose-500/10 text-rose-600 p-3"><div className="text-xs font-bold uppercase">Tidak ditemukan</div><div className="text-2xl font-black">{importReport.notFoundCount}</div></div></div><div className="overflow-x-auto mt-4"><table className="premium-table min-w-[850px]"><thead><tr><th>Document / SP2D</th><th>Recipient</th><th>Gross XML</th><th>Pajak XML</th><th>Potongan SP2D</th><th>Selisih</th><th>Hasil</th></tr></thead><tbody>{importReport.groups.map((group) => <tr key={group.documentNumber}><td><div className="font-bold">{group.documentNumber}</div><div className="text-xs text-muted-foreground">{group.spmNumber || "SP2D tidak ditemukan"}</div></td><td>{group.recipientCount}</td><td>Rp{money.format(group.xmlGross)}</td><td>Rp{money.format(group.xmlTax)}</td><td>{group.sp2dDeduction === null ? "—" : `Rp${money.format(group.sp2dDeduction)}`}</td><td>{group.difference === null ? "—" : `Rp${money.format(group.difference)}`}</td><td><span className={`badge ${group.status === "IMPORTED" || group.status === "ALREADY_FILLED" ? "badge-completed" : "bg-amber-500/10! text-amber-600!"}`}>{group.status}</span></td></tr>)}</tbody></table></div></section>}
    <div className="flex flex-col md:flex-row gap-3 justify-between">
      <div className="flex bg-muted p-1 rounded-xl">
        <button onClick={() => setTab("sp2d")} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === "sp2d" ? "bg-background shadow" : "text-muted-foreground"}`}>SP2D PPh 21</button>
        <button onClick={() => setTab("recipients")} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === "recipients" ? "bg-background shadow" : "text-muted-foreground"}`}>Master Penerima</button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, NIK, SPM, atau SP2D" className="bg-muted rounded-xl pl-10 pr-4 py-2.5 outline-none min-w-[300px]"/>
        </div>
        {tab === "recipients" && (
          <select
            value={recipientTaxObjectFilter}
            onChange={(e) => setRecipientTaxObjectFilter(e.target.value as "all" | Code)}
            className="bg-muted rounded-xl px-4 py-2.5 outline-none text-sm min-w-[220px]"
          >
            <option value="all">Semua tax object code</option>
            {codes.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        )}
      </div>
    </div>

    {tab === "sp2d" ? <div className="glass-card overflow-x-auto"><table className="premium-table"><thead><tr><th></th><th>SPM / SP2D</th><th>Tanggal SP2D</th><th>Potongan</th><th>Recipients</th><th>PPh 21 Process</th><th>Aksi</th></tr></thead><tbody>{isTableLoading ? <TableSkeletonRows columns={7} rows={7}/> : visibleRecords.map((record) => <tr key={record.id}><td><input type="checkbox" disabled={!record.canManage} checked={selected.has(record.id)} onChange={(e) => setSelected((current) => { const next = new Set(current); if (e.target.checked) next.add(record.id); else next.delete(record.id); return next; })}/></td><td><div className="font-bold">{record.spmNumber}</div><div className="text-xs text-muted-foreground">{record.sp2dNumber || "Belum terbit"}</div></td><td>{record.sp2dDate ? new Date(record.sp2dDate).toLocaleDateString("id-ID") : "—"}</td><td>Rp{money.format(record.deductionAmount)}</td><td>{record.pph21Batch?._count?.withholdings ?? record.pph21Batch?.withholdings?.length ?? 0}</td><td><span className={`badge ${pph21ProcessBadgeClass(record.pph21Batch?.status)}`}>{record.pph21Batch?.status || "PENDING"}</span>{record.pph21Batch?.issueNotes && <div className="text-xs text-amber-600 mt-1">{record.pph21Batch.issueNotes}</div>}</td><td><button disabled={!record.canManage || busy} onClick={() => void openEditor(record)} className="text-accent font-bold text-xs hover:underline disabled:opacity-30">Kelola rincian</button></td></tr>)}</tbody></table></div> :
    isRecipientsLoading ? <RecipientCardSkeletons/> : <div className="grid gap-4">{visibleRecipients.map((recipient) => <section key={recipient.id} className="glass-card p-5"><div className="flex flex-col lg:flex-row justify-between gap-4"><div><input disabled={!isAdmin} value={recipient.name} onChange={(e) => setRecipients((items) => items.map((item) => item.id === recipient.id ? { ...item, name: e.target.value } : item))} className="font-black text-lg bg-transparent border-b border-transparent focus:border-accent outline-none disabled:opacity-100"/><div className="font-mono text-sm text-muted-foreground">{recipient.nik}</div></div><div className="flex gap-2 items-center"><select disabled={!isAdmin} value={recipient.defaultTaxObjectCode} onChange={(e) => setRecipients((items) => items.map((item) => item.id === recipient.id ? { ...item, defaultTaxObjectCode: e.target.value as Code } : item))} className="bg-muted rounded-xl p-2 text-sm disabled:opacity-70">{codes.map((code) => <option key={code}>{code}</option>)}</select>{isAdmin && <button onClick={() => updateRecipient(recipient)} className="p-2 text-accent" title="Simpan default"><Save size={17}/></button>}<button onClick={() => setExpandedRecipient(expandedRecipient === recipient.id ? null : recipient.id)} className="px-3 py-2 rounded-xl bg-muted text-xs font-bold">{recipient.transactionCount} transaksi</button></div></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4"><Stat label="Total Gross" value={recipient.totalGross}/><Stat label="Total Pajak" value={recipient.totalTax}/><Stat label="Gross Exported" value={recipient.exportedGross}/><Stat label="Pajak Exported" value={recipient.exportedTax}/></div>{expandedRecipient === recipient.id && <div className="mt-4 border-t border-border pt-4"><div className="flex gap-2 overflow-x-auto pb-3">{recipient.monthlySummary.map((month) => <div key={month.period} className="min-w-[180px] bg-muted/50 rounded-xl p-3"><div className="font-black text-sm">{month.period}</div><div className="text-xs text-muted-foreground mt-1">{month.count} transaksi · Pajak Rp{money.format(month.tax)}</div></div>)}</div><div className="overflow-x-auto"><table className="premium-table"><thead><tr><th>SP2D</th><th>Periode</th><th>Kode</th><th>Gross</th><th>Pajak</th><th>Status</th></tr></thead><tbody>{recipient.transactions.map((tx) => <tr key={tx.id}><td>{tx.sp2dNumber || tx.spmNumber}</td><td>{tx.sp2dDate ? new Date(tx.sp2dDate).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "—"}</td><td>{tx.taxObjectCode}</td><td>Rp{money.format(tx.gross)}</td><td>Rp{money.format(tx.calculatedTax)}</td><td>{tx.status}</td></tr>)}</tbody></table></div></div>}</section>)}</div>}

    {editing && <div className="fixed inset-0 z-1000 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6"><div className="flex justify-between"><div><h2 className="text-xl font-black">Rincian PPh 21</h2><p className="text-sm text-muted-foreground">{editing.sp2dNumber || editing.spmNumber} · Potongan Rp{money.format(editing.deductionAmount)}</p></div><button onClick={() => setEditing(null)}><X/></button></div><div className="mt-5"><label className="text-xs font-bold uppercase text-muted-foreground">Withholding Date</label><input type="date" value={withholdingDate} onChange={(e) => setWithholdingDate(e.target.value)} className="block mt-1 bg-muted rounded-xl p-3"/></div><datalist id="pph21-recipients">{recipients.map((recipient) => <option key={recipient.id} value={recipient.nik}>{recipient.name}</option>)}</datalist><div className="grid gap-3 mt-5">{lines.map((line, index) => <div key={index} className="grid grid-cols-1 md:grid-cols-[1.2fr_1.5fr_1fr_1fr_auto] gap-2 items-end p-3 rounded-2xl bg-muted/40"><Field label="NIK"><input list="pph21-recipients" value={line.nik} onChange={(e) => chooseRecipient(index, e.target.value)} className="field"/></Field><Field label="Nama"><input value={line.name} onChange={(e) => setLines((items) => items.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="field"/></Field><Field label="Tax Object"><select value={line.taxObjectCode} onChange={(e) => setLines((items) => items.map((item, i) => i === index ? { ...item, taxObjectCode: e.target.value as Code } : item))} className="field">{codes.map((code) => <option key={code}>{code}</option>)}</select></Field><Field label="Gross"><input type="number" min="0" step="1" value={line.gross} onChange={(e) => setLines((items) => items.map((item, i) => i === index ? { ...item, gross: e.target.value } : item))} className="field"/></Field><button onClick={() => setLines((items) => items.length > 1 ? items.filter((_, i) => i !== index) : [emptyLine()])} className="p-3 text-rose-500"><Trash2 size={17}/></button></div>)}</div><button onClick={() => setLines((items) => [...items, emptyLine()])} className="mt-3 text-accent text-sm font-bold flex gap-2"><Plus size={17}/> Tambah recipient</button><div className={`mt-5 p-4 rounded-2xl ${editorTax === editing.deductionAmount ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>Total kalkulasi Rp{money.format(editorTax)} / potongan Rp{money.format(editing.deductionAmount)}</div><div className="mt-4"><label className="text-xs font-bold uppercase text-muted-foreground">Catatan issue</label><textarea value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} className="w-full bg-muted rounded-xl p-3 mt-1" placeholder="Wajib diisi bila menandai ISSUES"/></div><div className="flex flex-wrap justify-end gap-3 mt-5"><button onClick={setIssue} className="px-4 py-3 rounded-xl bg-amber-500/10 text-amber-600 font-bold"><AlertCircle size={16} className="inline mr-2"/>Tandai Issues</button><button onClick={saveDetails} disabled={busy} className="premium-button px-5 py-3"><Save size={16} className="inline mr-2"/>Simpan rincian</button></div></div></div>}
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="bg-muted/50 rounded-xl p-3"><div className="text-[10px] uppercase font-bold text-muted-foreground">{label}</div><div className="font-black mt-1">Rp{money.format(value)}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs font-bold text-muted-foreground [&_.field]:w-full [&_.field]:bg-background [&_.field]:text-foreground [&_.field]:rounded-xl [&_.field]:p-3 [&_.field]:outline-none"><span className="block mb-1 uppercase">{label}</span>{children}</label>; }
