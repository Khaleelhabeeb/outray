import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Globe, Plus, Trash2, Loader2 } from "lucide-react";
import { appClient } from "../../lib/app-client";
import { authClient } from "../../lib/auth-client";

export const Route = createFileRoute("/dash/subdomains")({
  component: SubdomainsView,
});

function SubdomainsView() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const queryClient = useQueryClient();
  const [newSubdomain, setNewSubdomain] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["subdomains", activeOrg?.id],
    queryFn: () => {
      if (!activeOrg?.id) throw new Error("No active organization");
      return appClient.subdomains.list(activeOrg.id);
    },
    enabled: !!activeOrg?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (subdomain: string) => {
      if (!activeOrg?.id) throw new Error("No active organization");
      return appClient.subdomains.create({
        subdomain,
        organizationId: activeOrg.id,
      });
    },
    onSuccess: (data) => {
      if ("error" in data) {
        setError(data.error);
      } else {
        setNewSubdomain("");
        setIsCreating(false);
        queryClient.invalidateQueries({ queryKey: ["subdomains"] });
      }
    },
    onError: () => {
      setError("Failed to create subdomain");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return appClient.subdomains.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subdomains"] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate(newSubdomain);
  };

  const subdomains = data && "subdomains" in data ? data.subdomains : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Subdomains</h1>
          <p className="text-gray-400 mt-1">
            Reserve subdomains for your tunnels.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          Reserve Subdomain
        </button>
      </div>

      {isCreating && (
        <div className="bg-black border border-white/10 rounded-lg p-4">
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Subdomain
              </label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={newSubdomain}
                  onChange={(e) => setNewSubdomain(e.target.value)}
                  placeholder="my-app"
                  className="flex-1 bg-black border border-white/10 rounded-l-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <div className="bg-white/5 border border-l-0 border-white/10 rounded-r-lg px-4 py-2 text-gray-400">
                  .outray.dev
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setError(null);
                  setNewSubdomain("");
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? "Reserving..." : "Reserve"}
              </button>
            </div>
          </form>
          {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-gray-500" size={24} />
        </div>
      ) : subdomains.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white/5 rounded-lg border border-white/5">
          No subdomains reserved yet.
        </div>
      ) : (
        <div className="grid gap-4">
          {subdomains.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between bg-black border border-white/5 rounded-lg p-4 hover:border-white/10 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                  <Globe size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white">
                      {sub.subdomain}.outray.dev
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
                      Reserved
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Created on {new Date(sub.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (
                    confirm("Are you sure you want to release this subdomain?")
                  ) {
                    deleteMutation.mutate(sub.id);
                  }
                }}
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
