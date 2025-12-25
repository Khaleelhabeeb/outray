import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Globe,
  Plus,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Copy,
  Info,
} from "lucide-react";
import { appClient } from "../../lib/app-client";
import { useAppStore } from "../../lib/store";
import { getPlanLimits } from "../../lib/subscription-plans";
import axios from "axios";

export const Route = createFileRoute("/dash/domains")({
  component: DomainsView,
});

function DomainsView() {
  const { selectedOrganizationId } = useAppStore();
  const activeOrgId = selectedOrganizationId;
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: subscriptionData, isLoading: isLoadingSubscription } = useQuery(
    {
      queryKey: ["subscription", activeOrgId],
      queryFn: async () => {
        if (!activeOrgId) return null;
        const response = await axios.get(`/api/subscriptions/${activeOrgId}`);
        return response.data;
      },
      enabled: !!activeOrgId,
    },
  );

  const { data, isLoading: isLoadingDomains } = useQuery({
    queryKey: ["domains", activeOrgId],
    queryFn: () => {
      if (!activeOrgId) throw new Error("No active organization");
      return appClient.domains.list(activeOrgId);
    },
    enabled: !!activeOrgId,
  });

  const isLoading = isLoadingDomains || isLoadingSubscription;

  const createMutation = useMutation({
    mutationFn: async (domain: string) => {
      if (!activeOrgId) throw new Error("No active organization");
      return appClient.domains.create({
        domain,
        organizationId: activeOrgId,
      });
    },
    onSuccess: (data) => {
      if ("error" in data) {
        setError(data.error);
      } else {
        setNewDomain("");
        setIsCreating(false);
        queryClient.invalidateQueries({ queryKey: ["domains"] });
      }
    },
    onError: () => {
      setError("Failed to create domain");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return appClient.domains.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      return appClient.domains.verify(id);
    },
    onSuccess: (data) => {
      if ("error" in data) {
        alert(data.error);
      } else {
        queryClient.invalidateQueries({ queryKey: ["domains"] });
      }
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate that it's a subdomain (has at least 3 parts: subdomain.domain.tld)
    const parts = newDomain.trim().split(".");
    if (parts.length < 3) {
      setError(
        "Only subdomains are allowed. Please enter a subdomain like api.myapp.com",
      );
      return;
    }

    // Basic domain validation
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;
    if (!domainRegex.test(newDomain.trim())) {
      setError("Please enter a valid domain name");
      return;
    }

    createMutation.mutate(newDomain.trim());
  };

  const getRecordName = (domain: string) => {
    const parts = domain.split(".");
    if (parts.length <= 2) return "@";
    return parts.slice(0, parts.length - 2).join(".");
  };

  const domains = data && "domains" in data ? data.domains : [];
  const subscription = subscriptionData?.subscription;
  const currentPlan = subscription?.plan || "free";
  const planLimits = getPlanLimits(currentPlan as any);

  const currentDomainCount = domains.length;
  const domainLimit = planLimits.maxDomains;
  const isAtLimit = domainLimit !== -1 && currentDomainCount >= domainLimit;
  const isUnlimited = domainLimit === -1;

  const handleAddDomainClick = () => {
    if (isAtLimit) {
      alert(
        `You've reached your domain limit (${domainLimit} domains). Upgrade your plan to add more domains.`,
      );
      return;
    }
    setIsCreating(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-white/5 rounded mb-2" />
            <div className="h-4 w-64 bg-white/5 rounded" />
          </div>
          <div className="h-10 w-40 bg-white/5 rounded-lg" />
        </div>

        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-white/2 border border-white/5 rounded-2xl p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5" />
                <div>
                  <div className="h-4 w-48 bg-white/5 rounded mb-2" />
                  <div className="h-3 w-32 bg-white/5 rounded" />
                </div>
              </div>
              <div className="h-8 w-8 bg-white/5 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-white">Custom Domains</h1>
          <p className="text-white/40 mt-1">
            Connect your own domains to your tunnels · {currentDomainCount} /{" "}
            {isUnlimited ? "∞" : domainLimit} domains
          </p>
        </div>
        <button
          onClick={handleAddDomainClick}
          disabled={isAtLimit}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
            isAtLimit
              ? "bg-white/10 text-gray-400 cursor-not-allowed"
              : "bg-white text-black hover:bg-white/90"
          }`}
        >
          <Plus className="w-4 h-4" />
          Add Domain
        </button>
      </div>

      {/* Limit Warning */}
      {isAtLimit && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-500">
              Domain limit reached
            </p>
            <p className="text-xs text-gray-400 mt-1">
              You've reached your plan's limit of {domainLimit} custom domains.
              {currentPlan === "ray" && (
                <>
                  {" "}
                  Go to{" "}
                  <a
                    href="/dash/billing"
                    className="text-yellow-500 hover:underline"
                  >
                    Billing
                  </a>{" "}
                  to add more domain slots or upgrade to Beam for unlimited
                  domains.
                </>
              )}
              {currentPlan === "free" && (
                <> Upgrade to a paid plan to add custom domains.</>
              )}
            </p>
          </div>
        </div>
      )}

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#101010] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">Add New Domain</h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setError(null);
                  setNewDomain("");
                }}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Domain Name
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="e.g. api.myapp.com"
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                    autoFocus
                  />
                </div>
                <p className="mt-2 text-sm text-white/40">
                  Only subdomains are allowed (e.g., api.myapp.com,
                  app.example.io). Root domains like myapp.com are not
                  supported.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newDomain || createMutation.isPending}
                  className="px-4 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending ? "Adding..." : "Add Domain"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {domains.map((domain) => (
          <div
            key={domain.id}
            className="group flex items-center justify-between bg-white/2 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <Globe className="w-5 h-5 text-white/40" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-medium text-white">
                    {domain.domain}
                  </h3>
                  {domain.status === "active" ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-medium text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  ) : domain.status === "failed" ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400">
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs font-medium text-yellow-400">
                      <AlertCircle className="w-3 h-3" />
                      Pending DNS
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/40 mt-1">
                  Added on {new Date(domain.createdAt).toLocaleDateString()}
                </p>
                {domain.status !== "active" && (
                  <div className="mt-4 bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex items-start gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-xl shrink-0">
                        <Info className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white mb-1">
                          DNS Configuration
                        </h4>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Add these records to your domain provider to verify
                          ownership and route traffic. It may take a few minutes
                          for changes to propagate.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* CNAME Record */}
                      <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                        <div className="grid grid-cols-[60px_1fr_1fr_32px] gap-4 p-2.5 border-b border-white/5 text-[10px] font-medium text-white/40 uppercase tracking-wider">
                          <div>Type</div>
                          <div>Name</div>
                          <div>Value</div>
                          <div></div>
                        </div>
                        <div className="grid grid-cols-[60px_1fr_1fr_32px] gap-4 p-3 items-center">
                          <div>
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium ring-1 ring-inset ring-blue-500/20">
                              CNAME
                            </span>
                          </div>
                          <div
                            className="font-mono text-white/80 text-xs truncate"
                            title={getRecordName(domain.domain)}
                          >
                            {getRecordName(domain.domain)}
                          </div>
                          <div
                            className="font-mono text-white/60 text-xs truncate"
                            title="edge.outray.app"
                          >
                            edge.outray.app
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText("edge.outray.app")
                              }
                              className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                              title="Copy value"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* TXT Record */}
                      <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                        <div className="grid grid-cols-[60px_1fr_1fr_32px] gap-4 p-2.5 border-b border-white/5 text-[10px] font-medium text-white/40 uppercase tracking-wider">
                          <div>Type</div>
                          <div>Name</div>
                          <div>Value</div>
                          <div></div>
                        </div>
                        <div className="grid grid-cols-[60px_1fr_1fr_32px] gap-4 p-3 items-center">
                          <div>
                            <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium ring-1 ring-inset ring-purple-500/20">
                              TXT
                            </span>
                          </div>
                          <div
                            className="font-mono text-white/80 text-xs truncate"
                            title={
                              getRecordName(domain.domain) === "@"
                                ? "_outray-challenge"
                                : `_outray-challenge.${getRecordName(domain.domain)}`
                            }
                          >
                            {getRecordName(domain.domain) === "@"
                              ? "_outray-challenge"
                              : `_outray-challenge.${getRecordName(domain.domain)}`}
                          </div>
                          <div
                            className="font-mono text-white/60 text-xs truncate"
                            title={domain.id}
                          >
                            {domain.id}
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(domain.id)
                              }
                              className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
                              title="Copy value"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      <button
                        onClick={() => verifyMutation.mutate(domain.id)}
                        disabled={verifyMutation.isPending}
                        className="w-full py-2.5 bg-white text-black rounded-xl hover:bg-white/90 transition-colors font-medium disabled:opacity-50 text-sm"
                      >
                        {verifyMutation.isPending
                          ? "Verifying Configuration..."
                          : "Verify DNS Records"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to delete this domain?")) {
                    deleteMutation.mutate(domain.id);
                  }
                }}
                className="p-2 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded-lg transition-colors"
                title="Remove domain"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}

        {domains.length === 0 && !isCreating && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-white/20" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              No custom domains
            </h3>
            <p className="text-white/40 max-w-sm mx-auto mb-6">
              Add a custom domain to access your tunnels via your own branded
              URLs.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/5"
            >
              Add your first domain
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
