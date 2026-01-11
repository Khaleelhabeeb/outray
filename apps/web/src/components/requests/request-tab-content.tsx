import { Copy, Check } from "lucide-react";
import type { TunnelEvent, RequestDetails } from "./types";

interface RequestTabContentProps {
  request: TunnelEvent;
  details: RequestDetails;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}

export function RequestTabContent({ request, details, copiedField, onCopy }: RequestTabContentProps) {
  return (
    <>
      {/* General Info */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-medium text-white">General</span>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">URL</span>
            <span className="text-gray-300 font-mono">
              https://{request.host}{request.path}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Method</span>
            <span className="text-gray-300 font-mono">{request.method}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Client IP</span>
            <span className="text-gray-300 font-mono">{request.client_ip}</span>
          </div>
        </div>
      </div>

      {/* Headers */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm font-medium text-white">Headers</span>
          <button
            onClick={() => onCopy(JSON.stringify(details.headers, null, 2), "req-headers")}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            {copiedField === "req-headers" ? <Check size={14} /> : <Copy size={14} />}
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

      {/* Query Params */}
      {Object.keys(details.queryParams).length > 0 && (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <span className="text-sm font-medium text-white">Query Parameters</span>
          </div>
          <div className="p-4 space-y-2 text-sm font-mono">
            {Object.entries(details.queryParams).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="text-accent">{key}:</span>
                <span className="text-gray-300">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {details.body && (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-medium text-white">Body</span>
            <button
              onClick={() => onCopy(details.body!, "req-body")}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              {copiedField === "req-body" ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <pre className="p-4 text-sm font-mono text-gray-300 overflow-x-auto">
            {details.body}
          </pre>
        </div>
      )}
    </>
  );
}
