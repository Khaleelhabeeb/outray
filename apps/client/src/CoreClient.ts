import WebSocket from "ws";
import { Protocol, Message, RequestMessage } from "./Protocol";
import { LocalForwarder } from "./LocalForwarder";
import { generateId } from "../../../shared/utils";

export class CoreClient {
  private ws: WebSocket | null = null;
  private forwarder: LocalForwarder;
  private serverUrl: string;
  private clientId: string;
  private tunnelUrl: string | null = null;

  constructor(serverUrl: string, localPort: number) {
    this.serverUrl = serverUrl;
    this.forwarder = new LocalForwarder(localPort);
    this.clientId = generateId("client");
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on("open", () => {
        console.log("Connected to OutRay server");

        const hello = Protocol.encode({
          type: "hello",
          clientId: this.clientId,
          version: "1.0.0",
        });
        this.ws!.send(hello);

        const openTunnel = Protocol.encode({
          type: "open_tunnel",
        });
        this.ws!.send(openTunnel);

        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      });

      this.ws.on("close", () => {
        console.log("Disconnected from OutRay server");
      });
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = Protocol.decode(data) as Message;

      if (message.type === "tunnel_opened") {
        this.tunnelUrl = message.url;
        console.log(`Tunnel opened: ${this.tunnelUrl}`);
      } else if (message.type === "request") {
        this.handleRequest(message);
      }
    } catch (error) {
      console.error("Message handling error:", error);
    }
  }

  private async handleRequest(request: RequestMessage): Promise<void> {
    try {
      const response = await this.forwarder.forward(
        request.method,
        request.path,
        request.headers,
        request.body,
      );

      const responseMessage = Protocol.encode({
        type: "response",
        requestId: request.requestId,
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body,
      });

      this.ws?.send(responseMessage);
    } catch (error) {
      console.error("Request forwarding error:", error);

      const errorResponse = Protocol.encode({
        type: "response",
        requestId: request.requestId,
        statusCode: 502,
        headers: {},
        body: "Bad Gateway",
      });

      this.ws?.send(errorResponse);
    }
  }

  disconnect(): void {
    this.ws?.close();
  }
}
