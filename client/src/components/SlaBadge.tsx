import React, { useEffect, useState } from "react";
import { AlertCircle, Clock } from "lucide-react";

interface SlaBadgeProps {
  slaDueAt: string | null;
  isOverdue: boolean;
  status: string;
}

export const SlaBadge: React.FC<SlaBadgeProps> = ({ slaDueAt, isOverdue, status }) => {
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");
  const [isBreached, setIsBreached] = useState<boolean>(isOverdue);

  useEffect(() => {
    const updateCountdown = () => {
      if (!slaDueAt || status === "Resolved" || status === "Closed") {
        setTimeLeftStr("Completed");
        return;
      }

      const dueMs = new Date(slaDueAt).getTime();
      const diffMs = dueMs - Date.now();

      if (diffMs <= 0 || isOverdue) {
        setIsBreached(true);
        const overdueMs = Math.abs(diffMs);
        const hours = Math.floor(overdueMs / (1000 * 60 * 60));
        const minutes = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeftStr(`Overdue by ${hours}h ${minutes}m`);
      } else {
        setIsBreached(false);
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeftStr(`${hours}h ${minutes}m left`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [slaDueAt, isOverdue, status]);

  if (status === "Resolved" || status === "Closed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <Clock className="w-3 h-3 text-slate-400" />
        SLA Met
      </span>
    );
  }

  if (isBreached) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
        <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
        {timeLeftStr || "Overdue"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
      <Clock className="w-3 h-3 text-blue-500 shrink-0" />
      {timeLeftStr || "24h SLA"}
    </span>
  );
};
