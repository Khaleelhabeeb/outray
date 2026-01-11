import type { TunnelEvent, RequestDetails, ResponseDetails } from "./types";

export function getMockRequestDetails(req: TunnelEvent): RequestDetails {
  return {
    headers: {
      Host: req.host,
      "User-Agent": req.user_agent,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "X-Forwarded-For": req.client_ip,
      "X-Request-ID": `req_${req.tunnel_id.slice(0, 8)}`,
    },
    queryParams:
      req.path.includes("?")
        ? Object.fromEntries(new URLSearchParams(req.path.split("?")[1]))
        : {},
    body:
      req.method !== "GET" && req.method !== "HEAD"
        ? JSON.stringify({ example: "request body", timestamp: req.timestamp }, null, 2)
        : null,
  };
}

export function getMockResponseDetails(req: TunnelEvent): ResponseDetails {
  return {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(req.bytes_out),
      "X-Response-Time": `${req.request_duration_ms}ms`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Request-ID": `req_${req.tunnel_id.slice(0, 8)}`,
      Date: new Date(req.timestamp).toUTCString(),
    },
    body: JSON.stringify(
      {
        success: req.status_code < 400,
        data: req.status_code < 400 ? { id: 1, message: "Sample response" } : null,
        error: req.status_code >= 400 ? "An error occurred" : null,
      },
      null,
      2
    ),
  };
}

export function formatBytes(bytes: number, decimals = 0) {
  if (!+bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function generateCurl(req: TunnelEvent): string {
  const details = getMockRequestDetails(req);
  let curl = `curl -X ${req.method} 'https://${req.host}${req.path}'`;
  Object.entries(details.headers).forEach(([key, value]) => {
    curl += ` \\\n  -H '${key}: ${value}'`;
  });
  if (details.body) {
    curl += ` \\\n  -d '${details.body.replace(/\n/g, "")}'`;
  }
  return curl;
}
