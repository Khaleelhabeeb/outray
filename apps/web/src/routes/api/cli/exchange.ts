import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { db } from "../../../db";
import { cliOrgTokens, members, cliUserTokens } from "../../../db/auth-schema";
import { eq, and, gt } from "drizzle-orm";
import { randomUUID, randomBytes } from "crypto";
import {rateLimiters, getClientIdentifier, createRateLimitResponse,} from "../../../lib/rate-limiter";

export const Route = createFileRoute("/api/cli/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Rate limit: 20 requests per minute per IP
          const clientId = getClientIdentifier(request);
          const rateLimitResult = await rateLimiters.tokenExchange(clientId);

          if (!rateLimitResult.allowed) {
            return createRateLimitResponse(rateLimitResult);
          }

          const authHeader = request.headers.get("Authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return json({ error: "Unauthorized" }, { status: 401 });
          }

          const token = authHeader.substring(7);
          const body = await request.json();
          const { orgId } = body;

          if (!orgId) {
            return json({ error: "orgId is required" }, { status: 400 });
          }

          // Verify user token
          const userToken = await db.query.cliUserTokens.findFirst({
            where: and(
              eq(cliUserTokens.token, token),
              gt(cliUserTokens.expiresAt, new Date()),
            ),
          });

          if (!userToken) {
            return json({ error: "Invalid user token" }, { status: 401 });
          }

          // Verify user has access to org
          const membership = await db.query.members.findFirst({
            where: and(
              eq(members.userId, userToken.userId),
              eq(members.organizationId, orgId),
            ),
          });

          if (!membership) {
            return json(
              { error: "Access denied to organization" },
              { status: 403 },
            );
          }

          // Create org token (valid for 30 days)
          const orgToken = randomBytes(32).toString("hex");
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await db.insert(cliOrgTokens).values({
            id: randomUUID(),
            token: orgToken,
            userId: userToken.userId,
            organizationId: orgId,
            expiresAt,
          });

          return json({
            orgToken,
            expiresAt: expiresAt.toISOString(),
          });
        } catch (error) {
          console.error("Token exchange error:", error);
          return json({ error: "Failed to exchange token" }, { status: 500 });
        }
      },
    },
  },
});
