import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "../../lib/auth-client";
import { useEffect, useState } from "react";
import { Copy, Check, Download, Key, Play } from "lucide-react";

export const Route = createFileRoute("/dash/install")({
  component: Install,
});

function Install() {
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchToken = async () => {
      const session = await authClient.getSession();
      const orgId = session.data?.session.activeOrganizationId;

      if (orgId) {
        const res = await fetch(`/api/auth-tokens?organizationId=${orgId}`);
        const tokens = await res.json();
        if (tokens.length > 0) {
          setToken(tokens[0].token);
        }
      }
    };
    fetchToken();
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">
          Get Started with OutRay
        </h1>
        <p className="text-gray-400 text-lg">
          Follow these simple steps to expose your local services to the world.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Step 1: Install */}
        <div className="group relative overflow-hidden rounded-3xl bg-white/5 border border-white/5 p-8 backdrop-blur-sm transition-all hover:bg-white/10">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <Download size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
                <span className="text-xl font-bold">1</span>
              </div>
              <h2 className="text-2xl font-bold text-white">Install the CLI</h2>
            </div>
            <p className="text-gray-400 mb-6 max-w-xl">
              Install the OutRay CLI globally using npm. This will allow you to
              create and manage tunnels from your terminal.
            </p>
            <div className="bg-black/50 rounded-xl border border-white/10 p-4 flex items-center justify-between group/code">
              <code className="font-mono text-accent">
                npm install -g outray
              </code>
              <button
                onClick={() =>
                  navigator.clipboard.writeText("npm install -g outray")
                }
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors opacity-0 group-hover/code:opacity-100"
              >
                <Copy size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Authenticate */}
        <div className="group relative overflow-hidden rounded-3xl bg-white/5 border border-white/5 p-8 backdrop-blur-sm transition-all hover:bg-white/10">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <Key size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
                <span className="text-xl font-bold">2</span>
              </div>
              <h2 className="text-2xl font-bold text-white">Authenticate</h2>
            </div>
            <p className="text-gray-400 mb-6 max-w-xl">
              Link your CLI to your organization using your unique
              authentication token.
            </p>

            {token ? (
              <div className="space-y-4">
                <div className="bg-black/50 rounded-xl border border-white/10 p-1">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3">
                    <code className="font-mono text-sm text-gray-300 break-all">
                      outray login {token}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`outray login ${token}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="shrink-0 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-black hover:bg-accent/90 transition-colors"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                  <Key size={16} className="mt-0.5 shrink-0" />
                  <p>
                    Keep this token secret. It grants access to your
                    organization's tunnels.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-16 bg-white/5 animate-pulse rounded-xl" />
            )}
          </div>
        </div>

        {/* Step 3: Start Tunnel */}
        <div className="group relative overflow-hidden rounded-3xl bg-white/5 border border-white/5 p-8 backdrop-blur-sm transition-all hover:bg-white/10">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
            <Play size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20">
                <span className="text-xl font-bold">3</span>
              </div>
              <h2 className="text-2xl font-bold text-white">Start a Tunnel</h2>
            </div>
            <p className="text-gray-400 mb-6 max-w-xl">
              Expose your local service. For example, if your app is running on
              port 3000:
            </p>
            <div className="bg-black/50 rounded-xl border border-white/10 p-4 flex items-center justify-between group/code">
              <code className="font-mono text-accent">outray http 3000</code>
              <button
                onClick={() =>
                  navigator.clipboard.writeText("outray http 3000")
                }
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors opacity-0 group-hover/code:opacity-100"
              >
                <Copy size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
