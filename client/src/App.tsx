import React, { useState, useEffect, useCallback } from "react";
import type { Ticket } from "./types";
import { api, ApiError } from "./services/api";
import { SocketProvider, useSocket } from "./context/SocketContext";
import { Toaster, toast } from "sonner";
import { Navbar } from "./components/Navbar";
import { StatsCards } from "./components/StatsCards";
import { TicketCard } from "./components/TicketCard";
import { TicketDetailModal } from "./components/TicketDetailModal";
import { CollisionModal } from "./components/CollisionModal";
import { CustomerPortal } from "./components/CustomerPortal";
import { Search, RefreshCw, Inbox, SlidersHorizontal } from "lucide-react";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";

interface AppContentProps {
  currentAgent: string;
  onAgentChange: (agentId: string) => void;
}

export const AppContent: React.FC<AppContentProps> = ({ currentAgent, onAgentChange }) => {
  const { socket } = useSocket();

  const [activeRole, setActiveRole] = useState<"agent" | "customer">("agent");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [collisionData, setCollisionData] = useState<{
    ticketId: string;
    lockedBy: string;
    lockExpiresAt?: string;
  } | null>(null);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    try {
      const res = await api.getTickets({
        status: statusFilter,
        urgency: urgencyFilter,
        search: searchQuery,
      });
      setTickets(res.data);
    } catch (err) {
      console.error("Failed to load tickets:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, urgencyFilter, searchQuery]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // WebSocket Event Listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("ticket:created", (newTicket: Ticket) => {
      setTickets((prev) => [newTicket, ...prev.filter((t) => t.ticketId !== newTicket.ticketId)]);
      toast.info("New Ticket Received", {
        description: `${newTicket.ticketId}: ${newTicket.subject}`,
      });
    });

    socket.on("ticket:claimed", (claimedTicket: Ticket) => {
      setTickets((prev) =>
        prev.map((t) => (t.ticketId === claimedTicket.ticketId ? claimedTicket : t)),
      );
      if (claimedTicket.lockedBy !== currentAgent) {
        toast.warning("Ticket Assigned", {
          description: `${claimedTicket.ticketId} claimed by ${claimedTicket.lockedBy}`,
        });
      }
    });

    socket.on("ticket:heartbeat", (payload: { ticketId: string; lockExpiresAt: string; agentId: string }) => {
      setTickets((prev) =>
        prev.map((t) =>
          t.ticketId === payload.ticketId
            ? { ...t, lockExpiresAt: payload.lockExpiresAt }
            : t,
        ),
      );
    });

    socket.on("ticket:released", (payload: { ticketId: string; reason: string; ticket: Ticket }) => {
      setTickets((prev) =>
        prev.map((t) => (t.ticketId === payload.ticketId ? payload.ticket : t)),
      );
      if (payload.reason === "ghost_timeout") {
        toast.info("Ticket Available", {
          description: `${payload.ticketId} returned to queue due to agent inactivity.`,
        });
      }
    });

    socket.on("ticket:resolved", (resolvedTicket: Ticket) => {
      setTickets((prev) =>
        prev.map((t) => (t.ticketId === resolvedTicket.ticketId ? resolvedTicket : t)),
      );
      toast.success("Ticket Resolved", {
        description: `${resolvedTicket.ticketId} marked as Resolved.`,
      });
    });

    socket.on("ticket:sla_breached", (payload: { ticketId: string; ticket: Ticket }) => {
      setTickets((prev) =>
        prev.map((t) => (t.ticketId === payload.ticketId ? payload.ticket : t)),
      );
      toast.error("SLA Overdue Warning", {
        description: `Ticket ${payload.ticketId} has reached 24 hours without resolution.`,
      });
    });

    return () => {
      socket.off("ticket:created");
      socket.off("ticket:claimed");
      socket.off("ticket:heartbeat");
      socket.off("ticket:released");
      socket.off("ticket:resolved");
      socket.off("ticket:sla_breached");
    };
  }, [socket, currentAgent]);

  // Handle Claim directly from card
  const handleClaimTicket = async (ticket: Ticket) => {
    try {
      const res = await api.claimTicket(ticket.ticketId, currentAgent);
      setTickets((prev) =>
        prev.map((t) => (t.ticketId === res.data.ticketId ? res.data : t)),
      );
      setSelectedTicket(res.data);
      toast.success("Ticket Claimed", {
        description: `Session active on ${res.data.ticketId}.`,
      });
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 409) {
        setCollisionData({
          ticketId: ticket.ticketId,
          lockedBy: err.lockedBy || "Another Agent",
          lockExpiresAt: err.lockExpiresAt,
        });
      } else {
        toast.error(err.message || "Could not claim ticket");
      }
    }
  };

  const handleTicketUpdated = (updated: Ticket) => {
    setTickets((prev) =>
      prev.map((t) => (t.ticketId === updated.ticketId ? updated : t)),
    );
    if (selectedTicket?.ticketId === updated.ticketId) {
      setSelectedTicket(updated);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas selection:bg-blue-100 selection:text-blue-900">
      <Navbar
        currentAgent={currentAgent}
        onAgentChange={onAgentChange}
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onRefreshTickets={fetchTickets}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeRole === "customer" ? (
          <CustomerPortal />
        ) : (
          <div>
            {/* Top Stats Overview */}
            <StatsCards
              tickets={tickets}
              activeStatus={statusFilter}
              onStatusSelect={setStatusFilter}
            />

            {/* Filter & Search Toolbar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ticket ID, customer name, subject, or description..."
                  className="pl-9 bg-[#F8F9FA]/70 border-slate-200/80 text-xs focus:bg-white transition-colors"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Urgency:</span>
                </div>
                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  className="h-10 text-xs px-3 rounded-xl border border-slate-200/80 bg-[#F8F9FA]/70 text-slate-700 font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="All">All Urgency</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchTickets}
                  title="Refresh queue"
                  className="shrink-0"
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                </Button>
              </div>
            </div>

            {/* Tickets Grid */}
            {loading ? (
              <div className="py-20 text-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading support queue...</p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto my-10 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No tickets found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your search query or filters, or switch to the Customer Portal to submit a new ticket.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("All");
                    setUrgencyFilter("All");
                    setSearchQuery("");
                  }}
                  className="mt-4"
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tickets.map((ticket) => (
                  <TicketCard
                    key={ticket.ticketId}
                    ticket={ticket}
                    currentAgent={currentAgent}
                    onOpen={setSelectedTicket}
                    onClaim={handleClaimTicket}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Ticket Work Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={Boolean(selectedTicket)}
        onClose={() => setSelectedTicket(null)}
        currentAgent={currentAgent}
        onTicketUpdated={handleTicketUpdated}
        onCollision={(data) => setCollisionData(data)}
      />

      {/* Ticket In Progress Dialog */}
      <CollisionModal
        isOpen={Boolean(collisionData)}
        onClose={() => setCollisionData(null)}
        ticketId={collisionData?.ticketId || ""}
        lockedBy={collisionData?.lockedBy || ""}
        lockExpiresAt={collisionData?.lockExpiresAt}
      />
    </div>
  );
};

export default function App() {
  const [currentAgent, setCurrentAgent] = useState("agent_alex");

  return (
    <SocketProvider currentAgent={currentAgent}>
      <AppContent currentAgent={currentAgent} onAgentChange={setCurrentAgent} />
      <Toaster richColors position="bottom-right" closeButton />
    </SocketProvider>
  );
}
