import pg from "pg";
import { config } from "../config";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.tigerDataUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function execute(text: string, params?: unknown[]): Promise<void> {
  await pool.query(text, params);
}

export interface TunnelEvent {
  timestamp: number;
  tunnel_id: string;
  organization_id: string;
  retention_days: number;
  host: string;
  method: string;
  path: string;
  status_code: number;
  request_duration_ms: number;
  bytes_in: number;
  bytes_out: number;
  client_ip: string;
  user_agent: string;
}

export async function checkTimescaleDBConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to TimescaleDB");
    client.release();
    return true;
  } catch (error) {
    console.error("❌ Failed to connect to TimescaleDB:", error);
    return false;
  }
}

class TimescaleDBLogger {
  private buffer: TunnelEvent[] = [];
  private flushInterval: NodeJS.Timeout;
  private readonly BATCH_SIZE = 1000;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  public log(event: TunnelEvent) {
    this.buffer.push(event);
    if (this.buffer.length >= this.BATCH_SIZE) {
      void this.flush();
    }
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      // Build batch insert query
      const values: unknown[] = [];
      const placeholders: string[] = [];

      events.forEach((event, i) => {
        const offset = i * 13;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13})`,
        );
        values.push(
          new Date(event.timestamp),
          event.tunnel_id,
          event.organization_id,
          event.retention_days,
          event.host,
          event.method,
          event.path,
          event.status_code,
          event.request_duration_ms,
          event.bytes_in,
          event.bytes_out,
          event.client_ip,
          event.user_agent,
        );
      });

      const query = `
        INSERT INTO tunnel_events (
          timestamp, tunnel_id, organization_id, retention_days, host, method, 
          path, status_code, request_duration_ms, bytes_in, bytes_out, client_ip, user_agent
        ) VALUES ${placeholders.join(", ")}
      `;

      await execute(query, values);
    } catch (error) {
      console.error("Failed to flush events to TimescaleDB:", error);
    }
  }

  public async shutdown() {
    clearInterval(this.flushInterval);
    await this.flush();
    await pool.end();
  }
}

export const logger = new TimescaleDBLogger();

// Protocol events for TCP/UDP tunnels
export interface ProtocolEvent {
  timestamp: number;
  tunnel_id: string;
  organization_id: string;
  retention_days: number;
  protocol: "tcp" | "udp";
  event_type: "connection" | "data" | "close" | "packet";
  connection_id: string;
  client_ip: string;
  client_port: number;
  bytes_in: number;
  bytes_out: number;
  duration_ms: number;
}

class ProtocolLogger {
  private buffer: ProtocolEvent[] = [];
  private flushInterval: NodeJS.Timeout;
  private readonly BATCH_SIZE = 1000;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.FLUSH_INTERVAL_MS);
  }

  public log(event: ProtocolEvent) {
    this.buffer.push(event);
    if (this.buffer.length >= this.BATCH_SIZE) {
      void this.flush();
    }
  }

  public logTCPConnection(
    tunnelId: string,
    organizationId: string,
    connectionId: string,
    clientIp: string,
    clientPort: number,
    retentionDays: number = 3,
  ) {
    this.log({
      timestamp: Date.now(),
      tunnel_id: tunnelId,
      organization_id: organizationId,
      retention_days: retentionDays,
      protocol: "tcp",
      event_type: "connection",
      connection_id: connectionId,
      client_ip: clientIp,
      client_port: clientPort,
      bytes_in: 0,
      bytes_out: 0,
      duration_ms: 0,
    });
  }

  public logTCPData(
    tunnelId: string,
    organizationId: string,
    connectionId: string,
    clientIp: string,
    clientPort: number,
    bytesIn: number,
    bytesOut: number,
    retentionDays: number = 3,
  ) {
    this.log({
      timestamp: Date.now(),
      tunnel_id: tunnelId,
      organization_id: organizationId,
      retention_days: retentionDays,
      protocol: "tcp",
      event_type: "data",
      connection_id: connectionId,
      client_ip: clientIp,
      client_port: clientPort,
      bytes_in: bytesIn,
      bytes_out: bytesOut,
      duration_ms: 0,
    });
  }

  public logTCPClose(
    tunnelId: string,
    organizationId: string,
    connectionId: string,
    clientIp: string,
    clientPort: number,
    durationMs: number,
    retentionDays: number = 3,
  ) {
    this.log({
      timestamp: Date.now(),
      tunnel_id: tunnelId,
      organization_id: organizationId,
      retention_days: retentionDays,
      protocol: "tcp",
      event_type: "close",
      connection_id: connectionId,
      client_ip: clientIp,
      client_port: clientPort,
      bytes_in: 0,
      bytes_out: 0,
      duration_ms: durationMs,
    });
  }

  public logUDPPacket(
    tunnelId: string,
    organizationId: string,
    clientIp: string,
    clientPort: number,
    bytesIn: number,
    bytesOut: number,
    retentionDays: number = 3,
  ) {
    this.log({
      timestamp: Date.now(),
      tunnel_id: tunnelId,
      organization_id: organizationId,
      retention_days: retentionDays,
      protocol: "udp",
      event_type: "packet",
      connection_id: "",
      client_ip: clientIp,
      client_port: clientPort,
      bytes_in: bytesIn,
      bytes_out: bytesOut,
      duration_ms: 0,
    });
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      // Build batch insert query
      const values: unknown[] = [];
      const placeholders: string[] = [];

      events.forEach((event, i) => {
        const offset = i * 12;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12})`,
        );
        values.push(
          new Date(event.timestamp),
          event.tunnel_id,
          event.organization_id,
          event.retention_days,
          event.protocol,
          event.event_type,
          event.connection_id,
          event.client_ip,
          event.client_port,
          event.bytes_in,
          event.bytes_out,
          event.duration_ms,
        );
      });

      const query = `
        INSERT INTO protocol_events (
          timestamp, tunnel_id, organization_id, retention_days, protocol, event_type,
          connection_id, client_ip, client_port, bytes_in, bytes_out, duration_ms
        ) VALUES ${placeholders.join(", ")}
      `;

      await execute(query, values);
    } catch (error) {
      console.error("Failed to flush protocol events to TimescaleDB:", error);
    }
  }

  public async shutdown() {
    clearInterval(this.flushInterval);
    await this.flush();
  }
}

export const protocolLogger = new ProtocolLogger();
