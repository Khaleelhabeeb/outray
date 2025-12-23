import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { eq, and } from "drizzle-orm";
import { db } from "../../../db";
import { domains } from "../../../db/app-schema";

export const Route = createFileRoute("/api/domain/verify-ownership")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            domain?: string;
            organizationId?: string;
          };

          const { domain, organizationId } = body;

          if (!domain || !organizationId) {
            return json(
              { valid: false, error: "Missing required fields" },
              { status: 400 },
            );
          }

          // Check if domain exists and belongs to the organization
          const [existingDomain] = await db
            .select()
            .from(domains)
            .where(
              and(
                eq(domains.domain, domain),
                eq(domains.organizationId, organizationId),
              ),
            );

          if (!existingDomain) {
            return json({
              valid: false,
              error: "Domain not found or does not belong to your organization",
            });
          }

          // Check if domain is active (DNS verified)
          if (existingDomain.status !== "active") {
            return json({
              valid: false,
              error: "Domain is not verified. Please verify DNS records first.",
            });
          }

          return json({ valid: true });
        } catch (error) {
          console.error("Domain verification error:", error);
          return json(
            { valid: false, error: "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
