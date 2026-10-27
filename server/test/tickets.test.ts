import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import http from "http";
import app from "../src/app";
import { client, initDB } from "../src/database/db";
import { initWebSocket } from "../src/services/wsService";
import { runSweepNow } from "../src/services/sweeperService";

let server: http.Server;
let baseUrl: string;

const parseJson = async (res: Response): Promise<any> => res.json();

beforeAll(async () => {
  await initDB();
  server = http.createServer(app);
  initWebSocket(server, "*");

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address() as any;
      baseUrl = `http://localhost:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await client.end();
});

describe("Multi-Agent Helpdesk Ticketing System Tests", () => {
  describe("Health & System Status", () => {
    it("should return 200 OK from /health", async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const data = await parseJson(res);
      expect(data.status).toBe("ok");
      expect(data.service).toBe("Multi-Agent Helpdesk Ticketing Engine");
    });
  });

  describe("Ticket Creation & Validation", () => {
    it("should create a valid ticket and initialize 24-hour SLA", async () => {
      const payload = {
        customerName: "Rahul Sharma",
        customerEmail: "rahul@example.com",
        subject: "Cannot access billing portal",
        description: "Whenever I click on billing, the page shows a blank screen.",
        urgency: "High",
      };

      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(201);
      const body = await parseJson(res);
      expect(body.success).toBe(true);
      expect(body.data.ticketId).toMatch(/^TKT-\d+$/);
      expect(body.data.status).toBe("Open");
      expect(body.data.urgency).toBe("High");
      expect(body.data.isOverdue).toBe(false);
      expect(body.data.slaDueAt).not.toBeNull();
      expect(body.data.slaTimeRemainingSeconds).toBeGreaterThan(80000); // ~24h
      expect(body.data.activities?.length).toBeGreaterThan(0);
      expect(body.data.activities[0].action).toBe("CREATED");
    });

    it("should reject malicious/invalid input with 400 Bad Request", async () => {
      const invalidPayload = {
        customerName: "R", // too short
        customerEmail: "not-an-email", // invalid email
        subject: "Hi", // too short
        description: "Short", // too short
        urgency: "SuperUrgent", // invalid enum
      };

      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidPayload),
      });

      expect(res.status).toBe(400);
      const body = await parseJson(res);
      expect(body.success).toBe(false);
      expect(Array.isArray(body.errors)).toBe(true);
      expect(body.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Ticket Claims & Lock Concurrency", () => {
    it("should allow an agent to claim an open ticket", async () => {
      // Create ticket
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Priya Patel",
          customerEmail: "priya@example.com",
          subject: "Webhook failing on payments",
          description: "Our payment webhooks are failing with a 500 error code.",
          urgency: "Critical",
        }),
      });
      const { data: createdTicket } = await parseJson(createRes);

      // Agent A claims ticket
      const claimRes = await fetch(`${baseUrl}/api/tickets/${createdTicket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_alpha" }),
      });

      expect(claimRes.status).toBe(200);
      const claimBody = await parseJson(claimRes);
      expect(claimBody.success).toBe(true);
      expect(claimBody.data.status).toBe("In Progress");
      expect(claimBody.data.lockedBy).toBe("agent_alpha");
      expect(claimBody.data.lockExpiresAt).not.toBeNull();
    });

    it("should prevent Agent B from claiming a ticket currently claimed by Agent A (409 Conflict)", async () => {
      // Create ticket
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Amitabh Roy",
          customerEmail: "amitabh@example.com",
          subject: "Slow database response times",
          description: "Database queries are taking over 10 seconds on peak hours.",
          urgency: "High",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // Agent A claims ticket
      const claimA = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_alpha" }),
      });
      expect(claimA.status).toBe(200);

      // Agent B attempts to claim the same ticket
      const claimB = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_beta" }),
      });

      expect(claimB.status).toBe(409);
      const conflictBody = await parseJson(claimB);
      expect(conflictBody.success).toBe(false);
      expect(conflictBody.error).toContain("Collision prevented");
      expect(conflictBody.lockedBy).toBe("agent_alpha");
    });

    it("should handle 20 concurrent agents racing for the same ticket: exactly 1 wins, 19 receive 409", async () => {
      // Create a fresh open ticket
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Concurrent Race Test",
          customerEmail: "race@example.com",
          subject: "Hot ticket claim collision test",
          description: "Testing concurrent race condition with 20 simultaneous agents.",
          urgency: "Critical",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // 20 agents all try to claim at the exact same moment
      const agentIds = Array.from({ length: 20 }, (_, i) => `agent_race_${i + 1}`);

      const results = await Promise.all(
        agentIds.map((agentId) =>
          fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId }),
          }),
        ),
      );

      const statusCodes = results.map((r) => r.status);
      const successes = statusCodes.filter((s) => s === 200);
      const conflicts = statusCodes.filter((s) => s === 409);

      // Exactly ONE agent must acquire the lock
      expect(successes.length).toBe(1);
      // All other 19 agents must be rejected with 409 Conflict
      expect(conflicts.length).toBe(19);
    });
  });

  describe("Lease Expiration & Heartbeat", () => {
    it("should allow the lock owner to send heartbeat and extend lease", async () => {
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Heartbeat Test",
          customerEmail: "heartbeat@example.com",
          subject: "Heartbeat lease renewal test",
          description: "Ensuring heartbeat pings keep 3-minute lease fresh.",
          urgency: "Medium",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // Claim as agent_1
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_1" }),
      });

      // Send heartbeat as agent_1
      const hbRes = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_1" }),
      });

      expect(hbRes.status).toBe(200);
      const hbBody = await parseJson(hbRes);
      expect(hbBody.success).toBe(true);
      expect(hbBody.data.lockExpiresAt).toBeDefined();
    });

    it("should reject heartbeat from an agent that does not own the lock", async () => {
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Imposter Heartbeat",
          customerEmail: "imposter@example.com",
          subject: "Unauthorized heartbeat test",
          description: "Agent B trying to heartbeat Agent A's ticket.",
          urgency: "Medium",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // Claim as agent_owner
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_owner" }),
      });

      // Try heartbeat as agent_imposter
      const hbRes = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_imposter" }),
      });

      expect(hbRes.status).toBe(409);
    });

    it("should allow lock owner to voluntarily release ticket back to Open queue", async () => {
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Voluntary Release",
          customerEmail: "release@example.com",
          subject: "Release ticket voluntarily",
          description: "Agent finishes early or cancels modal.",
          urgency: "Low",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // Claim
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_worker" }),
      });

      // Voluntary release
      const releaseRes = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_worker" }),
      });

      expect(releaseRes.status).toBe(200);
      const releaseBody = await parseJson(releaseRes);
      expect(releaseBody.data.status).toBe("Open");
      expect(releaseBody.data.lockedBy).toBeNull();

      // Another agent can now immediately claim it
      const claimAgain = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_new" }),
      });
      expect(claimAgain.status).toBe(200);
    });

    it("returns abandoned ticket back to open queue when lease expires", async () => {
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Ghost Test",
          customerEmail: "ghost@example.com",
          subject: "Agent laptop died unexpectedly",
          description: "Abandoned ticket must be recovered after 3 minutes.",
          urgency: "High",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // Claim
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_ghost" }),
      });

      // Simulate lease expiration (e.g. 3 minutes passed without heartbeat)
      await client.query(
        `UPDATE tickets SET lock_expires_at = NOW() - INTERVAL '5 seconds' WHERE ticket_id = $1`,
        [ticket.ticketId],
      );

      // Trigger autonomous sweeper
      const sweepRes = await fetch(`${baseUrl}/api/tickets/sweep`, {
        method: "POST",
      });
      expect(sweepRes.status).toBe(200);

      // Check ticket status: should be returned to 'Open'
      const checkRes = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}`);
      const checkBody = await parseJson(checkRes);
      expect(checkBody.data.status).toBe("Open");
      expect(checkBody.data.lockedBy).toBeNull();

      // Check activity log includes GHOST_TIMEOUT
      const ghostActivity = checkBody.data.activities.find(
        (a: any) => a.action === "GHOST_TIMEOUT",
      );
      expect(ghostActivity).toBeDefined();
    });
  });

  describe("SLA Tracking & Expiration", () => {
    it("flags ticket as overdue when 24 hours have passed", async () => {
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "SLA Test",
          customerEmail: "sla@example.com",
          subject: "Critical SLA violation test",
          description: "Ticket that exceeded 24 hours without resolution.",
          urgency: "Critical",
        }),
      });
      const { data: ticket } = await parseJson(createRes);
      expect(ticket.isOverdue).toBe(false);

      // Simulate 24-hour SLA expiry (sla_due_at in the past)
      await client.query(
        `UPDATE tickets SET sla_due_at = NOW() - INTERVAL '1 hour' WHERE ticket_id = $1`,
        [ticket.ticketId],
      );

      // Run background sweeper
      await runSweepNow();

      // Fetch ticket: must now be flagged isOverdue: true
      const getRes = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}`);
      const getBody = await parseJson(getRes);
      expect(getBody.data.isOverdue).toBe(true);

      // Check activity log includes SLA_BREACHED
      const slaActivity = getBody.data.activities.find(
        (a: any) => a.action === "SLA_BREACHED",
      );
      expect(slaActivity).toBeDefined();
    });

    it("should NOT mark Resolved tickets as overdue even if SLA expired", async () => {
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Resolved SLA Test",
          customerEmail: "resolved@example.com",
          subject: "Already resolved ticket",
          description: "Resolved before SLA, time goes on.",
          urgency: "Medium",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // Claim and resolve
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_closer" }),
      });
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_closer", note: "Issue solved" }),
      });

      // Simulate SLA expiry in past
      await client.query(
        `UPDATE tickets SET sla_due_at = NOW() - INTERVAL '1 hour' WHERE ticket_id = $1`,
        [ticket.ticketId],
      );

      await runSweepNow();

      const getRes = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}`);
      const getBody = await parseJson(getRes);
      expect(getBody.data.status).toBe("Resolved");
      expect(getBody.data.isOverdue).toBe(false);
    });
  });

  describe("Ticket Resolution & Edge Cases", () => {
    it("should allow agent to resolve ticket with note", async () => {
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Anil Kapoor",
          customerEmail: "anil@example.com",
          subject: "Refund request for duplicate charge",
          description: "Charged twice for single transaction #5541.",
          urgency: "High",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // Claim
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_finance" }),
      });

      // Resolve
      const resolveRes = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent_finance",
          note: "Refund processed successfully via Stripe gateway.",
        }),
      });

      expect(resolveRes.status).toBe(200);
      const resolveBody = await parseJson(resolveRes);
      expect(resolveBody.data.status).toBe("Resolved");
      expect(resolveBody.data.resolutionNote).toBe(
        "Refund processed successfully via Stripe gateway.",
      );
      expect(resolveBody.data.resolvedAt).not.toBeNull();
      expect(resolveBody.data.lockedBy).toBeNull();
    });

    it("should reject claiming an already resolved ticket with 409 Conflict", async () => {
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Closed Ticket Test",
          customerEmail: "closed@example.com",
          subject: "Test claiming resolved ticket",
          description: "Ticket is done and dusted.",
          urgency: "Low",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // Claim and resolve
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_1" }),
      });
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_1" }),
      });

      // Try to claim
      const claimRes = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_2" }),
      });

      expect(claimRes.status).toBe(409);
      const body = await parseJson(claimRes);
      expect(body.error).toContain("already resolved");
    });

    it("should return 404 for non-existent ticket ID", async () => {
      const res = await fetch(`${baseUrl}/api/tickets/TKT-999999`);
      expect(res.status).toBe(404);
    });

    it("should filter tickets by status and search keyword", async () => {
      const res = await fetch(`${baseUrl}/api/tickets?status=Open&search=Payment`);
      expect(res.status).toBe(200);
      const body = await parseJson(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      for (const t of body.data) {
        expect(t.status).toBe("Open");
      }
    });

    it("should filter tickets by status=Overdue without PostgreSQL enum error", async () => {
      const res = await fetch(`${baseUrl}/api/tickets?status=Overdue`);
      expect(res.status).toBe(200);
      const body = await parseJson(res);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      for (const t of body.data) {
        expect(t.isOverdue).toBe(true);
        expect(t.status).not.toBe("Resolved");
      }
    });
  });

  describe("Centralised Error Handling Middleware", () => {
    it("should format unknown routes as 404 via centralised error middleware", async () => {
      const res = await fetch(`${baseUrl}/api/non-existent-endpoint`);
      expect(res.status).toBe(404);
      const body = await parseJson(res);
      expect(body.success).toBe(false);
      expect(body.statusCode).toBe(404);
      expect(body.error).toContain("not found");
    });

    it("should format Zod schema errors as structured 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = await parseJson(res);
      expect(body.success).toBe(false);
      expect(body.statusCode).toBe(400);
      expect(Array.isArray(body.errors)).toBe(true);
      expect(body.errors.length).toBeGreaterThan(0);
    });

    it("should format ConflictError as 409 with lockedBy and lockExpiresAt", async () => {
      const createRes = await fetch(`${baseUrl}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Centralised Error Test",
          customerEmail: "error@example.com",
          subject: "Testing error formatter",
          description: "Testing conflict response formatting.",
          urgency: "Medium",
        }),
      });
      const { data: ticket } = await parseJson(createRes);

      // Claim as agent A
      await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_first" }),
      });

      // Claim as agent B -> triggers ConflictError
      const conflictRes = await fetch(`${baseUrl}/api/tickets/${ticket.ticketId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent_second" }),
      });

      expect(conflictRes.status).toBe(409);
      const body = await parseJson(conflictRes);
      expect(body.success).toBe(false);
      expect(body.statusCode).toBe(409);
      expect(body.lockedBy).toBe("agent_first");
      expect(body.lockExpiresAt).toBeDefined();
    });
  });
});
