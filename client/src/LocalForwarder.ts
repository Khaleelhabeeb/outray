import http from "http";

export interface ForwardedResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
}

export class LocalForwarder {
  private localPort: number;

  constructor(localPort: number) {
    this.localPort = localPort;
  }

  async forward(
    method: string,
    path: string,
    headers: Record<string, string | string[]>,
    bodyBase64?: string,
  ): Promise<ForwardedResponse> {
    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: "localhost",
        port: this.localPort,
        path,
        method,
        headers,
      };

      const req = http.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const responseHeaders: Record<string, string | string[]> = {};
          Object.entries(res.headers).forEach(([key, value]) => {
            if (value !== undefined) {
              responseHeaders[key] = value;
            }
          });

          const responseBuffer = Buffer.concat(chunks);
          const responseBodyBase64 =
            responseBuffer.length > 0 ? responseBuffer.toString("base64") : "";

          resolve({
            statusCode: res.statusCode || 200,
            headers: responseHeaders,
            body: responseBodyBase64,
          });
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      if (bodyBase64) {
        const bodyBuffer = Buffer.from(bodyBase64, "base64");
        req.write(bodyBuffer);
      }

      req.end();
    });
  }
}
