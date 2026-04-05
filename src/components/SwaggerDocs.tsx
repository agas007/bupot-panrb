"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default function SwaggerDocs({ spec }: { spec: any }) {
  return (
    <div className="bg-white rounded-3xl overflow-hidden min-h-screen">
      <style jsx global>{`
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { padding: 30px; }
        .swagger-ui .scheme-container { background: transparent; box-shadow: none; padding: 20px 30px; }
        .swagger-ui select { background: #f1f5f9; border-radius: 12px; padding: 8px; border: none; }
        .swagger-ui input { background: #f1f5f9; border-radius: 12px; padding: 8px; border: none; }
        .swagger-ui .btn { border-radius: 12px; font-weight: bold; }
        .swagger-ui .opblock { border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
      `}</style>
      <SwaggerUI spec={spec} />
    </div>
  );
}
