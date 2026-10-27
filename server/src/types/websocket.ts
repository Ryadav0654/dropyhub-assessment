import type { Ticket } from "./ticket";

export interface TicketHeartbeatPayload {
  ticketId: string;
  lockExpiresAt: string;
  agentId: string;
}

export interface TicketReleasedPayload {
  ticketId: string;
  reason: "manual" | "ghost_timeout";
  ticket: Ticket;
}

export interface SlaBreachedPayload {
  ticketId: string;
  ticket: Ticket;
}

export interface AgentsOnlinePayload {
  count: number;
  agents: string[];
}
