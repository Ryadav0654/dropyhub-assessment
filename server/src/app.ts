import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import ticketRoutes from "./routes/tickets";
import cors, { type CorsOptions } from "cors";
import { errorHandler } from "./middleware/errorHandler";
import { NotFoundError } from "./utils/errors";

const app: Express = express();

// Enable JSON body parsing and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const corsOptions: CorsOptions = {
  origin: CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
};

app.use(cors(corsOptions));

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "Multi-Agent Helpdesk Ticketing Engine",
  });
});

// Ticket routes
app.use("/api/tickets", ticketRoutes);

// Fallback 404 handler for unknown routes
app.use((req: Request, res: Response, next: NextFunction) => {
  next(
    new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} not found`),
  );
});

// Centralised error handling middleware
app.use(errorHandler);

export default app;
