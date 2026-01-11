import { useState, useEffect } from "react";
import { X, Copy, Play, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { TunnelEvent } from "./types";
import { getMockRequestDetails } from "./utils";

interface ReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: TunnelEvent | null;
}

export function ReplayModal({ isOpen, onClose, request }: ReplayModalProps) {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [copiedCurl, setCopiedCurl] = useState(false);

  useEffect(() => {
    if (request) {
      const details = getMockRequestDetails(request);
      setMethod(request.method);
      setUrl(`https://${request.host}${request.path}`);
      setHeaders(
        Object.entries(details.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      );
      setBody(details.body || "");
    }
  }, [request]);

  const generateCurl = () => {
    let curl = `curl -X ${method} '${url}'`;
    headers.split("\n").forEach((line) => {
      if (line.trim()) {
        curl += ` \\\n  -H '${line.trim()}'`;
      }
    });
    if (body && method !== "GET" && method !== "HEAD") {
      curl += ` \\\n  -d '${body.replace(/\n/g, "")}'`;
    }
    return curl;
  };

  const copyAsCurl = async () => {
    await navigator.clipboard.writeText(generateCurl());
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  if (!request) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />
          <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl max-h-[90vh] bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                    <Play className="w-5 h-5 text-accent" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Replay Request</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Method & URL */}
                <div className="flex gap-2">
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50"
                  >
                    {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => (
                      <option key={m} value={m} className="bg-[#0A0A0A]">
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 font-mono focus:outline-none focus:border-accent/50"
                    placeholder="https://example.com/api/endpoint"
                  />
                </div>

                {/* Headers */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Headers</label>
                  <textarea
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    rows={6}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 font-mono focus:outline-none focus:border-accent/50 resize-none"
                    placeholder="Content-Type: application/json"
                  />
                </div>

                {/* Body */}
                {method !== "GET" && method !== "HEAD" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Body</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={6}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 font-mono focus:outline-none focus:border-accent/50 resize-none"
                      placeholder='{"key": "value"}'
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 p-4 border-t border-white/10">
                <button
                  onClick={copyAsCurl}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors border border-white/10"
                >
                  {copiedCurl ? <Check size={16} /> : <Copy size={16} />}
                  {copiedCurl ? "Copied!" : "Copy as cURL"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors border border-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // UI only - would send request here
                      alert("Replay functionality coming soon!");
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <Play size={16} />
                    Send Request
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
