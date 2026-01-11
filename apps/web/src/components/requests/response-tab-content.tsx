import { Copy, Check } from "lucide-react";
import type { ResponseDetails } from "./types";

interface ResponseTabContentProps {
  details: ResponseDetails;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}

export function ResponseTabContent({ details, copiedField, onCopy }: ResponseTabContentProps) {
  return (
    <>
      {/* Headers */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Headers</span>
          <button
            onClick={() => onCopy(JSON.stringify(details.headers, null, 2), "res-headers")}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            {copiedField === "res-headers" ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <div className="p-4 space-y-2 text-sm font-mono">
          {Object.entries(details.headers).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-accent">{key}:</span>
              <span className="text-gray-300 break-all">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Body</span>
          <button
            onClick={() => onCopy(details.body, "res-body")}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            {copiedField === "res-body" ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <pre className="p-4 text-sm font-mono text-gray-300 overflow-x-auto">{details.body}</pre>
      </div>
    </>
  );
}
