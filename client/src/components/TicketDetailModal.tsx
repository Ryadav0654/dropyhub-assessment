import React, { useEffect, useState, useRef } from "react";
import type { Ticket, TicketActivity } from "../types";
import { api, ApiError } from "../services/api";
import { toast } from "sonner";
import { SlaBadge } from "./SlaBadge";
import {
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  User,
  Mail,
  History,
  Activity,
  ShieldCheck,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";

interface TicketDetailModalProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onClose: () => void;
  currentAgent: string;
  onTicketUpdated: (updatedTicket: Ticket) => void;
  onCollision: (data: { ticketId: string; lockedBy: string; lockExpiresAt?: string }) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  isOpen,
  onClose,
  currentAgent,
  onTicketUpdated,
  onCollision,
}) => {
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(ticket);
  const [activities, setActivities] = useState<TicketActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number>(180);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync internal state when prop changes
  useEffect(() => {
    setCurrentTicket(ticket);
    if (ticket) {
      loadFullDetails(ticket.ticketId);
    }
  }, [ticket]);

  // Load ticket details and activity logs
  const loadFullDetails = async (id: string) => {
    try {
      const res = await api.getTicketById(id);
      setCurrentTicket(res.data);
      setActivities(res.data.activities || []);
    } catch (err: any) {
      console.error("Error loading ticket details:", err);
    }
  };

  const isLockedByMe =
    currentTicket?.status === "In Progress" && currentTicket?.lockedBy === currentAgent;
  const isLockedByOther =
    currentTicket?.status === "In Progress" &&
    currentTicket?.lockedBy &&
    currentTicket?.lockedBy !== currentAgent;

  // Countdown timer for active lock lease
  useEffect(() => {
    if (!isOpen || !currentTicket?.lockExpiresAt || currentTicket.status !== "In Progress") {
      setSecondsLeft(0);
      return;
    }

    const updateTimer = () => {
      const expMs = new Date(currentTicket.lockExpiresAt!).getTime();
      const diffSec = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      setSecondsLeft(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, currentTicket?.lockExpiresAt, currentTicket?.status]);

  // Heartbeat while modal is open to keep session active
  useEffect(() => {
    if (!isOpen || !isLockedByMe || !currentTicket) {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }

    // Ping server every 30s to keep session active
    heartbeatTimerRef.current = setInterval(async () => {
      try {
        const res = await api.heartbeatTicket(currentTicket.ticketId, currentAgent);
        setCurrentTicket((prev) =>
          prev ? { ...prev, lockExpiresAt: res.data.lockExpiresAt } : prev,
        );
      } catch (err) {
        console.warn("Heartbeat refresh failed:", err);
      }
    }, 30000);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [isOpen, isLockedByMe, currentTicket?.ticketId, currentAgent]);

  if (!isOpen || !currentTicket) return null;

  // Claim Ticket
  const handleClaim = async () => {
    setLoading(true);
    try {
      const res = await api.claimTicket(currentTicket.ticketId, currentAgent);
      setCurrentTicket(res.data);
      onTicketUpdated(res.data);
      toast.success("Ticket claimed", {
        description: `Exclusive session active on ${res.data.ticketId}.`,
      });
      loadFullDetails(res.data.ticketId);
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 409) {
        onCollision({
          ticketId: currentTicket.ticketId,
          lockedBy: err.lockedBy || "Another Agent",
          lockExpiresAt: err.lockExpiresAt,
        });
      } else {
        toast.error(err.message || "Failed to claim ticket");
      }
    } finally {
      setLoading(false);
    }
  };

  // Voluntary Release
  const handleRelease = async () => {
    setLoading(true);
    try {
      const res = await api.releaseTicket(currentTicket.ticketId, currentAgent);
      setCurrentTicket(res.data);
      onTicketUpdated(res.data);
      toast.info("Ticket returned to queue", {
        description: `${res.data.ticketId} is now available for other agents.`,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to release ticket");
    } finally {
      setLoading(false);
    }
  };

  // Resolve Ticket
  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setResolving(true);
    try {
      const res = await api.resolveTicket(
        currentTicket.ticketId,
        currentAgent,
        resolutionNote || "Resolved by agent",
      );
      setCurrentTicket(res.data);
      onTicketUpdated(res.data);
      toast.success("Ticket resolved successfully", {
        description: `${res.data.ticketId} marked as Resolved.`,
      });
      loadFullDetails(res.data.ticketId);
      setResolutionNote("");
    } catch (err: any) {
      toast.error(err.message || "Could not resolve ticket");
    } finally {
      setResolving(false);
    }
  };

  const formatMinSec = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 bg-[#F8F9FA] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
              {currentTicket.ticketId}
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-slate-900 truncate">
                {currentTicket.subject}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant={
                    currentTicket.status === "Open"
                      ? "warning"
                      : currentTicket.status === "In Progress"
                      ? "indigo"
                      : "success"
                  }
                  className="text-[10px]"
                >
                  {currentTicket.status}
                </Badge>
                <span className="text-slate-300">·</span>
                <SlaBadge
                  slaDueAt={currentTicket.slaDueAt}
                  isOverdue={currentTicket.isOverdue}
                  status={currentTicket.status}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lock Banner */}
        {isLockedByMe && currentTicket.status === "In Progress" && (
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border-b border-indigo-100 px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
              </span>
              <div>
                <p className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Assigned to You
                </p>
                <p className="text-[11px] text-indigo-700">
                  Active session. Ticket automatically unassigns if left inactive.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-indigo-950 bg-white px-2 py-1 rounded-md border border-indigo-200 shadow-2xs">
                  {formatMinSec(secondsLeft)}
                </span>
                <p className="text-[10px] text-indigo-600 mt-0.5">session timer</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRelease}
                disabled={loading}
                className="h-8"
              >
                Release
              </Button>
            </div>
          </div>
        )}

        {isLockedByOther && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs font-medium text-amber-900">
                <span className="font-bold">{currentTicket.lockedBy}</span> is currently working on this ticket.
                Read-only mode.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
              Active: {formatMinSec(secondsLeft)}
            </span>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer Metadata Card */}
          <div className="bg-[#F8F9FA] rounded-xl p-4 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] font-medium">Customer</span>
              <p className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {currentTicket.customerName}
              </p>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px] font-medium">Email</span>
              <p className="font-medium text-slate-700 flex items-center gap-1.5 mt-0.5 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {currentTicket.customerEmail}
              </p>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px] font-medium">Submitted</span>
              <p className="font-medium text-slate-700 flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {new Date(currentTicket.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Ticket Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Issue Description
            </h4>
            <div className="p-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed shadow-xs">
              {currentTicket.description}
            </div>
          </div>

          {/* Resolution Card if Resolved */}
          {currentTicket.status === "Resolved" && (
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-emerald-950">Resolution Note</h4>
                {currentTicket.resolvedAt && (
                  <span className="text-[10px] text-emerald-700 ml-auto font-medium">
                    {new Date(currentTicket.resolvedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-900 bg-white/70 p-3 rounded-lg border border-emerald-100">
                {currentTicket.resolutionNote || "Issue resolved."}
              </p>
            </div>
          )}

          {/* Work Area / Claim action */}
          {currentTicket.status === "Open" && (
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-blue-950">
                  Ready to respond to this ticket?
                </p>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Assign this ticket to yourself to start composing a resolution.
                </p>
              </div>
              <Button
                onClick={handleClaim}
                disabled={loading}
                className="w-full sm:w-auto gap-2"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Claim Ticket</span>
              </Button>
            </div>
          )}

          {/* Active Work & Resolution Form */}
          {isLockedByMe && currentTicket.status === "In Progress" && (
            <form onSubmit={handleResolve} className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Resolution & Reply Note
                </label>
                <span className="text-[10px] text-slate-400">
                  Will be recorded in customer history
                </span>
              </div>
              <Textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Explain the solution provided or resolution details..."
                rows={3}
                required
              />
              <div className="flex justify-end gap-2.5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRelease}
                  disabled={loading || resolving}
                >
                  Return to Queue
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  disabled={resolving || !resolutionNote.trim()}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{resolving ? "Resolving..." : "Mark as Resolved"}</span>
                </Button>
              </div>
            </form>
          )}

          {/* Activity Timeline Audit History */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-3">
              <History className="w-4 h-4 text-slate-400" />
              Activity & History
            </h4>
            <div className="space-y-2.5">
              {activities.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                        act.action === "CREATED"
                          ? "bg-blue-100 text-blue-700"
                          : act.action === "CLAIMED"
                          ? "bg-indigo-100 text-indigo-700"
                          : act.action === "GHOST_TIMEOUT"
                          ? "bg-amber-100 text-amber-700"
                          : act.action === "SLA_BREACHED"
                          ? "bg-rose-100 text-rose-700"
                          : act.action === "RESOLVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <Activity className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{act.actor}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(act.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">
                        {act.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
