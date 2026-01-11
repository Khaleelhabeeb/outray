import { useState } from "react";
import { X, Copy, Play, ArrowDownToLine, ArrowUpFromLine, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { TunnelEvent, InspectorTab } from "./types";
import { getMockRequestDetails, getMockResponseDetails, generateCurl } from "./utils";
import { RequestTabContent } from "./request-tab-content";
import { ResponseTabContent } from "./response-tab-content";
import { FullCaptureDisabledContent } from "./full-capture-disabled-content";

interface RequestInspectorDrawerProps {
  request: TunnelEvent | null;
  onClose: () => void;
  onReplay: () => void;
  fullCaptureEnabled: boolean;
  orgSlug: string;
}

export function RequestInspectorDrawer({
  request,
  onClose,
  onReplay,
  fullCaptureEnabled,
  orgSlug,
}: RequestInspectorDrawerProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("request");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!request) return null;

  const requestDetails = getMockRequestDetails(request);
  const responseDetails = getMockResponseDetails(request);

  const tabs = [
    { id: "request" as InspectorTab, label: "Request", icon: ArrowUpFromLine },
    { id: "response" as InspectorTab, label: "Response", icon: ArrowDownToLine },
  ];

  return (
    <AnimatePresence>
      {request && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#0A0A0A] border-l border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${
                    request.status_code >= 500
                      ? "bg-red-500/10 text-red-400 border border-red-500/20"
                      : request.status_code >= 400
                        ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                        : "bg-green-500/10 text-green-400 border border-green-500/20"
                  }`}
                >
                  {request.status_code}
                </div>
                <span className="font-mono text-white font-medium">{request.method}</span>
                <span className="text-gray-400 truncate max-w-xs" title={request.path}>
                  {request.path}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Actions */}
            {fullCaptureEnabled && (
              <div className="flex items-center gap-2 p-4 border-b border-white/10">
                <button
                  onClick={onReplay}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <Play size={16} />
                  Replay Request
                </button>
                <button
                  onClick={() => copyToClipboard(generateCurl(request), "curl")}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors border border-white/10"
                >
                  {copiedField === "curl" ? <Check size={16} /> : <Copy size={16} />}
                  {copiedField === "curl" ? "Copied!" : "Copy as cURL"}
                </button>
              </div>
            )}

            {/* Tabs - only show when full capture is enabled */}
            {fullCaptureEnabled && (
              <div className="flex items-center gap-1 p-4 border-b border-white/10">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === id
                        ? "bg-white/10 text-white"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!fullCaptureEnabled ? (
                <FullCaptureDisabledContent request={request} orgSlug={orgSlug} />
              ) : (
                <>
                  {activeTab === "request" && (
                    <RequestTabContent
                      request={request}
                      details={requestDetails}
                      copiedField={copiedField}
                      onCopy={copyToClipboard}
                    />
                  )}
                  {activeTab === "response" && (
                    <ResponseTabContent
                      details={responseDetails}
                      copiedField={copiedField}
                      onCopy={copyToClipboard}
                    />
                  )}
                </>
              )}
            </div>

            {/* Footer metadata */}
            <div className="p-4 border-t border-white/10 bg-white/2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Tunnel ID</span>
                  <p className="text-gray-300 font-mono text-xs mt-1">{request.tunnel_id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Timestamp</span>
                  <p className="text-gray-300 text-xs mt-1">
                    {new Date(request.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
