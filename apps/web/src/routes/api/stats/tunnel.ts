import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { auth } from "../../../lib/auth";
import { db } from "../../../db";
import { tunnels } from "../../../db/app-schema";
import { createClient } from "@clickhouse/client";

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

export const Route = createFileRoute("/api/stats/tunnel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const tunnelId = url.searchParams.get("tunnelId");
        const timeRange = url.searchParams.get("range") || "24h";

        if (!tunnelId) {
          return json({ error: "Tunnel ID required" }, { status: 400 });
        }

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

        let interval = "24 HOUR";
        let groupBy = "toStartOfHour";
        let format = "%H:%M";

        if (timeRange === "1h") {
          interval = "1 HOUR";
          groupBy = "toStartOfMinute";
          format = "%H:%M";
        } else if (timeRange === "7d") {
          interval = "7 DAY";
          groupBy = "toStartOfDay";
          format = "%Y-%m-%d";
        } else if (timeRange === "30d") {
          interval = "30 DAY";
          groupBy = "toStartOfDay";
          format = "%Y-%m-%d";
        }

        try {
          const totalRequestsResult = await clickhouse.query({
            query: `
              SELECT count() as total
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const totalRequestsData =
            (await totalRequestsResult.json()) as Array<{ total: string }>;
          const totalRequests = parseInt(totalRequestsData[0]?.total || "0");

          const durationResult = await clickhouse.query({
            query: `
              SELECT avg(request_duration_ms) as avg_duration
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const durationData = (await durationResult.json()) as Array<{
            avg_duration: string;
          }>;
          const avgDuration = parseFloat(durationData[0]?.avg_duration || "0");

          const bandwidthResult = await clickhouse.query({
            query: `
              SELECT sum(bytes_in + bytes_out) as total_bytes
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const bandwidthData = (await bandwidthResult.json()) as Array<{
            total_bytes: string;
          }>;
          const totalBandwidth = parseInt(bandwidthData[0]?.total_bytes || "0");

          const errorRateResult = await clickhouse.query({
            query: `
              SELECT 
                countIf(status_code >= 400) as errors,
                count() as total
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const errorRateData = (await errorRateResult.json()) as Array<{
            errors: string;
            total: string;
          }>;
          const errorCount = parseInt(errorRateData[0]?.errors || "0");
          const totalCount = parseInt(errorRateData[0]?.total || "0");
          const errorRate =
            totalCount > 0 ? (errorCount / totalCount) * 100 : 0;

          const chartResult = await clickhouse.query({
            query: `
              SELECT 
                ${groupBy}(timestamp) as time,
                count() as requests,
                avg(request_duration_ms) as duration
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
              GROUP BY time
              ORDER BY time ASC
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const chartData = (await chartResult.json()) as Array<{
            time: string;
            requests: string;
            duration: string;
          }>;

          const requestsResult = await clickhouse.query({
            query: `
              SELECT 
                timestamp,
                method,
                path,
                status_code,
                request_duration_ms,
                bytes_in + bytes_out as size
              FROM tunnel_events
              WHERE tunnel_id = {tunnelId:String}
              ORDER BY timestamp DESC
              LIMIT 50
            `,
            query_params: { tunnelId },
            format: "JSONEachRow",
          });
          const requests = (await requestsResult.json()) as Array<any>;

          return json({
            stats: {
              totalRequests,
              avgDuration,
              totalBandwidth,
              errorRate,
            },
            chartData: chartData.map((d) => ({
              time: d.time,
              requests: parseInt(d.requests),
              duration: parseFloat(d.duration),
            })),
            requests: requests.map((r) => ({
              id: r.timestamp,
              method: r.method,
              path: r.path,
              status: r.status_code,
              duration: r.request_duration_ms,
              time: r.timestamp,
              size: r.size,
            })),
          });
        } catch (error) {
          console.error("Failed to fetch tunnel stats:", error);
          return json({ error: "Failed to fetch stats" }, { status: 500 });
        }
      },
    },
  },
});
