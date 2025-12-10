import { CoreClient } from "./CoreClient";

const serverUrl = process.env.SERVER_URL || "ws://localhost:3547";
const localPort = parseInt(process.env.LOCAL_PORT || "8080", 10);

const client = new CoreClient(serverUrl, localPort);

client.connect().catch((error) => {
  console.error("Failed to connect:", error);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  client.disconnect();
  process.exit(0);
});
