-- Migration script: ClickHouse to Tiger Data (TimescaleDB Cloud)
-- 
-- This uses the new Tiger Data syntax for creating hypertables
-- See: https://docs.timescale.com/use-timescale/latest/hypertables/
--
-- This script is idempotent - safe to run multiple times in CI

-- ============================================================================
-- Cleanup existing objects (safe drops)
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS protocol_stats_1m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS tunnel_stats_1m CASCADE;
DROP TABLE IF EXISTS protocol_events CASCADE;
DROP TABLE IF EXISTS tunnel_events CASCADE;
DROP TABLE IF EXISTS active_tunnel_snapshots CASCADE;

-- Drop functions (use CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS cleanup_expired_protocol_events() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_tunnel_events() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_events() CASCADE;

-- Remove existing cleanup job if it exists
DO $$
DECLARE
    job_id_to_delete INTEGER;
BEGIN
    SELECT job_id INTO job_id_to_delete
    FROM timescaledb_information.jobs
    WHERE proc_name = 'cleanup_expired_events' AND proc_schema = 'public'
    LIMIT 1;
    
    IF job_id_to_delete IS NOT NULL THEN
        PERFORM delete_job(job_id_to_delete);
    END IF;
END $$;

-- ============================================================================
-- Active tunnel snapshots (for cron job)
-- ============================================================================
CREATE TABLE active_tunnel_snapshots (
    ts TIMESTAMPTZ NOT NULL,
    active_tunnels INTEGER NOT NULL
)
WITH (
    tsdb.hypertable,
    tsdb.chunk_interval = '1 day'
);

-- ============================================================================
-- Tunnel events (HTTP requests)
-- ============================================================================
CREATE TABLE tunnel_events (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tunnel_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    retention_days SMALLINT DEFAULT 3,
    host TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code SMALLINT NOT NULL,
    request_duration_ms INTEGER NOT NULL,
    bytes_in INTEGER NOT NULL,
    bytes_out INTEGER NOT NULL,
    client_ip TEXT NOT NULL,
    user_agent TEXT NOT NULL
)
WITH (
    tsdb.hypertable,
    tsdb.chunk_interval = '1 day'
);

-- Create index for common queries
CREATE INDEX idx_tunnel_events_tunnel_id ON tunnel_events (tunnel_id, timestamp DESC);
CREATE INDEX idx_tunnel_events_organization_id ON tunnel_events (organization_id, timestamp DESC);

-- ============================================================================
-- Tunnel stats aggregated per minute (continuous aggregate)
-- ============================================================================
CREATE MATERIALIZED VIEW tunnel_stats_1m
WITH (tsdb.continuous) AS
SELECT
    time_bucket('1 minute', timestamp) AS minute,
    tunnel_id,
    COUNT(*) AS requests,
    COUNT(*) FILTER (WHERE status_code >= 400) AS errors,
    AVG(request_duration_ms)::REAL AS avg_latency_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY request_duration_ms)::INTEGER AS p95_latency_ms,
    SUM(bytes_in)::BIGINT AS bytes_in,
    SUM(bytes_out)::BIGINT AS bytes_out
FROM tunnel_events
GROUP BY minute, tunnel_id
WITH NO DATA;

-- Refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('tunnel_stats_1m',
    start_offset => INTERVAL '10 minutes',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

-- ============================================================================
-- Protocol events for TCP/UDP tunnels
-- ============================================================================
CREATE TABLE protocol_events (
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tunnel_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    retention_days SMALLINT DEFAULT 3,
    protocol TEXT NOT NULL,  -- 'tcp' or 'udp'
    event_type TEXT NOT NULL, -- 'connection', 'data', 'close' for TCP; 'packet' for UDP
    connection_id TEXT NOT NULL DEFAULT '',
    client_ip TEXT NOT NULL,
    client_port INTEGER NOT NULL,
    bytes_in INTEGER NOT NULL,
    bytes_out INTEGER NOT NULL,
    duration_ms INTEGER DEFAULT 0
)
WITH (
    tsdb.hypertable,
    tsdb.chunk_interval = '1 day'
);

-- Create indexes for common queries
CREATE INDEX idx_protocol_events_tunnel_id ON protocol_events (tunnel_id, timestamp DESC);
CREATE INDEX idx_protocol_events_organization_id ON protocol_events (organization_id, timestamp DESC);

-- ============================================================================
-- Protocol stats aggregated per minute (continuous aggregate)
-- ============================================================================
CREATE MATERIALIZED VIEW protocol_stats_1m
WITH (tsdb.continuous) AS
SELECT
    time_bucket('1 minute', timestamp) AS minute,
    tunnel_id,
    protocol,
    COUNT(*) FILTER (WHERE event_type = 'connection') AS connections,
    COUNT(DISTINCT connection_id) FILTER (WHERE event_type = 'data' AND protocol = 'tcp') AS active_connections,
    COUNT(*) FILTER (WHERE event_type IN ('data', 'packet')) AS packets,
    SUM(bytes_in)::BIGINT AS bytes_in,
    SUM(bytes_out)::BIGINT AS bytes_out
FROM protocol_events
GROUP BY minute, tunnel_id, protocol
WITH NO DATA;

-- Refresh policy for protocol stats continuous aggregate
SELECT add_continuous_aggregate_policy('protocol_stats_1m',
    start_offset => INTERVAL '10 minutes',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

-- ============================================================================
-- Retention policies (90 days max - for Pulse plan)
-- ============================================================================
SELECT add_retention_policy('active_tunnel_snapshots', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('tunnel_events', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('protocol_events', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('tunnel_stats_1m', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('protocol_stats_1m', INTERVAL '90 days', if_not_exists => TRUE);

-- ============================================================================
-- Per-Organization Retention Cleanup
-- ============================================================================
-- Since TimescaleDB doesn't support per-row TTL, we use a scheduled job to
-- delete expired rows based on each row's retention_days value.
-- 
-- Retention tiers (based on subscription plans):
--   Free: 3 days | Ray: 14 days | Beam: 30 days | Pulse: 90 days
-- ============================================================================

-- Function to clean up expired tunnel events
CREATE OR REPLACE FUNCTION cleanup_expired_tunnel_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM tunnel_events
    WHERE timestamp < NOW() - (retention_days * INTERVAL '1 day');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % expired rows from tunnel_events', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired protocol events
CREATE OR REPLACE FUNCTION cleanup_expired_protocol_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM protocol_events
    WHERE timestamp < NOW() - (retention_days * INTERVAL '1 day');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % expired rows from protocol_events', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Combined cleanup function for the scheduled job (must return void for add_job)
CREATE OR REPLACE FUNCTION cleanup_expired_events(job_id INTEGER, config JSONB)
RETURNS VOID AS $$
BEGIN
    PERFORM cleanup_expired_tunnel_events();
    PERFORM cleanup_expired_protocol_events();
    
END;
$$ LANGUAGE plpgsql;

-- Schedule the cleanup job to run every hour using TimescaleDB job scheduler
SELECT add_job('cleanup_expired_events', '1 hour');
