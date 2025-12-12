import WebSocket, { WebSocketServer } from "ws";
import { Server as HTTPServer } from "http";
import { TunnelRouter } from "./TunnelRouter";
import { Protocol, Message } from "./Protocol";
import { generateId } from "../../../../shared/utils";

export class WSHandler {
  private wss: WebSocketServer;
  private router: TunnelRouter;

  constructor(httpServer: HTTPServer, router: TunnelRouter) {
    this.router = router;
    this.wss = new WebSocketServer({ server: httpServer });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      let tunnelId: string | null = null;

      ws.on("message", (data: WebSocket.Data) => {
        try {
          const message = Protocol.decode(data.toString()) as Message;

          if (message.type === "hello") {
            console.log(`Client connected: ${message.clientId}`);
          } else if (message.type === "open_tunnel") {
            tunnelId = message.subdomain || generateId("tunnel");
            this.router.registerTunnel(tunnelId, ws);

            const response = Protocol.encode({
              type: "tunnel_opened",
              tunnelId,
              url: `https://${tunnelId}.outray.dev`,
            });

            ws.send(response);
            console.log(`Tunnel opened: ${tunnelId}`);
          } else if (tunnelId) {
            this.router.handleMessage(tunnelId, message);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      });

      ws.on("close", () => {
        if (tunnelId) {
          this.router.unregisterTunnel(tunnelId);
          console.log(`Tunnel closed: ${tunnelId}`);
        }
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });
  }
}
