import { getApiDocs } from "@/lib/swagger";
import CustomApiDocs from "@/components/ApiDocumentationUI";

export default async function ApiDocsPage() {
  const spec = await getApiDocs();
  return (
    <div className="flex flex-col gap-12 pt-4">
      <header className="flex flex-col gap-4 text-left border-b border-border pb-10">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-accent text-accent-foreground rounded-2xl shadow-xl shadow-accent/20 transition-transform hover:scale-110">
              <Code size={32} />
           </div>
           <div className="flex flex-col items-start">
              <h1 className="text-4xl font-black tracking-tight uppercase leading-none mb-1 text-foreground/90">System Backend</h1>
              <p className="text-sm font-bold text-accent uppercase tracking-[0.2em] opacity-80 italic">v1.2.0 Interactive Reference</p>
           </div>
        </div>
        <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed">
          Explorer teknis untuk layanan backend Bupot PANRB. Dokumentasi ini terintegrasi langsung dengan skema database Neon dan sistem Audit Log.
        </p>
      </header>

      <CustomApiDocs spec={spec} />
    </div>
  );
}

import { Code } from "lucide-react";
