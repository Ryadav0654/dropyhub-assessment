# Helpdesk Ticketing System (Backend)

Backend API for the multi-agent customer support ticketing system. Built with Bun, Express, PostgreSQL, and Socket.IO.

## Tech Stack

- **Runtime:** Bun
- **Framework:** Express 5
- **Database:** PostgreSQL 18 (via `pg` Pool)
- **Real-Time:** Socket.IO
- **Validation:** Zod
- **Testing:** Bun Test

---

## Getting Started

### 1. Start Database
```bash
docker compose up -d
```

### 2. Seed Initial Tickets
```bash
bun run seed
```

### 3. Run Dev Server
```bash
bun run dev
```
The server will start on `http://localhost:8080`.

### 4. Run Tests & Typecheck
```bash
bun test
bun run typecheck
```

---

## Core Operational Logic

### 1. Collision Prevention (Preventing Duplicate Work)
When multiple agents try to work on the same open ticket, we use an atomic PostgreSQL conditional update in `claimTicket`:
```sql
UPDATE tickets
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
RETURNING *;
```
If another agent already holds an active lock, the query updates 0 rows and returns a `409 Conflict` with the current lock holder's info.

### 2. Abandoned Ticket Detection (Ghosting Recovery)
- Each claimed ticket holds a 3-minute lease (`lock_expires_at`).
- While an agent has the ticket open, the frontend sends periodic heartbeat pings (`POST /api/tickets/:id/heartbeat`) to renew the lease.
- If the agent closes the tab or loses connection, a background sweeper running every 5 seconds finds expired locks and resets the ticket status to `Open`.
- Active reads and claim attempts also perform a lazy check on expired locks so tickets can be picked up immediately.
- Agents can also voluntarily release a ticket back to the queue via `POST /api/tickets/:id/release`.

### 3. 24-Hour SLA Tracking
- When a ticket is created, `sla_due_at` is set to `NOW() + INTERVAL '24 hours'`.
- The background worker checks for un-resolved tickets where `sla_due_at < NOW()` and sets `is_overdue = true`.
- When an SLA is breached, a `ticket:sla_breached` event is emitted via Socket.IO so connected agent screens update immediately without needing a manual refresh.

---

## API Endpoints

### Tickets
- `GET /health` - Service health status
- `GET /api/tickets` - List all tickets (supports `status`, `search`, and `urgency` query params)
- `GET /api/tickets/:id` - Get ticket details along with full activity history
- `POST /api/tickets` - Submit a new ticket (`customerName`, `customerEmail`, `subject`, `description`, `urgency`)
- `POST /api/tickets/:id/claim` - Claim a ticket (`agentId`)
- `POST /api/tickets/:id/heartbeat` - Extend the 3-minute lease (`agentId`)
- `POST /api/tickets/:id/release` - Release ticket back to queue (`agentId`)
- `POST /api/tickets/:id/resolve` - Resolve ticket with a resolution note (`agentId`, `note`)
- `POST /api/tickets/sweep` - Trigger immediate background sweep (manual run)

### WebSocket Events (Socket.IO)
- `ticket:created` - New ticket created
- `ticket:claimed` - Ticket claimed by an agent
- `ticket:heartbeat` - Lease extended
- `ticket:released` - Ticket returned to queue (manual or timeout)
- `ticket:resolved` - Ticket resolved
- `ticket:sla_breached` - Ticket passed 24h SLA
- `system:agents_online` - Online agent presence count & list
