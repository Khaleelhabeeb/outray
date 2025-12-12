import WebSocket from "ws";
import chalk from "chalk";
import { encodeMessage, decodeMessage } from "./protocol";
import { TunnelDataMessage, TunnelResponseMessage } from "./types";
import http from "http";

export class OutRayClient {
  private ws: WebSocket | null = null;
  private localPort: number;
  private serverUrl: string;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  private assignedUrl: string | null = null;

  constructor(localPort: number, serverUrl: string = "wss://api.outray.dev/") {
    this.localPort = localPort;
    this.serverUrl = serverUrl;
  }

  public start(): void {
    this.connect();
  }

  public stop(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connect(): void {
    console.log(chalk.cyan("✨ Connecting to OutRay..."));

    this.ws = new WebSocket(this.serverUrl);

    this.ws.on("open", () => this.handleOpen());
    this.ws.on("message", (data) => this.handleMessage(data.toString()));
    this.ws.on("close", () => this.handleClose());
    this.ws.on("error", (error) => {
      console.log(chalk.red(`❌ WebSocket error: ${error.message}`));
    });
  }

  private handleOpen(): void {
    console.log(chalk.green(`🔌 Linked to your local port ${this.localPort}`));

    const handshake = encodeMessage({ type: "open_tunnel" });
    this.ws?.send(handshake);
  }

  private handleMessage(data: string): void {
    try {
      const message = decodeMessage(data);

      if (message.type === "tunnel_opened") {
        this.assignedUrl = message.url;
        console.log(chalk.magenta(`🌐 Tunnel ready: ${message.url}`));
        console.log(chalk.yellow("🥹 Don't close this or I'll cry softly."));
      } else if (message.type === "request") {
        this.handleTunnelData(message);
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to parse message: ${error}`));
    }
  }

  private handleTunnelData(message: TunnelDataMessage): void {
    const reqOptions = {
      hostname: "localhost",
      port: this.localPort,
      path: message.path,
      method: message.method,
      headers: message.headers,
    };

    const req = http.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });

      res.on("end", () => {
        const bodyBuffer = Buffer.concat(chunks);
        const bodyBase64 =
          bodyBuffer.length > 0 ? bodyBuffer.toString("base64") : undefined;

        const response: TunnelResponseMessage = {
          type: "response",
          requestId: message.requestId,
          statusCode: res.statusCode || 200,
          headers: res.headers as any,
          body: bodyBase64,
        };

        this.ws?.send(encodeMessage(response));
      });
    });

    req.on("error", (err) => {
      const errorResponse: TunnelResponseMessage = {
        type: "response",
        requestId: message.requestId,
        statusCode: 502,
        headers: { "content-type": "text/plain" },
        body: Buffer.from(`Bad Gateway: ${err.message}`).toString("base64"),
      };

      this.ws?.send(encodeMessage(errorResponse));
    });

    if (message.body) {
      const bodyBuffer = Buffer.from(message.body, "base64");
      req.write(bodyBuffer);
    }

    req.end();
  }

  private handleClose(): void {
    if (!this.shouldReconnect) return;

    console.log(chalk.yellow("😵 Disconnected from OutRay. Retrying in 2s…"));

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 2000);
  }
}
