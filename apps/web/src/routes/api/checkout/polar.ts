import { createFileRoute } from "@tanstack/react-router";
import { Checkout } from "@polar-sh/tanstack-start";

export const Route = createFileRoute("/api/checkout/polar")({
  server: {
    handlers: {
      GET: Checkout({
        accessToken: process.env.POLAR_ACCESS_TOKEN!,
        successUrl: process.env.APP_URL + "/dash/billing?success=true",
        returnUrl: process.env.APP_URL + "/dash/billing",
        server:
          process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
        theme: "dark",
      }),
    },
  },
});
