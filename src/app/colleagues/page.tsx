"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Shield, User, Loader2 } from "lucide-react";

export default function ColleaguesPage() {
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("USER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchColleagues();
  }, []);

  const fetchColleagues = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/colleagues");
      const data = await res.json();
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
        body: JSON.stringify({ name, role }),
      });
      if (res.ok) {
        setName("");
        fetchColleagues();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteColleague = async (id: number) => {
    if (!confirm("Are you sure? This will unassign all records for this user.")) return;
    try {
      const res = await fetch("/api/colleagues", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchColleagues();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
        <p className="text-muted-foreground">Add colleagues and manage their access roles.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Colleague Form */}
        <section className="glass-card p-6 flex flex-col gap-4 h-fit">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus size={20} className="text-accent" /> Add New Member
          </h2>
          <form onSubmit={addColleague} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ahmad Suhendar"
                className="bg-muted border-none p-3 rounded-xl outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">App Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-muted border-none p-3 rounded-xl outline-none focus:ring-1 focus:ring-accent appearance-none cursor-pointer"
              >
                <option value="USER">User (Worksheet only)</option>
                <option value="ADMIN">Admin (Upload & Management)</option>
              </select>
            </div>
            <button
              disabled={isSubmitting || !name}
              className="premium-button flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus size={18} />}
              Invite Member
            </button>
          </form>
        </section>

        {/* Colleagues List */}
        <section className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Active Members</h2>
          <div className="grid-auto-fill gap-4">
            {isLoading ? (
              <div className="col-span-full text-center p-8 opacity-50">Loading team...</div>
            ) : colleagues.length === 0 ? (
              <div className="col-span-full text-center p-8 border-2 border-dashed border-border rounded-xl opacity-50">
                No members added yet.
              </div>
            ) : (
              colleagues.map((col: any) => (
                <div key={col.id} className="glass-card p-4 flex items-center gap-4 group transition-all hover:-translate-y-1">
                  <div className={`p-3 rounded-xl shrink-0 ${col.role === "ADMIN" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                    {col.role === "ADMIN" ? <Shield size={24} /> : <User size={24} />}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-bold tracking-tight truncate" title={col.name}>{col.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {col.role} • {col._count.records} tasks assigned
                    </span>
                  </div>
                  <button 
                    onClick={() => deleteColleague(col.id)}
                    className="p-2 shrink-0 transition-colors hover:bg-rose-500/10 text-rose-500 rounded-lg border border-transparent hover:border-rose-500/20"
                    title="Remove member"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
