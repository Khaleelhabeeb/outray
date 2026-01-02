import "dotenv/config";
import pg from "pg";

// PG Setup (Main database)
const pgClient = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

// TimescaleDB Setup (Analytics)
const tigerDataClient = new pg.Client({
  connectionString: process.env.TIGER_DATA_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  console.log("🗑️  Clearing databases...");

  // Clear Postgres (Main database)
  try {
    await pgClient.connect();
    console.log("Connected to Postgres");

    // Get all table names
    const res = await pgClient.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    const tables = res.rows.map((r) => r.tablename);
    if (tables.length > 0) {
      console.log(`Found PG tables: ${tables.join(", ")}`);
      // Truncate all tables
      await pgClient.query(
        `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`,
      );
      console.log("✅ Postgres tables truncated");
    } else {
      console.log("No PG tables found");
    }
  } catch (e) {
    console.error("Error clearing Postgres:", e);
  } finally {
    await pgClient.end();
  }

  // Clear TimescaleDB (Tiger Data)
  try {
    await tigerDataClient.connect();
    console.log("Connected to TimescaleDB (Tiger Data)");
    await tigerDataClient.query("TRUNCATE TABLE tunnel_events");
    await tigerDataClient.query("TRUNCATE TABLE protocol_events");
    await tigerDataClient.query("TRUNCATE TABLE active_tunnel_snapshots");
    console.log("✅ TimescaleDB tables truncated");
  } catch (e) {
    console.error("Error clearing TimescaleDB:", e);
  } finally {
    await tigerDataClient.end();
  }
}

main();
