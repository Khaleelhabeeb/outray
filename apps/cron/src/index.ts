import { redis } from "./lib/redis";
import { clickhouse } from "./lib/clickhouse";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS active_tunnel_snapshots
(
    ts DateTime,
    active_tunnels UInt32
)
ENGINE = MergeTree
PARTITION BY toDate(ts)
ORDER BY ts
TTL ts + INTERVAL 90 DAY;
`;

async function connectRedis() {
  await redis.connect();
  console.log("Connected to Redis");
}

async function connectClickHouse() {
  try {
    await clickhouse.ping();
    console.log("Connected to ClickHouse");
    await clickhouse.command({
      query: CREATE_TABLE_SQL,
    });
    console.log("ClickHouse table ensured");
  } catch (error) {
    console.error("Failed to connect to ClickHouse", error);
    process.exit(1);
  }
}

let isSampling = false;

async function sampleActiveTunnels() {
  if (isSampling) {
    console.warn("Skipping sample: previous run still active");
    return;
  }
  isSampling = true;

  try {
    console.log("Sampling active tunnels...");
    const now = new Date();
    now.setSeconds(0, 0);
    const ts = now;

    let totalCount = 0;

    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        "tunnel:online:*",
        "COUNT",
        1000,
      );
      cursor = nextCursor;
      totalCount += keys.length;
    } while (cursor !== "0");

    console.log("Active tunnels:", totalCount);

    // Format timestamp in server local time to avoid timezone offsets in ClickHouse
    const year = ts.getFullYear();
    const month = String(ts.getMonth() + 1).padStart(2, "0");
    const day = String(ts.getDate()).padStart(2, "0");
    const hours = String(ts.getHours()).padStart(2, "0");
    const minutes = String(ts.getMinutes()).padStart(2, "0");
    const seconds = String(ts.getSeconds()).padStart(2, "0");
    const formattedTs = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    // Insert into ClickHouse
    try {
      await clickhouse.insert({
        table: "active_tunnel_snapshots",
        values: [
          {
            ts: formattedTs,
            active_tunnels: totalCount,
          },
        ],
        format: "JSONEachRow",
      });
      console.log(`Inserted snapshot into ClickHouse: ${totalCount} tunnels`);
    } catch (error) {
      console.error("Failed to insert into ClickHouse", error);
    }
  } finally {
    isSampling = false;
  }
}

async function start() {
  await connectRedis();
  await connectClickHouse();

  // Initial run
  await sampleActiveTunnels();

  setInterval(sampleActiveTunnels, 60_000);
}

start();
