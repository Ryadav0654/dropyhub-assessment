import React from "react";
import type { Ticket } from "../types";
import { Inbox, PlayCircle, CheckCircle, AlertOctagon, Clock } from "lucide-react";

interface StatsCardsProps {
  tickets: Ticket[];
  activeStatus: string;
  onStatusSelect: (status: string) => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  tickets,
  activeStatus,
  onStatusSelect,
}) => {
  const total = tickets.length;
  const openCount = tickets.filter((t) => t.status === "Open").length;
  const inProgressCount = tickets.filter((t) => t.status === "In Progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "Resolved").length;
  const overdueCount = tickets.filter((t) => t.isOverdue && t.status !== "Resolved").length;

  const cards = [
    {
      id: "All",
      label: "Total Tickets",
      count: total,
      icon: Inbox,
      color: "blue",
      subtext: "System wide",
    },
    {
      id: "Open",
      label: "Open Queue",
      count: openCount,
      icon: Clock,
      color: "amber",
      subtext: "Awaiting claim",
    },
    {
      id: "In Progress",
      label: "In Progress",
      count: inProgressCount,
      icon: PlayCircle,
      color: "indigo",
      subtext: "Active agent locks",
    },
    {
      id: "Resolved",
      label: "Resolved",
      count: resolvedCount,
      icon: CheckCircle,
      color: "emerald",
      subtext: "Closed successfully",
    },
    {
      id: "Overdue",
      label: "SLA Breached",
      count: overdueCount,
      icon: AlertOctagon,
      color: "rose",
      subtext: "Past 24h limit",
      isAlert: overdueCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = activeStatus === card.id;

        return (
          <button
            key={card.id}
            onClick={() => onStatusSelect(card.id)}
            className={`flex flex-col p-4 rounded-2xl border text-left transition-all duration-150 relative overflow-hidden group ${
              isSelected
                ? "bg-white border-blue-500 shadow-md ring-2 ring-blue-500/10"
                : "bg-white hover:bg-slate-50 border-slate-200/80 shadow-xs"
            } ${card.isAlert ? "border-rose-300 bg-rose-50/30" : ""}`}
          >
            {card.isAlert && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
            )}

            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500">{card.label}</span>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  card.color === "blue"
                    ? "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
                    : card.color === "amber"
                    ? "bg-amber-50 text-amber-600 group-hover:bg-amber-100"
                    : card.color === "indigo"
                    ? "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                    : card.color === "emerald"
                    ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"
                    : "bg-rose-50 text-rose-600 group-hover:bg-rose-100"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {card.count}
              </span>
            </div>

            <span className="text-[11px] text-slate-400 mt-1 font-medium">
              {card.subtext}
            </span>
          </button>
        );
      })}
    </div>
  );
};
