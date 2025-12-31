import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { auth } from "../../../lib/auth";
import { db } from "../../../db";
import { tunnels } from "../../../db/app-schema";
import { redis } from "../../../lib/redis";

export const Route = createFileRoute("/api/tunnels/$tunnelId/stop")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return json({ error: "Unauthorized" }, { status: 401 });
        }

        const { tunnelId } = params;

        const [tunnel] = await db
          .select()
          .from(tunnels)
          .where(eq(tunnels.id, tunnelId));

        if (!tunnel) {
          return json({ error: "Tunnel not found" }, { status: 404 });
        }

        if (tunnel.organizationId) {
          const organizations = await auth.api.listOrganizations({
            headers: request.headers,
          });
          const hasAccess = organizations.find(
            (org) => org.id === tunnel.organizationId,
          );
          if (!hasAccess) {
            return json({ error: "Unauthorized" }, { status: 403 });
          }
        } else if (tunnel.userId !== session.user.id) {
          return json({ error: "Unauthorized" }, { status: 403 });
        }

        // Kill the tunnel connection if it's active
        // For HTTP tunnels: use full hostname (subdomain.outray.app)
        // For TCP/UDP tunnels: use just the subdomain
        let tunnelIdentifier = tunnel.url;
        try {
          // Handle different URL formats
          // HTTP: https://subdomain.outray.app
          // TCP/UDP: tcp://subdomain.outray.app:port or udp://subdomain.outray.app:port
          const protocol = tunnel.protocol || "http";

          if (protocol === "tcp" || protocol === "udp") {
            // For TCP/UDP, extract just the subdomain
            const urlObj = new URL(tunnel.url.replace(/^(tcp|udp):/, "https:"));
            const hostname = urlObj.hostname;
            // Extract subdomain from hostname (e.g., "pretty-cake" from "pretty-cake.outray.app")
            tunnelIdentifier = hostname.split(".")[0];
          } else {
            // For HTTP, use full hostname
            const urlObj = new URL(
              tunnel.url.startsWith("http")
                ? tunnel.url
                : `https://${tunnel.url}`,
            );
            tunnelIdentifier = urlObj.hostname;
          }
        } catch (e) {
          // ignore
        }

        await redis.publish("tunnel:control", `kill:${tunnelIdentifier}`);

        return json({ message: "Tunnel stopped" });
      },
    },
  },
});
