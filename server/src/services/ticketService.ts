import { client } from "../database/db";
import { wsBroadcast } from "./wsService";
import { NotFoundError, ConflictError, BadRequestError } from "../utils/errors";
import type {
  Ticket,
  TicketActivity,
  CreateTicketDTO,
  TicketFilters,
} from "../types";


export function formatActivity(row: any): TicketActivity {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    actor: row.actor,
    action: row.action,
    message: row.message,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function formatTicket(row: any, activities?: TicketActivity[]): Ticket {
  const now = Date.now();
  const slaDueMs = row.sla_due_at ? new Date(row.sla_due_at).getTime() : 0;
  const isResolved = row.status === "Resolved" || row.status === "Closed";
  const slaTimeRemainingSeconds = isResolved
    ? 0
    : Math.max(0, Math.floor((slaDueMs - now) / 1000));

  let lockTimeRemainingSeconds: number | null = null;
  if (row.lock_expires_at && row.status === "In Progress") {
    const lockExpiresMs = new Date(row.lock_expires_at).getTime();
    lockTimeRemainingSeconds = Math.max(0, Math.floor((lockExpiresMs - now) / 1000));
  }

  return {
    id: row.ticket_id,
    ticketId: row.ticket_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    subject: row.subject,
    description: row.description,
    urgency: row.urgency,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lockedBy: row.locked_by ?? null,
    lockedAt: row.locked_at ? new Date(row.locked_at).toISOString() : null,
    lockExpiresAt: row.lock_expires_at ? new Date(row.lock_expires_at).toISOString() : null,
    slaDueAt: row.sla_due_at ? new Date(row.sla_due_at).toISOString() : null,
    isOverdue: Boolean(row.is_overdue),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    resolutionNote: row.resolution_note ?? null,
    slaTimeRemainingSeconds,
    lockTimeRemainingSeconds,
    activities,
  };
}

export async function addActivity(
  ticketId: string,
  actor: string,
  action: string,
  message: string,
): Promise<TicketActivity> {
  const result = await client.query(
    `INSERT INTO ticket_activities (ticket_id, actor, action, message, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [ticketId, actor, action, message],
  );
  return formatActivity(result.rows[0]);
}

/**
 * List tickets with optional status, search, and urgency filters.
 * Runs lazy lease sweep and overdue check prior to query.
 */
export async function listTickets(filters?: TicketFilters): Promise<Ticket[]> {
  // Proactive lazy check for expired ghost leases
  await sweepGhostTickets();
  // Proactive lazy check for overdue SLA
  await sweepOverdueTickets();

  const conditions: string[] = [];
  const params: any[] = [];

  if (filters?.status && filters.status !== "All") {
    const rawStatus = filters.status.trim();
    const lower = rawStatus.toLowerCase();

    if (lower === "overdue") {
      conditions.push(
        `((is_overdue = TRUE OR (sla_due_at IS NOT NULL AND sla_due_at < NOW())) AND status NOT IN ('Resolved', 'Closed'))`,
      );
    } else if (lower === "open") {
      conditions.push(`status = 'Open'`);
    } else if (lower === "in progress" || lower === "in_progress" || lower === "in-progress") {
      conditions.push(`status = 'In Progress'`);
    } else if (lower === "resolved") {
      conditions.push(`status = 'Resolved'`);
    } else if (lower === "closed") {
      conditions.push(`status = 'Closed'`);
    } else {
      params.push(rawStatus);
      conditions.push(`status = $${params.length}`);
    }
  }

  if (filters?.urgency && filters.urgency !== "All") {
    const rawUrgency = filters.urgency.trim();
    const lowerUrgency = rawUrgency.toLowerCase();
    if (lowerUrgency === "critical") {
      conditions.push(`urgency = 'Critical'`);
    } else if (lowerUrgency === "high") {
      conditions.push(`urgency = 'High'`);
    } else if (lowerUrgency === "medium") {
      conditions.push(`urgency = 'Medium'`);
    } else if (lowerUrgency === "low") {
      conditions.push(`urgency = 'Low'`);
    } else {
      params.push(rawUrgency);
      conditions.push(`urgency = $${params.length}`);
    }
  }

  if (filters?.search && filters.search.trim() !== "") {
    params.push(`%${filters.search.trim()}%`);
    const pIdx = params.length;
    conditions.push(
      `(ticket_id ILIKE $${pIdx} OR subject ILIKE $${pIdx} OR customer_name ILIKE $${pIdx} OR customer_email ILIKE $${pIdx} OR description ILIKE $${pIdx})`,
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT * FROM tickets
    ${whereClause}
    ORDER BY
      is_overdue DESC,
      CASE urgency
        WHEN 'Critical' THEN 4
        WHEN 'High' THEN 3
        WHEN 'Medium' THEN 2
        WHEN 'Low' THEN 1
        ELSE 0
      END DESC,
      created_at DESC;
  `;

  const ticketRows = (await client.query(query, params)).rows;
  if (ticketRows.length === 0) {
    return [];
  }

  // Fetch recent activities for these tickets
  const ticketIds = ticketRows.map((r) => r.ticket_id);
  const activitiesResult = await client.query(
    `SELECT * FROM ticket_activities 
     WHERE ticket_id = ANY($1) 
     ORDER BY created_at DESC`,
    [ticketIds],
  );

  const activitiesByTicket = new Map<string, TicketActivity[]>();
  for (const actRow of activitiesResult.rows) {
    const act = formatActivity(actRow);
    const existing = activitiesByTicket.get(act.ticketId) ?? [];
    if (existing.length < 5) {
      existing.push(act);
      activitiesByTicket.set(act.ticketId, existing);
    }
  }

  return ticketRows.map((row) =>
    formatTicket(row, activitiesByTicket.get(row.ticket_id) ?? []),
  );
}

/**
 * Get ticket details and full activity history by ID.
 */
export async function getTicketById(id: string): Promise<Ticket> {
  // Proactive lazy check for this ticket if lease expired
  await sweepGhostTickets(id);

  const ticketResult = await client.query(
    `SELECT * FROM tickets WHERE ticket_id = $1`,
    [id],
  );

  if (ticketResult.rows.length === 0) {
    throw new NotFoundError(`Ticket with ID ${id} not found`);
  }

  const activitiesResult = await client.query(
    `SELECT * FROM ticket_activities WHERE ticket_id = $1 ORDER BY created_at DESC`,
    [id],
  );

  const activities = activitiesResult.rows.map(formatActivity);
  return formatTicket(ticketResult.rows[0], activities);
}

/**
 * Customer submits new ticket.
 */
export async function createTicket(data: CreateTicketDTO): Promise<Ticket> {
  // Generate next sequential ID e.g. TKT-9004
  const maxResult = await client.query(
    `SELECT MAX(SUBSTRING(ticket_id FROM 5)::INT) AS max_num 
     FROM tickets 
     WHERE ticket_id ~ '^TKT-[0-9]+$'`,
  );
  const currentMax = maxResult.rows[0]?.max_num;
  const nextNum = currentMax ? currentMax + 1 : 9001;
  const ticketId = `TKT-${nextNum}`;

  const urgency = data.urgency || "Medium";

  const insertResult = await client.query(
    `INSERT INTO tickets (
       ticket_id,
       customer_name,
       customer_email,
       subject,
       description,
       urgency,
       status,
       created_at,
       updated_at,
       sla_due_at,
       is_overdue
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'Open', NOW(), NOW(), NOW() + INTERVAL '24 hours', FALSE)
     RETURNING *`,
    [ticketId, data.customerName, data.customerEmail, data.subject, data.description, urgency],
  );

  const initialActivity = await addActivity(
    ticketId,
    data.customerName,
    "CREATED",
    "Ticket created by customer via support portal",
  );

  const ticket = formatTicket(insertResult.rows[0], [initialActivity]);
  wsBroadcast.ticketCreated(ticket);
  return ticket;
}

// Claim ticket with a 3-minute lock lease
export async function claimTicket(ticketId: string, agentId: string): Promise<Ticket> {
  if (!agentId || agentId.trim() === "") {
    throw new BadRequestError("Agent ID is required to claim a ticket");
  }

  const cleanAgentId = agentId.trim();

  // Atomic conditional update in PostgreSQL:
  // Can claim if ticket is 'Open', or already locked by this agent,
  // or 'In Progress' but lease has expired (lock_expires_at < NOW()).
  const updateResult = await client.query(
    `UPDATE tickets
     SET
       status = 'In Progress',
       locked_by = $2,
       locked_at = NOW(),
       lock_expires_at = NOW() + INTERVAL '3 minutes',
       updated_at = NOW()
     WHERE ticket_id = $1
       AND (
         status = 'Open'
         OR locked_by = $2
         OR (status = 'In Progress' AND (lock_expires_at IS NULL OR lock_expires_at < NOW()))
       )
     RETURNING *`,
    [ticketId, cleanAgentId],
  );

  if (updateResult.rows.length === 0) {
    // Determine why lock failed
    const checkResult = await client.query(
      `SELECT * FROM tickets WHERE ticket_id = $1`,
      [ticketId],
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError(`Ticket ${ticketId} not found`);
    }

    const existing = checkResult.rows[0];
    if (existing.status === "Resolved" || existing.status === "Closed") {
      throw new ConflictError("This ticket is already resolved", "System");
    }

    const lockedBy = existing.locked_by || "Another Agent";
    const expiresAt = existing.lock_expires_at ? new Date(existing.lock_expires_at) : undefined;

    throw new ConflictError(
      `Collision prevented! Ticket is currently locked by ${lockedBy}`,
      lockedBy,
      expiresAt,
    );
  }

  const updatedRow = updateResult.rows[0];

  const activity = await addActivity(
    ticketId,
    cleanAgentId,
    "CLAIMED",
    `Ticket claimed by ${cleanAgentId}. 3-minute lease lock acquired.`,
  );

  const activitiesResult = await client.query(
    `SELECT * FROM ticket_activities WHERE ticket_id = $1 ORDER BY created_at DESC`,
    [ticketId],
  );
  const activities = activitiesResult.rows.map(formatActivity);

  const ticket = formatTicket(updatedRow, activities);
  wsBroadcast.ticketClaimed(ticket);
  return ticket;
}

// Extend ticket lock while agent is working
export async function heartbeatTicket(
  ticketId: string,
  agentId: string,
): Promise<{ success: boolean; lockExpiresAt: string }> {
  if (!agentId || agentId.trim() === "") {
    throw new BadRequestError("Agent ID is required in request body");
  }

  const cleanAgentId = agentId.trim();

  const updateResult = await client.query(
    `UPDATE tickets
     SET
       lock_expires_at = NOW() + INTERVAL '3 minutes',
       updated_at = NOW()
     WHERE ticket_id = $1
       AND locked_by = $2
       AND status = 'In Progress'
       AND lock_expires_at >= NOW()
     RETURNING lock_expires_at`,
    [ticketId, cleanAgentId],
  );

  if (updateResult.rows.length === 0) {
    const checkResult = await client.query(
      `SELECT * FROM tickets WHERE ticket_id = $1`,
      [ticketId],
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError(`Ticket ${ticketId} not found`);
    }

    const existing = checkResult.rows[0];
    if (existing.locked_by !== cleanAgentId) {
      throw new ConflictError(
        `Heartbeat rejected: Ticket is locked by ${existing.locked_by || "another agent"}`,
        existing.locked_by || "Unknown",
      );
    }

    throw new ConflictError(
      "Heartbeat rejected: Lease has already expired and ticket was returned to queue",
      cleanAgentId,
    );
  }

  const newLockExpiresAt = new Date(updateResult.rows[0].lock_expires_at).toISOString();

  wsBroadcast.ticketHeartbeat({
    ticketId,
    lockExpiresAt: newLockExpiresAt,
    agentId: cleanAgentId,
  });

  return { success: true, lockExpiresAt: newLockExpiresAt };
}

// Voluntary release (agent unclaims ticket)
export async function releaseTicket(ticketId: string, agentId: string): Promise<Ticket> {
  if (!agentId || agentId.trim() === "") {
    throw new BadRequestError("agentId is required");
  }

  const cleanAgentId = agentId.trim();

  const checkResult = await client.query(
    `SELECT * FROM tickets WHERE ticket_id = $1`,
    [ticketId],
  );

  if (checkResult.rows.length === 0) {
    throw new NotFoundError(`Ticket ${ticketId} not found`);
  }

  const existing = checkResult.rows[0];
  if (existing.locked_by && existing.locked_by !== cleanAgentId) {
    throw new ConflictError(
      `Cannot release: Ticket is locked by ${existing.locked_by}`,
      existing.locked_by,
      existing.lock_expires_at ? new Date(existing.lock_expires_at) : undefined,
    );
  }

  const updateResult = await client.query(
    `UPDATE tickets
     SET
       status = 'Open',
       locked_by = NULL,
       locked_at = NULL,
       lock_expires_at = NULL,
       updated_at = NOW()
     WHERE ticket_id = $1
     RETURNING *`,
    [ticketId],
  );

  const updatedRow = updateResult.rows[0];

  await addActivity(
    ticketId,
    cleanAgentId,
    "RELEASED",
    `Ticket voluntarily returned to queue by ${cleanAgentId}`,
  );

  const activitiesResult = await client.query(
    `SELECT * FROM ticket_activities WHERE ticket_id = $1 ORDER BY created_at DESC`,
    [ticketId],
  );
  const activities = activitiesResult.rows.map(formatActivity);

  const ticket = formatTicket(updatedRow, activities);
  wsBroadcast.ticketReleased({ ticketId, reason: "manual", ticket });
  return ticket;
}

// Resolve ticket
export async function resolveTicket(
  ticketId: string,
  agentId: string,
  note?: string,
): Promise<Ticket> {
  if (!agentId || agentId.trim() === "") {
    throw new BadRequestError("agentId is required");
  }

  const cleanAgentId = agentId.trim();

  const checkResult = await client.query(
    `SELECT * FROM tickets WHERE ticket_id = $1`,
    [ticketId],
  );

  if (checkResult.rows.length === 0) {
    throw new NotFoundError(`Ticket ${ticketId} not found`);
  }

  const existing = checkResult.rows[0];
  if (existing.status === "Resolved" || existing.status === "Closed") {
    throw new ConflictError("Ticket is already resolved", "System");
  }

  // If another agent holds an unexpired lock, reject
  if (
    existing.locked_by &&
    existing.locked_by !== cleanAgentId &&
    existing.lock_expires_at &&
    new Date(existing.lock_expires_at).getTime() > Date.now()
  ) {
    throw new ConflictError(
      `Cannot resolve: Ticket is currently claimed by ${existing.locked_by}`,
      existing.locked_by,
      new Date(existing.lock_expires_at),
    );
  }

  const resolutionNote = note?.trim() || "Resolved by agent";

  const updateResult = await client.query(
    `UPDATE tickets
     SET
       status = 'Resolved',
       locked_by = NULL,
       locked_at = NULL,
       lock_expires_at = NULL,
       resolved_at = NOW(),
       resolution_note = $2,
       updated_at = NOW()
     WHERE ticket_id = $1
     RETURNING *`,
    [ticketId, resolutionNote],
  );

  const updatedRow = updateResult.rows[0];

  await addActivity(
    ticketId,
    cleanAgentId,
    "RESOLVED",
    `Ticket resolved by ${cleanAgentId}. Note: "${resolutionNote}"`,
  );

  const activitiesResult = await client.query(
    `SELECT * FROM ticket_activities WHERE ticket_id = $1 ORDER BY created_at DESC`,
    [ticketId],
  );
  const activities = activitiesResult.rows.map(formatActivity);

  const ticket = formatTicket(updatedRow, activities);
  wsBroadcast.ticketResolved(ticket);
  return ticket;
}

// Release tickets whose lock lease expired
export async function sweepGhostTickets(specificTicketId?: string): Promise<number> {
  let query = `
    UPDATE tickets
     SET
       status = 'Open',
       locked_by = NULL,
       locked_at = NULL,
       lock_expires_at = NULL,
       updated_at = NOW()
     WHERE status = 'In Progress'
       AND lock_expires_at IS NOT NULL
       AND lock_expires_at < NOW()
  `;
  const params: any[] = [];

  if (specificTicketId) {
    params.push(specificTicketId);
    query += ` AND ticket_id = $1`;
  }

  query += ` RETURNING *`;

  const result = await client.query(query, params);

  for (const row of result.rows) {
    await addActivity(
      row.ticket_id,
      "System",
      "GHOST_TIMEOUT",
      "Ticket automatically returned to queue due to agent inactivity (3-minute lease expired)",
    );

    const ticket = formatTicket(row);
    wsBroadcast.ticketReleased({
      ticketId: row.ticket_id,
      reason: "ghost_timeout",
      ticket,
    });
  }

  return result.rows.length;
}

// Flag tickets that passed 24h SLA
export async function sweepOverdueTickets(): Promise<number> {
  const result = await client.query(
    `UPDATE tickets
     SET
       is_overdue = TRUE,
       updated_at = NOW()
     WHERE status NOT IN ('Resolved', 'Closed')
       AND is_overdue = FALSE
       AND sla_due_at IS NOT NULL
       AND sla_due_at < NOW()
     RETURNING *`,
  );

  for (const row of result.rows) {
    await addActivity(
      row.ticket_id,
      "System",
      "SLA_BREACHED",
      "Ticket breached 24-hour SLA. Flagged as Overdue across system.",
    );

    const ticket = formatTicket(row);
    wsBroadcast.slaBreached({
      ticketId: row.ticket_id,
      ticket,
    });
  }

  return result.rows.length;
}
