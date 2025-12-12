export interface OpenTunnelMessage {
  type: "open_tunnel";
  subdomain?: string | null;
}

export interface TunnelOpenedMessage {
  type: "tunnel_opened";
  url: string;
}

export interface TunnelDataMessage {
  type: "request";
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string | string[]>;
  body?: string;
}

export interface TunnelResponseMessage {
  type: "response";
  requestId: string;
  statusCode: number;
  headers: Record<string, string | string[]>;
  body?: string;
}

export type ServerMessage = TunnelOpenedMessage | TunnelDataMessage;
export type ClientMessage = OpenTunnelMessage | TunnelResponseMessage;
