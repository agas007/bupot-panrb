"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Plus, ReceiptText, Save, Search, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PPH21_TAX_OBJECTS } from "@/lib/pph21";

type Code = keyof typeof PPH21_TAX_OBJECTS;
type Line = { nik: string; name: string; taxObjectCode: Code; gross: string };
type Batch = { id: number; status: string; withholdingDate: string | null; issueNotes?: string | null; withholdings: Array<{ id: number; recipient: { nik: string; name: string }; recipientName: string; taxObjectCode: Code; gross: number; calculatedTax: number }> };
type RecordRow = { id: number; spmNumber: string; sp2dNumber: string | null; sp2dDate: string | null; deductionAmount: number; recipient?: string | null; canManage: boolean; pph21Batch: Batch | null };
type Recipient = { id: number; nik: string; name: string; defaultTaxObjectCode: Code; transactionCount: number; totalGross: number; totalTax: number; exportedGross: number; exportedTax: number; monthlySummary: Array<{ period: string; count: number; gross: number; tax: number }>; transactions: Array<{ id: number; spmNumber: string; sp2dNumber: string | null; sp2dDate: string | null; status: string; taxObjectCode: string; gross: number; calculatedTax: number }> };

const codes = Object.keys(PPH21_TAX_OBJECTS) as Code[];
const money = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const emptyLine = (): Line => ({ nik: "", name: "", taxObjectCode: "21-402-02", gross: "" });

