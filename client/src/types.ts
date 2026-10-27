export type UrgencyLevel = "Low" | "Medium" | "High" | "Critical";
export type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";

export interface TicketActivity {
  id: number;
  ticketId: string;
  actor: string;
  action: string;
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

export interface CreateTicketPayload {
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  urgency: UrgencyLevel;
}

export interface ToastMessage {
  id: string;
  type: "success" | "warning" | "error" | "info";
  title: string;
  message?: string;
  duration?: number;
}
