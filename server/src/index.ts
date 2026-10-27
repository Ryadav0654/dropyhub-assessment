import app from "./app";
import http from "http";
import { initWebSocket } from "./services/wsService";
import { initDB } from "./database/db";
import { startSweeper, stopSweeper } from "./services/sweeperService";

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const server = http.createServer(app);
initWebSocket(server, CORS_ORIGIN);

server.listen(PORT, async () => {
  try {
    await initDB();
    startSweeper(5000);
    console.log(`Server is running at http://localhost:${PORT}`);
  } catch (err: any) {
    console.error("Startup failed:", err.message);
    process.exit(1);
  }
});

const gracefulShutdown = () => {
  console.log("Shutting down gracefully...");
  stopSweeper();
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