export default function Pph21Page() {
  const { user, isAdmin, getAuthHeaders, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<"sp2d" | "recipients">("sp2d");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [withholdingDate, setWithholdingDate] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [issueNotes, setIssueNotes] = useState("");
  const [expandedRecipient, setExpandedRecipient] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const headers = getAuthHeaders();
    const [recordRes, recipientRes] = await Promise.all([fetch("/api/pph21", { headers }), fetch("/api/pph21/recipients", { headers })]);
    if (!recordRes.ok || !recipientRes.ok) throw new Error("Gagal memuat data PPh 21");
    const [recordData, recipientData] = await Promise.all([recordRes.json(), recipientRes.json()]);
    setRecords(recordData);
    setRecipients(recipientData);
    const requestedId = Number(new URLSearchParams(window.location.search).get("recordId"));
    if (requestedId) {
      const requested = recordData.find((item: RecordRow) => item.id === requestedId);
      if (requested) openEditor(requested);
      window.history.replaceState({}, "", "/pph21");
    }
  }, [getAuthHeaders, user]);

  useEffect(() => { if (!authLoading && user) void load().catch((error) => setFeedback({ type: "error", message: error.message })); }, [authLoading, load, user]);

  function openEditor(record: RecordRow) {
    setEditing(record);
    setWithholdingDate(record.pph21Batch?.withholdingDate?.slice(0, 10) || "");
    setLines(record.pph21Batch?.withholdings.length ? record.pph21Batch.withholdings.map((line) => ({ nik: line.recipient.nik, name: line.recipientName, taxObjectCode: line.taxObjectCode, gross: String(line.gross) })) : [emptyLine()]);
    setIssueNotes(record.pph21Batch?.issueNotes || "");
    setFeedback(null);
  }

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
    await load(); setFeedback({ type: "success", message: "Master penerima diperbarui tanpa mengubah histori." });
  }

  const visibleRecords = records.filter((record) => [record.spmNumber, record.sp2dNumber, record.recipient].some((value) => value?.toLowerCase().includes(search.toLowerCase())));
  const visibleRecipients = recipients.filter((recipient) => `${recipient.name} ${recipient.nik}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="flex flex-col gap-6 pb-10 text-left">
    <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h1 className="text-3xl font-black flex items-center gap-3"><ReceiptText className="text-accent" /> PPh 21</h1><p className="text-sm text-muted-foreground mt-1">Master penerima, rincian SP2D, dan export XML Coretax.</p></div>
      <button onClick={exportXml} disabled={busy || !selected.size} className="premium-button px-5 py-3 flex items-center justify-center gap-2 disabled:opacity-40"><Download size={17} /> Export {selected.size} SP2D ke XML</button>
    </header>
    {feedback && <div className={`p-4 rounded-2xl border flex items-center gap-3 ${feedback.type === "error" ? "bg-rose-500/10 border-rose-500/20 text-rose-600" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"}`}>{feedback.type === "error" ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>} {feedback.message}</div>}
    <div className="flex flex-col md:flex-row gap-3 justify-between"><div className="flex bg-muted p-1 rounded-xl"><button onClick={() => setTab("sp2d")} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === "sp2d" ? "bg-background shadow" : "text-muted-foreground"}`}>SP2D PPh 21</button><button onClick={() => setTab("recipients")} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === "recipients" ? "bg-background shadow" : "text-muted-foreground"}`}>Master Penerima</button></div><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, NIK, SPM, atau SP2D" className="bg-muted rounded-xl pl-10 pr-4 py-2.5 outline-none min-w-[300px]"/></div></div>

    {tab === "sp2d" ? <div className="glass-card overflow-x-auto"><table className="premium-table"><thead><tr><th></th><th>SPM / SP2D</th><th>Tanggal SP2D</th><th>Potongan</th><th>Recipients</th><th>PPh 21 Process</th><th>Aksi</th></tr></thead><tbody>{visibleRecords.map((record) => <tr key={record.id}><td><input type="checkbox" disabled={!record.canManage} checked={selected.has(record.id)} onChange={(e) => setSelected((current) => { const next = new Set(current); if (e.target.checked) next.add(record.id); else next.delete(record.id); return next; })}/></td><td><div className="font-bold">{record.spmNumber}</div><div className="text-xs text-muted-foreground">{record.sp2dNumber || "Belum terbit"}</div></td><td>{record.sp2dDate ? new Date(record.sp2dDate).toLocaleDateString("id-ID") : "—"}</td><td>Rp{money.format(record.deductionAmount)}</td><td>{record.pph21Batch?.withholdings.length || 0}</td><td><span className={`badge ${record.pph21Batch?.status === "COMPLETED" ? "badge-completed" : "badge-pending"}`}>{record.pph21Batch?.status || "PENDING"}</span>{record.pph21Batch?.issueNotes && <div className="text-xs text-amber-600 mt-1">{record.pph21Batch.issueNotes}</div>}</td><td><button disabled={!record.canManage} onClick={() => openEditor(record)} className="text-accent font-bold text-xs hover:underline disabled:opacity-30">Kelola rincian</button></td></tr>)}</tbody></table></div> :
    <div className="grid gap-4">{visibleRecipients.map((recipient) => <section key={recipient.id} className="glass-card p-5"><div className="flex flex-col lg:flex-row justify-between gap-4"><div><input disabled={!isAdmin} value={recipient.name} onChange={(e) => setRecipients((items) => items.map((item) => item.id === recipient.id ? { ...item, name: e.target.value } : item))} className="font-black text-lg bg-transparent border-b border-transparent focus:border-accent outline-none disabled:opacity-100"/><div className="font-mono text-sm text-muted-foreground">{recipient.nik}</div></div><div className="flex gap-2 items-center"><select disabled={!isAdmin} value={recipient.defaultTaxObjectCode} onChange={(e) => setRecipients((items) => items.map((item) => item.id === recipient.id ? { ...item, defaultTaxObjectCode: e.target.value as Code } : item))} className="bg-muted rounded-xl p-2 text-sm disabled:opacity-70">{codes.map((code) => <option key={code}>{code}</option>)}</select>{isAdmin && <button onClick={() => updateRecipient(recipient)} className="p-2 text-accent" title="Simpan default"><Save size={17}/></button>}<button onClick={() => setExpandedRecipient(expandedRecipient === recipient.id ? null : recipient.id)} className="px-3 py-2 rounded-xl bg-muted text-xs font-bold">{recipient.transactionCount} transaksi</button></div></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4"><Stat label="Total Gross" value={recipient.totalGross}/><Stat label="Total Pajak" value={recipient.totalTax}/><Stat label="Gross Exported" value={recipient.exportedGross}/><Stat label="Pajak Exported" value={recipient.exportedTax}/></div>{expandedRecipient === recipient.id && <div className="mt-4 border-t border-border pt-4"><div className="flex gap-2 overflow-x-auto pb-3">{recipient.monthlySummary.map((month) => <div key={month.period} className="min-w-[180px] bg-muted/50 rounded-xl p-3"><div className="font-black text-sm">{month.period}</div><div className="text-xs text-muted-foreground mt-1">{month.count} transaksi · Pajak Rp{money.format(month.tax)}</div></div>)}</div><div className="overflow-x-auto"><table className="premium-table"><thead><tr><th>SP2D</th><th>Periode</th><th>Kode</th><th>Gross</th><th>Pajak</th><th>Status</th></tr></thead><tbody>{recipient.transactions.map((tx) => <tr key={tx.id}><td>{tx.sp2dNumber || tx.spmNumber}</td><td>{tx.sp2dDate ? new Date(tx.sp2dDate).toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "—"}</td><td>{tx.taxObjectCode}</td><td>Rp{money.format(tx.gross)}</td><td>Rp{money.format(tx.calculatedTax)}</td><td>{tx.status}</td></tr>)}</tbody></table></div></div>}</section>)}</div>}

    {editing && <div className="fixed inset-0 z-1000 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="bg-background border border-border rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6"><div className="flex justify-between"><div><h2 className="text-xl font-black">Rincian PPh 21</h2><p className="text-sm text-muted-foreground">{editing.sp2dNumber || editing.spmNumber} · Potongan Rp{money.format(editing.deductionAmount)}</p></div><button onClick={() => setEditing(null)}><X/></button></div><div className="mt-5"><label className="text-xs font-bold uppercase text-muted-foreground">Withholding Date</label><input type="date" value={withholdingDate} onChange={(e) => setWithholdingDate(e.target.value)} className="block mt-1 bg-muted rounded-xl p-3"/></div><datalist id="pph21-recipients">{recipients.map((recipient) => <option key={recipient.id} value={recipient.nik}>{recipient.name}</option>)}</datalist><div className="grid gap-3 mt-5">{lines.map((line, index) => <div key={index} className="grid grid-cols-1 md:grid-cols-[1.2fr_1.5fr_1fr_1fr_auto] gap-2 items-end p-3 rounded-2xl bg-muted/40"><Field label="NIK"><input list="pph21-recipients" value={line.nik} onChange={(e) => chooseRecipient(index, e.target.value)} className="field"/></Field><Field label="Nama"><input value={line.name} onChange={(e) => setLines((items) => items.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="field"/></Field><Field label="Tax Object"><select value={line.taxObjectCode} onChange={(e) => setLines((items) => items.map((item, i) => i === index ? { ...item, taxObjectCode: e.target.value as Code } : item))} className="field">{codes.map((code) => <option key={code}>{code}</option>)}</select></Field><Field label="Gross"><input type="number" min="0" step="1" value={line.gross} onChange={(e) => setLines((items) => items.map((item, i) => i === index ? { ...item, gross: e.target.value } : item))} className="field"/></Field><button onClick={() => setLines((items) => items.length > 1 ? items.filter((_, i) => i !== index) : [emptyLine()])} className="p-3 text-rose-500"><Trash2 size={17}/></button></div>)}</div><button onClick={() => setLines((items) => [...items, emptyLine()])} className="mt-3 text-accent text-sm font-bold flex gap-2"><Plus size={17}/> Tambah recipient</button><div className={`mt-5 p-4 rounded-2xl ${editorTax === editing.deductionAmount ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>Total kalkulasi Rp{money.format(editorTax)} / potongan Rp{money.format(editing.deductionAmount)}</div><div className="mt-4"><label className="text-xs font-bold uppercase text-muted-foreground">Catatan issue</label><textarea value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} className="w-full bg-muted rounded-xl p-3 mt-1" placeholder="Wajib diisi bila menandai ISSUES"/></div><div className="flex flex-wrap justify-end gap-3 mt-5"><button onClick={setIssue} className="px-4 py-3 rounded-xl bg-amber-500/10 text-amber-600 font-bold"><AlertCircle size={16} className="inline mr-2"/>Tandai Issues</button><button onClick={saveDetails} disabled={busy} className="premium-button px-5 py-3"><Save size={16} className="inline mr-2"/>Simpan rincian</button></div></div></div>}
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="bg-muted/50 rounded-xl p-3"><div className="text-[10px] uppercase font-bold text-muted-foreground">{label}</div><div className="font-black mt-1">Rp{money.format(value)}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs font-bold text-muted-foreground [&_.field]:w-full [&_.field]:bg-background [&_.field]:text-foreground [&_.field]:rounded-xl [&_.field]:p-3 [&_.field]:outline-none"><span className="block mb-1 uppercase">{label}</span>{children}</label>; }
