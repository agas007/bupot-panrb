"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { 
  FileText, Code, Database, Shield, Lock, 
  ChevronRight, Copy, Terminal, Layers, 
  HelpCircle, Zap, Activity, Users, Settings
} from "lucide-react";
import { useState } from "react";

export default function CustomApiDocs({ spec }: { spec: any }) {
  const { language } = useLanguage();
  const [activeTag, setActiveTag] = useState("All");

  const paths = spec.paths || {};
  const tags = ["All", ...Object.values(paths).flatMap((p: any) => 
    Object.values(p).flatMap((m: any) => m.tags || [])
  ).filter((v, i, a) => a.indexOf(v) === i)];

  const methodColors: Record<string, string> = {
    get: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    post: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    patch: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    delete: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  };

  const tagIcons: Record<string, any> = {
    Management: <Settings size={18} />,
    Colleagues: <Users size={18} />,
    Logs: <Activity size={18} />,
    All: <Layers size={18} />,
  };

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start pb-20 animate-in fade-in duration-1000">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-72 lg:sticky lg:top-24 flex flex-col gap-6">
        <div className="glass-card p-4 flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-3 mb-2">
            API SECTIONS
          </label>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`flex items-center gap-4 p-3 rounded-2xl transition-all font-bold text-sm ${
                activeTag === tag 
                ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20 translate-x-1" 
                : "hover:bg-muted text-muted-foreground hover:translate-x-1"
              }`}
            >
              {tagIcons[tag] || <Database size={18} />}
              {tag}
            </button>
          ))}
        </div>

        <div className="glass-card p-6 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-accent mb-2">
            <Lock size={20} />
            <span className="font-bold text-sm tracking-tight">Security Model</span>
          </div>
          <div className="p-3 bg-muted/50 rounded-xl">
             <code className="text-[10px] font-bold text-foreground opacity-80 uppercase tracking-widest break-all">x-simulated-user</code>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed italic">
            Include this header in all non-GET requests to properly attribute audit logs in the system simulation.
          </p>
        </div>
      </aside>

      {/* API Details Panel */}
      <div className="flex-1 flex flex-col gap-8 w-full max-w-4xl">
        {Object.entries(paths).map(([path, methods]: [string, any]) => {
          return Object.entries(methods).map(([method, details]: [string, any]) => {
            const isVisible = activeTag === "All" || details.tags?.includes(activeTag);
            if (!isVisible) return null;

            return (
              <section key={`${path}-${method}`} className="glass-card overflow-hidden group animate-in slide-in-from-bottom-4 duration-500">
                {/* Method Header Bar */}
                <div className="flex items-center justify-between p-6 bg-muted/10 border-b border-border/5">
                  <div className="flex items-center gap-5">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-current transition-all group-hover:scale-105 ${methodColors[method.toLowerCase()]}`}>
                      {method}
                    </span>
                    <code className="text-sm font-mono font-bold text-foreground/80 tracking-tight">{path}</code>
                  </div>
                  <div className="flex items-center gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                    <Terminal size={14} className="text-muted-foreground" />
                    <Copy size={14} className="text-muted-foreground cursor-pointer hover:text-accent" />
                  </div>
                </div>

                <div className="p-8 flex flex-col gap-10">
                  {/* Info Section */}
                  <div className="flex flex-col gap-2 text-left">
                    <h3 className="text-xl font-bold tracking-tight">{details.summary}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">{details.description}</p>
                  </div>

                  {/* Body / Params Table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="flex flex-col gap-6 text-left">
                      <div className="flex items-center gap-3">
                        <Code size={18} className="text-accent" />
                        <h4 className="text-sm font-black uppercase tracking-widest">Request Spec</h4>
                      </div>
                      
                      {/* Query Parameters */}
                      {details.parameters?.map((param: any) => (
                        <div key={param.name} className="flex flex-col gap-1 border-l-2 border-accent/20 pl-4 py-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{param.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">({param.in})</span>
                          </div>
                          <p className="text-xs text-muted-foreground opacity-80">{param.description}</p>
                        </div>
                      ))}

                      {/* Request Body JSON Sample */}
                      {details.requestBody && (
                        <div className="relative mt-2">
                           <div className="bg-slate-950 rounded-2xl p-6 overflow-hidden border border-white/5 shadow-inner">
                              <pre className="text-[11px] font-mono text-emerald-400/90 leading-relaxed overflow-x-auto">
                                {`// application/json\n${JSON.stringify({
                                  ...(details.requestBody.content?.["application/json"]?.schema?.properties || {}),
                                  ...(details.requestBody.content?.["multipart/form-data"]?.schema?.properties || {})
                                }, null, 2)}`}
                              </pre>
                           </div>
                           <div className="absolute top-4 right-4 text-[10px] uppercase font-black text-white/20">PAYLOAD</div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-6 text-left">
                      <div className="flex items-center gap-3">
                        <Zap size={18} className="text-emerald-500" />
                        <h4 className="text-sm font-black uppercase tracking-widest">Expected Response</h4>
                      </div>
                      
                      {Object.entries(details.responses || {}).map(([code, resp]: [string, any]) => (
                        <div key={code} className="flex items-start gap-4 p-4 bg-muted/20 border border-border/50 rounded-2xl transition-all hover:bg-muted/30">
                           <div className={`p-2 rounded-lg font-mono text-[10px] font-black ${code.startsWith('2') ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                             {code}
                           </div>
                           <div className="flex flex-col gap-1">
                             <span className="text-sm font-bold opacity-90">{resp.description}</span>
                             <span className="text-[10px] text-muted-foreground font-mono">content-type: application/json</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          });
        })}
      </div>
    </div>
  );
}
