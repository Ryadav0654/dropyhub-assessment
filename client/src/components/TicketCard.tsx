import React from "react";
import type { Ticket } from "../types";
import { SlaBadge } from "./SlaBadge";
import { LockBadge } from "./LockBadge";
import { ArrowRight, Check } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface TicketCardProps {
  ticket: Ticket;
  currentAgent: string;
  onOpen: (ticket: Ticket) => void;
  onClaim: (ticket: Ticket) => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  currentAgent,
  onOpen,
  onClaim,
}) => {
  const isLockedByMe = ticket.status === "In Progress" && ticket.lockedBy === currentAgent;
  const isLockedByOther =
    ticket.status === "In Progress" && ticket.lockedBy && ticket.lockedBy !== currentAgent;

  const getUrgencyVariant = (urgency: string) => {
    switch (urgency) {
      case "Critical":
        return "destructive";
      case "High":
        return "warning";
      case "Medium":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <Card
      onClick={() => onOpen(ticket)}
      className={`group cursor-pointer p-5 transition-all duration-200 flex flex-col justify-between hover:shadow-md hover:border-slate-300 ${
        isLockedByMe
          ? "border-indigo-400 ring-2 ring-indigo-500/10 shadow-xs"
          : isLockedByOther
          ? "border-amber-200 bg-amber-50/10 hover:border-amber-300"
          : ticket.isOverdue && ticket.status !== "Resolved"
          ? "border-rose-300 bg-rose-50/10 hover:border-rose-400"
          : ""
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              {ticket.ticketId}
            </span>
            <Badge variant={getUrgencyVariant(ticket.urgency)} className="text-[10px]">
              {ticket.urgency}
            </Badge>
            <Badge
              variant={
                ticket.status === "Open"
                  ? "warning"
                  : ticket.status === "In Progress"
                  ? "indigo"
                  : "success"
              }
              className="text-[10px]"
            >
              {ticket.status}
            </Badge>
          </div>

          <SlaBadge
            slaDueAt={ticket.slaDueAt}
            isOverdue={ticket.isOverdue}
            status={ticket.status}
          />
        </div>

        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition line-clamp-1 mb-1">
          {ticket.subject}
        </h3>

        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
          {ticket.description}
        </p>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-[10px] font-bold shrink-0">
            {ticket.customerName.charAt(0)}
          </div>
          <span className="text-slate-600 truncate font-medium text-[11px]">
            {ticket.customerName}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <LockBadge
            status={ticket.status}
            lockedBy={ticket.lockedBy}
            lockExpiresAt={ticket.lockExpiresAt}
            currentAgent={currentAgent}
          />

          {ticket.status === "Open" ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClaim(ticket);
              }}
              className="h-7 text-xs font-bold gap-1"
            >
              <span>Claim</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          ) : isLockedByMe ? (
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(ticket);
              }}
              className="h-7 text-xs font-bold bg-indigo-600 hover:bg-indigo-700"
            >
              Resume
            </Button>
          ) : isLockedByOther ? (
            <Badge variant="warning" className="text-[10px]">
              Assigned
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px] gap-1">
              <Check className="w-3 h-3" /> Solved
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};
