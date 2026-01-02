import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import pg from "pg";

import { requireOrgFromSlug } from "../../../lib/org";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.TIGER_DATA_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const Route = createFileRoute("/api/$orgSlug/requests")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const orgResult = await requireOrgFromSlug(request, params.orgSlug);
        if ("error" in orgResult) return orgResult.error;
        const { organization } = orgResult;

        const url = new URL(request.url);
        const tunnelId = url.searchParams.get("tunnelId");
        const timeRange = url.searchParams.get("range") || "1h";
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const search = url.searchParams.get("search");

        let intervalValue = "1 hour";
        if (timeRange === "24h") {
          intervalValue = "24 hours";
        } else if (timeRange === "7d") {
          intervalValue = "7 days";
        } else if (timeRange === "30d") {
          intervalValue = "30 days";
        }

        const organizationId = organization.id;

        try {
          const queryParams: any[] = [organizationId, intervalValue];
          let paramIndex = 3;

          let query = `
              SELECT 
                timestamp,
                tunnel_id,
                organization_id,
                host,
                method,
                path,
                status_code,
                request_duration_ms,
                bytes_in,
                bytes_out,
                client_ip,
                user_agent
              FROM tunnel_events
              WHERE organization_id = $1
                AND timestamp >= NOW() - $2::interval
          `;

          if (tunnelId) {
            query += ` AND tunnel_id = $${paramIndex}`;
            queryParams.push(tunnelId);
            paramIndex++;
          }

          if (search) {
            query += ` AND (path ILIKE $${paramIndex} OR method ILIKE $${paramIndex} OR host ILIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
          }

          query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
          queryParams.push(limit);

          const requestsResult = await pool.query(query, queryParams);
          const requests = requestsResult.rows;

          return json({
            requests,
            timeRange,
            count: requests.length,
          });
        } catch (error) {
          console.error("Failed to fetch requests:", error);
          return json({ error: "Failed to fetch requests" }, { status: 500 });
        }
      },
    },
  },
});
