import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachAforceHub } from "./lib/aforceHub";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Express + WS share one HTTP server so they share one port (the
// Replit artifact only exposes a single PORT per workflow).
const server = createServer(app);
attachAforceHub(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
