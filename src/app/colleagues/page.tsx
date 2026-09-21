"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Shield, User, Loader2, KeyRound, AtSign, X, Save, UserPen, Archive } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";
import { Colleague, type UserRole } from "@/types";

const ROLE_OPTIONS: Array<{ value: UserRole; labelKey: "role_user" | "role_admin" | "role_archivist" }> = [
  { value: "USER", labelKey: "role_user" },
  { value: "ARCHIVIST", labelKey: "role_archivist" },
  { value: "ADMIN", labelKey: "role_admin" },
];

const dedupeRoles = (roles: UserRole[]) => Array.from(new Set(roles));

export default function ColleaguesPage() {
  const { language, t } = useLanguage();
  const { getAuthHeaders, user: currentUser } = useAuth();
  
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<UserRole[]>(["USER"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedFilterRoles, setSelectedFilterRoles] = useState<UserRole[]>(ROLE_OPTIONS.map((option) => option.value));

  // Edit Modal States
  const [selectedColleague, setSelectedColleague] = useState<Colleague | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRoles, setEditRoles] = useState<UserRole[]>(["USER"]);

  const toggleRole = (value: UserRole, current: UserRole[], setValue: (next: UserRole[]) => void) => {
    setValue(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : dedupeRoles([...current, value])
    );
  };

  useEffect(() => {
    fetchColleagues();
  }, []);

  const fetchColleagues = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/colleagues");
      const data: Colleague[] = await res.json();
      setColleagues(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const addColleague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/colleagues", {
        method: "POST",
        headers: { 
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          name, 
          username: username.toLowerCase() || undefined, 
          password: password || undefined, 
          roles 
        }),
      });
      if (res.ok) {
        setName("");
        setUsername("");
        setPassword("");
        setRoles(["USER"]);
        setIsAddModalOpen(false);
        fetchColleagues();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteColleague = async (id: number) => {
    const msg = t.team.confirm_delete;
    if (!confirm(msg)) return;
    try {
      const res = await fetch("/api/colleagues", {
        method: "DELETE",
        headers: { 
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchColleagues();
    } catch (err) {
      console.error(err);
    }
  };

  const openEditModal = (col: Colleague) => {
    setSelectedColleague(col);
    setEditName(col.name);
    setEditUsername(col.username);
    setEditRoles(col.roles?.length ? col.roles : [col.role]);
    setEditPassword(""); 
    setIsEditModalOpen(true);
  };

  const updateColleague = async () => {
    if (!selectedColleague) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/colleagues", {
        method: "PATCH",
        headers: { 
          ...getAuthHeaders(),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          id: selectedColleague.id,
          name: editName,
          username: editUsername,
          roles: editRoles,
          password: editPassword || undefined
        }),
      });

      if (res.ok) {
        setIsEditModalOpen(false);
        fetchColleagues();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredColleagues = colleagues.filter((colleague) => {
    const colleagueRoles = colleague.roles?.length ? colleague.roles : [colleague.role];
    return colleagueRoles.some((role) => selectedFilterRoles.includes(role));
  });

  const toggleFilterRole = (role: UserRole) => {
    setSelectedFilterRoles((current) => (
      current.includes(role)
        ? current.filter((item) => item !== role)
        : dedupeRoles([...current, role])
    ));
  };

  const selectAllFilterRoles = () => {
    setSelectedFilterRoles((current) => (
      current.length === ROLE_OPTIONS.length ? [] : ROLE_OPTIONS.map((option) => option.value)
    ));
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 text-left">
        <h1 className="text-3xl font-bold tracking-tight">{t.team.title}</h1>
        <p className="text-muted-foreground">{t.team.subtitle}</p>
      </header>

      <div className="flex flex-col gap-8">
        <div className="flex justify-end">
          <button onClick={() => setIsAddModalOpen(true)} className="premium-button flex items-center justify-center gap-2 py-3 px-5 font-bold">
            <UserPlus size={18} /> {t.team.add_member}
          </button>
        </div>

        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-1000 flex items-center justify-center p-4">
            <section className="glass-card w-full max-w-lg p-6 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus size={20} className="text-accent" /> {t.team.add_member}
                </h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-muted-foreground hover:text-foreground" title={language === "ID" ? "Tutup" : "Close"}>
                  <X size={22} />
                </button>
              </div>
          <form onSubmit={addColleague} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {t.team.full_name}
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ahmad Suhendar"
                  className="w-full bg-muted/50 border-none py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {t.team.username}
              </label>
              <div className="relative group">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ahmad.s (auto-generated if empty)"
                  className="w-full bg-muted/50 border-none py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {t.team.password}
              </label>
              <div className="relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for default"
                  className="w-full bg-muted/50 border-none py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {t.team.role}
              </label>
              <div className="relative">
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 p-3">
                  {ROLE_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-background/60">
                      <input
                        type="checkbox"
                        checked={roles.includes(option.value)}
                        onChange={() => toggleRole(option.value, roles, setRoles)}
                        className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                      />
                      <span className="text-sm font-semibold text-foreground">{t.team[option.labelKey]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button
              disabled={isSubmitting || !name}
              className="premium-button flex items-center justify-center gap-2 disabled:opacity-50 py-4 font-bold mt-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus size={18} />}
              {t.team.invite}
            </button>
          </form>
            </section>
          </div>
        )}

        <section className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-left flex items-center gap-2">
                {t.team.list_title} <span className="bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full">{colleagues.length}</span>
              </h2>
              <span className="text-xs text-muted-foreground font-semibold">
                {filteredColleagues.length} {t.team.filtered_count}
              </span>
            </div>
            <div className="glass-card p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t.team.filter_role}</span>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedFilterRoles.length === ROLE_OPTIONS.length}
                    onChange={selectAllFilterRoles}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                  />
                  {t.team.all_roles}
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-background/60">
                    <input
                      type="checkbox"
                      checked={selectedFilterRoles.includes(option.value)}
                      onChange={() => toggleFilterRole(option.value)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                    {t.team[option.labelKey]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="glass-card overflow-hidden">
            {isLoading ? (
              <div className="text-center p-12 text-muted-foreground italic">{t.team.loading}</div>
            ) : colleagues.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground italic">
                {t.team.not_found}
              </div>
            ) : filteredColleagues.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground italic">
                {t.team.no_filtered_results}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="border-b border-border/60 bg-muted/30">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-5 py-4">{t.team.table_name}</th>
                      <th className="px-5 py-4">{t.team.table_username}</th>
                      <th className="px-5 py-4">{t.team.table_roles}</th>
                      <th className="px-5 py-4">{t.team.table_tasks}</th>
                      <th className="px-5 py-4 text-right">{t.team.table_actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredColleagues.map((col: Colleague) => (
                      <tr key={col.id} className="group hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-4">
                          <button onClick={() => openEditModal(col)} className="flex items-center gap-3 text-left">
                            <span className={`p-2 rounded-xl shrink-0 ${col.role === "ADMIN" ? "bg-accent/10 text-accent" : col.role === "ARCHIVIST" ? "bg-sky-500/10 text-sky-500" : "bg-primary/10 text-primary"}`}>
                              {col.role === "ADMIN" ? <Shield size={18} /> : col.role === "ARCHIVIST" ? <Archive size={18} /> : <User size={18} />}
                            </span>
                            <span className="font-bold tracking-tight hover:underline" title={col.name}>{col.name}</span>
                            {currentUser?.id === col.id && <span className="bg-emerald-500/10 text-emerald-500 rounded text-[8px] border border-emerald-500/20 px-1 font-black">You</span>}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground font-mono text-xs">{col.username || "unset"}</td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {(col.roles?.length ? col.roles : [col.role]).map((roleItem) => (
                              <span key={roleItem} className={`px-2 py-1 rounded-md text-[10px] font-bold ${roleItem === "ADMIN" ? "bg-accent/10 text-accent" : roleItem === "ARCHIVIST" ? "bg-sky-500/10 text-sky-500" : "bg-primary/10 text-primary"}`}>
                                {roleItem === "ADMIN" ? t.team.role_admin : roleItem === "ARCHIVIST" ? t.team.role_archivist : t.team.role_user}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground font-semibold">{col._count?.records || 0} {t.team.tasks}</td>
                        <td className="px-5 py-4 text-right">
                          {currentUser?.id !== col.id ? (
                            <button
                              onClick={() => deleteColleague(col.id)}
                              className="p-2 transition-all hover:bg-rose-500/10 text-rose-500/50 hover:text-rose-500 rounded-xl"
                              title={language === "ID" ? "Hapus user" : "Remove user"}
                            >
                              <Trash2 size={18} />
                            </button>
                          ) : (
                            <button onClick={() => openEditModal(col)} className="p-2 text-accent/60 hover:text-accent rounded-xl" title={language === "ID" ? "Edit profil" : "Edit profile"}>
                              <UserPen size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Edit User Modal */}
      {isEditModalOpen && selectedColleague && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-1000 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-8 flex flex-col gap-6 shadow-2xl animate-in zoom-in duration-300">
             <div className="flex justify-between items-center bg-accent/5 p-2 rounded-2xl border border-accent/10">
                <div className="flex items-center gap-4 px-2">
                  <div className="p-2 bg-accent/10 text-accent rounded-xl"><UserPen size={24} /></div>
                  <div className="text-left"><h2 className="text-xl font-bold tracking-tight">{language === "ID" ? "Edit Profil" : "Edit Profile"}</h2><p className="text-[10px] text-muted-foreground uppercase font-black">{selectedColleague.username}</p></div>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-muted-foreground hover:text-foreground"><X size={24}/></button>
             </div>

             <div className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{t.team.full_name}</label>
                   <input className="w-full bg-muted/50 border-none py-4 px-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-bold" value={editName} onChange={e => setEditName(e.target.value)} />
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{t.team.username}</label>
                   <input className="w-full bg-muted/10 border-none py-4 px-4 rounded-2xl outline-none opacity-50 text-sm font-mono cursor-not-allowed" value={editUsername} readOnly />
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{language === "ID" ? "Reset Password (Opsional)" : "Reset Password (Optional)"}</label>
                   <div className="relative">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                      <input type="password" placeholder={language === "ID" ? "Isi untuk ganti password" : "Fill to change password"} className="w-full bg-muted/50 border-none py-4 pl-12 pr-4 rounded-2xl outline-none focus:ring-2 focus:ring-accent/20 transition-all text-sm font-bold" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{t.team.role}</label>
                   <div className="grid gap-2 rounded-2xl border border-border/70 bg-muted/30 p-3">
                      {ROLE_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-background/60">
                          <input
                            type="checkbox"
                            checked={editRoles.includes(option.value)}
                            onChange={() => toggleRole(option.value, editRoles, setEditRoles)}
                            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                          />
                          <span className="text-sm font-semibold text-foreground">{t.team[option.labelKey]}</span>
                        </label>
                      ))}
                   </div>
                </div>
             </div>

             <div className="flex flex-col gap-3">
                <button onClick={updateColleague} disabled={isSubmitting || !editName} className="premium-button py-4 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
                   {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                   {language === "ID" ? "Simpan Perubahan" : "Save Changes"}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
