import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { auth } from "../../../lib/auth";
import { redis } from "../../../lib/redis";
import { createClient } from "@clickhouse/client";

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "default",
});

export const Route = createFileRoute("/api/stats/overview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
          return json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const organizationId = url.searchParams.get("organizationId");
        const timeRange = url.searchParams.get("range") || "24h";

        if (!organizationId) {
          return json({ error: "Organization ID required" }, { status: 400 });
        }

        const organizations = await auth.api.listOrganizations({
          headers: request.headers,
        });

        const hasAccess = organizations.find(
          (org) => org.id === organizationId,
        );

        if (!hasAccess) {
          return json({ error: "Unauthorized" }, { status: 403 });
        }

        try {
          let interval = "24 HOUR";
          let prevIntervalStart = "48 HOUR";
          let prevIntervalEnd = "24 HOUR";

          switch (timeRange) {
            case "1h":
              interval = "1 HOUR";
              prevIntervalStart = "2 HOUR";
              prevIntervalEnd = "1 HOUR";
              break;
            case "7d":
              interval = "7 DAY";
              prevIntervalStart = "14 DAY";
              prevIntervalEnd = "7 DAY";
              break;
            case "30d":
              interval = "30 DAY";
              prevIntervalStart = "60 DAY";
              prevIntervalEnd = "30 DAY";
              break;
          }

          const totalRequestsResult = await clickhouse.query({
            query: `
              SELECT count() as total
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const totalRequestsData =
            (await totalRequestsResult.json()) as Array<{ total: string }>;
          const totalRequests = parseInt(totalRequestsData[0]?.total || "0");

          const requestsYesterdayResult = await clickhouse.query({
            query: `
              SELECT count() as total
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL ${prevIntervalStart}
                AND timestamp < now64() - INTERVAL ${prevIntervalEnd}
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const requestsYesterdayData =
            (await requestsYesterdayResult.json()) as Array<{ total: string }>;
          const requestsYesterday = parseInt(
            requestsYesterdayData[0]?.total || "0",
          );

          const recentRequestsResult = await clickhouse.query({
            query: `
              SELECT count() as total
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const recentRequestsData =
            (await recentRequestsResult.json()) as Array<{ total: string }>;
          const recentRequests = parseInt(recentRequestsData[0]?.total || "0");

          const requestsChange =
            requestsYesterday > 0
              ? ((recentRequests - requestsYesterday) / requestsYesterday) * 100
              : recentRequests > 0
                ? 100
                : 0;

          const dataTransferResult = await clickhouse.query({
            query: `
              SELECT 
                sum(bytes_in) as total_in,
                sum(bytes_out) as total_out
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const dataTransferData = (await dataTransferResult.json()) as Array<{
            total_in: string;
            total_out: string;
          }>;
          const totalBytesIn = Number(dataTransferData[0]?.total_in || 0);
          const totalBytesOut = Number(dataTransferData[0]?.total_out || 0);
          const totalBytes = totalBytesIn + totalBytesOut;

          const dataYesterdayResult = await clickhouse.query({
            query: `
              SELECT 
                sum(bytes_in) as total_in,
                sum(bytes_out) as total_out
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL ${prevIntervalStart}
                AND timestamp < now64() - INTERVAL ${prevIntervalEnd}
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const dataYesterdayData =
            (await dataYesterdayResult.json()) as Array<{
              total_in: string;
              total_out: string;
            }>;
          const bytesYesterdayIn = Number(dataYesterdayData[0]?.total_in || 0);
          const bytesYesterdayOut = Number(
            dataYesterdayData[0]?.total_out || 0,
          );
          const bytesYesterday = bytesYesterdayIn + bytesYesterdayOut;

          const dataRecentResult = await clickhouse.query({
            query: `
              SELECT 
                sum(bytes_in) as total_in,
                sum(bytes_out) as total_out
              FROM tunnel_events
              WHERE organization_id = {organizationId:String}
                AND timestamp >= now64() - INTERVAL ${interval}
            `,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const dataRecentData = (await dataRecentResult.json()) as Array<{
            total_in: string;
            total_out: string;
          }>;
          const bytesRecentIn = Number(dataRecentData[0]?.total_in || 0);
          const bytesRecentOut = Number(dataRecentData[0]?.total_out || 0);
          const bytesRecent = bytesRecentIn + bytesRecentOut;

          const dataTransferChange =
            bytesYesterday > 0
              ? ((bytesRecent - bytesYesterday) / bytesYesterday) * 100
              : bytesRecent > 0
                ? 100
                : 0;

          // Get active tunnels count from Redis ZSET
          const zsetKey = `org:${organizationId}:active_tunnels`;
          // Remove expired entries
          await redis.zremrangebyscore(zsetKey, "-inf", Date.now());
          // Count active tunnels
          const activeTunnelsCount = await redis.zcard(zsetKey);

          // Get chart data based on time range
          let chartQuery = "";
          if (timeRange === "1h") {
            chartQuery = `
              WITH times AS (
                SELECT toStartOfMinute(now64() - INTERVAL number MINUTE) as time
                FROM numbers(60)
              )
              SELECT 
                t.time as time,
                countIf(e.organization_id = {organizationId:String}) as requests
              FROM times t
              LEFT JOIN tunnel_events e ON toStartOfMinute(e.timestamp) = t.time
                AND e.organization_id = {organizationId:String}
              GROUP BY t.time
              ORDER BY t.time ASC
            `;
          } else if (timeRange === "24h") {
            chartQuery = `
              WITH times AS (
                SELECT toStartOfHour(now64() - INTERVAL number HOUR) as time
                FROM numbers(24)
              )
              SELECT 
                t.time as time,
                countIf(e.organization_id = {organizationId:String}) as requests
              FROM times t
              LEFT JOIN tunnel_events e ON toStartOfHour(e.timestamp) = t.time
                AND e.organization_id = {organizationId:String}
              GROUP BY t.time
              ORDER BY t.time ASC
            `;
          } else {
            // For 7d and 30d, group by day
            const days = timeRange === "7d" ? 7 : 30;
            chartQuery = `
              WITH times AS (
                SELECT toStartOfDay(now64() - INTERVAL number DAY) as time
                FROM numbers(${days})
              )
              SELECT 
                t.time as time,
                countIf(e.organization_id = {organizationId:String}) as requests
              FROM times t
              LEFT JOIN tunnel_events e ON toStartOfDay(e.timestamp) = t.time
                AND e.organization_id = {organizationId:String}
              GROUP BY t.time
              ORDER BY t.time ASC
            `;
          }

          const chartDataResult = await clickhouse.query({
            query: chartQuery,
            query_params: { organizationId },
            format: "JSONEachRow",
          });
          const chartData = (await chartDataResult.json()) as Array<{
            time: string;
            requests: string;
          }>;

          return json({
            totalRequests,
            requestsChange: Math.round(requestsChange),
            activeTunnels: activeTunnelsCount,
            activeTunnelsChange: 0,
            totalDataTransfer: totalBytes,
            dataTransferChange: Math.round(dataTransferChange),
            chartData: chartData.map((d) => ({
              hour: d.time,
              requests: parseInt(d.requests),
            })),
          });
        } catch (error) {
          console.error("Error fetching stats:", error);
          return json({ error: "Failed to fetch statistics" }, { status: 500 });
        }
      },
    },
  },
});
