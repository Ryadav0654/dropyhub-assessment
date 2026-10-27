import React, { useEffect, useState } from "react";
import { Lock, Unlock, ShieldCheck } from "lucide-react";

interface LockBadgeProps {
  status: string;
  lockedBy: string | null;
  lockExpiresAt: string | null;
  currentAgent: string;
}

export const LockBadge: React.FC<LockBadgeProps> = ({
  status,
  lockedBy,
  lockExpiresAt,
  currentAgent,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    const calc = () => {
      if (!lockExpiresAt || status !== "In Progress") {
        setSecondsRemaining(0);
        return;
      }
      const expMs = new Date(lockExpiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      setSecondsRemaining(diffSec);
    };

    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [lockExpiresAt, status]);

  if (status !== "In Progress" || !lockedBy) {
    if (status === "Open") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          <Unlock className="w-3 h-3 text-emerald-500" />
          Available
        </span>
      );
    }
    return null;
  }

  const isLockedByMe = lockedBy === currentAgent;
  const isExpired = secondsRemaining <= 0;

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Unlock className="w-3 h-3 text-emerald-600" />
        Lease Expired (Reclaimable)
      </span>
    );
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (isLockedByMe) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
        <span>Locked by You</span>
        <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 px-1 py-0.2 rounded">
          {formatTimer(secondsRemaining)}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
      <Lock className="w-3 h-3 text-amber-600" />
      <span>Locked: {lockedBy}</span>
      <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded">
        {formatTimer(secondsRemaining)}
      </span>
    </span>
  );
};
