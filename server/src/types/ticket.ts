export type UrgencyLevel = "Low" | "Medium" | "High" | "Critical";

export type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";

export type TicketActivityAction =
  | "CREATED"
  | "CLAIMED"
  | "HEARTBEAT"
  | "RELEASED"
  | "GHOST_TIMEOUT"
  | "RESOLVED"
  | "SLA_BREACHED";

export interface TicketActivity {
  id: number;
  ticketId: string;
  actor: string;
  action: TicketActivityAction | string;
  message: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  urgency: UrgencyLevel;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  lockedBy: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  slaDueAt: string | null;
  isOverdue: boolean;
  resolvedAt: string | null;
  resolutionNote: string | null;
  slaTimeRemainingSeconds: number;
  lockTimeRemainingSeconds: number | null;
  activities?: TicketActivity[];
}

export interface CreateTicketDTO {
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  urgency?: UrgencyLevel;
}

export interface TicketFilters {
  status?: string;
  search?: string;
  urgency?: string;
}

export interface MockTicket {
  ticket_id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  description: string;
  created_at: string;
  urgency: UrgencyLevel;
  status: TicketStatus;
}
