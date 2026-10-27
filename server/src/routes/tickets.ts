import { Router, type Request, type Response, type NextFunction } from "express";
import z from "zod";
import * as ticketService from "../services/ticketService";
import { runSweepNow } from "../services/sweeperService";

const router = Router();

const createTicketSchema = z.object({
  customerName: z.string().trim().min(2, "Customer name must be at least 2 characters"),
  customerEmail: z.string().trim().email("Invalid email address"),
  subject: z.string().trim().min(5, "Subject must be at least 5 characters"),
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  urgency: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
});

const agentBodySchema = z.object({
  agentId: z.string().trim().min(1, "agentId is required in request body"),
});

const resolveBodySchema = z.object({
  agentId: z.string().trim().min(1, "agentId is required in request body"),
  note: z.string().optional(),
});

// List tickets with optional status, search, and urgency filters
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const urgency = req.query.urgency as string | undefined;

    const tickets = await ticketService.listTickets({ status, search, urgency });
    return res.status(200).json({ success: true, count: tickets.length, data: tickets });
  } catch (error) {
    next(error);
  }
});

// Manual trigger for background cleanup of inactive locks and SLA checks
router.post("/sweep", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runSweepNow();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Get ticket details and history
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const ticket = await ticketService.getTicketById(id);
    return res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
});

// Create new support ticket
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createTicketSchema.parse(req.body);
    const ticket = await ticketService.createTicket(parsed);
    return res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
});

// Claim ticket (locks ticket to an agent)
router.post("/:id/claim", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = agentBodySchema.parse(req.body);
    const ticket = await ticketService.claimTicket(req.params.id as string, agentId);
    return res.status(200).json({
      success: true,
      message: `Ticket claimed by ${agentId}`,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
});

// Heartbeat ping while modal is open to renew lease
router.post("/:id/heartbeat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = agentBodySchema.parse(req.body);
    const result = await ticketService.heartbeatTicket(req.params.id as string, agentId);
    return res.status(200).json({
      success: true,
      message: "Heartbeat accepted, lease extended 3 minutes",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Release ticket voluntarily back to queue
router.post("/:id/release", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = agentBodySchema.parse(req.body);
    const ticket = await ticketService.releaseTicket(req.params.id as string, agentId);
    return res.status(200).json({
      success: true,
      message: "Ticket released back to queue",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
});

// Mark ticket resolved with an optional resolution note
router.post("/:id/resolve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, note } = resolveBodySchema.parse(req.body);
    const ticket = await ticketService.resolveTicket(req.params.id as string, agentId, note);
    return res.status(200).json({
      success: true,
      message: "Ticket resolved successfully",
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
