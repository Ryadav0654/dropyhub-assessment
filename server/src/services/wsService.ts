import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import type {
  Ticket,
  TicketHeartbeatPayload,
  TicketReleasedPayload,
  SlaBreachedPayload,
  AgentsOnlinePayload,
} from "../types";

let io: SocketIOServer | null = null;
const connectedAgents = new Map<string, string>(); // socketId -> agentName

export function initWebSocket(server: HttpServer, allowedOrigin: string) {
  io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigin || "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    // When an agent registers their identity
    socket.on("agent:identify", (agentName: string) => {
      connectedAgents.set(socket.id, agentName);
      broadcastConnectedAgents();
    });

    socket.on("disconnect", () => {
      connectedAgents.delete(socket.id);
      broadcastConnectedAgents();
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
}

function broadcastConnectedAgents() {
  if (!io) return;
  const agents = Array.from(connectedAgents.values());
  const payload: AgentsOnlinePayload = { count: agents.length, agents };
  io.emit("system:agents_online", payload);
}

export const wsBroadcast = {
  ticketCreated: (ticket: Ticket) => {
    io?.emit("ticket:created", ticket);
  },
  ticketClaimed: (ticket: Ticket) => {
    io?.emit("ticket:claimed", ticket);
  },
  ticketHeartbeat: (payload: TicketHeartbeatPayload) => {
    io?.emit("ticket:heartbeat", payload);
  },
  ticketReleased: (payload: TicketReleasedPayload) => {
    io?.emit("ticket:released", payload);
  },
  ticketResolved: (ticket: Ticket) => {
    io?.emit("ticket:resolved", ticket);
  },
  slaBreached: (payload: SlaBreachedPayload) => {
    io?.emit("ticket:sla_breached", payload);
  },
};
