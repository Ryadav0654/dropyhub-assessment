import React from "react";
import { Lock, Clock, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface CollisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  lockedBy: string;
  lockExpiresAt?: string;
}

export const CollisionModal: React.FC<CollisionModalProps> = ({
  isOpen,
  onClose,
  ticketId,
  lockedBy,
  lockExpiresAt,
}) => {
  const expiryDate = lockExpiresAt ? new Date(lockExpiresAt).toLocaleTimeString() : "shortly";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Top Header */}
        <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-b border-amber-100 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Ticket In Progress
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 mt-1">
              Ticket <span className="font-mono font-bold text-slate-800">{ticketId}</span> is already being worked on.
            </DialogDescription>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-slate-400" />
                Assigned Agent:
              </span>
              <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {lockedBy}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                Session Active Until:
              </span>
              <span className="font-medium text-slate-700">
                {expiryDate}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Only one agent can work on a ticket at a time to prevent conflicting responses. Once the assigned agent finishes, it will be updated automatically.
          </p>

          <DialogFooter className="pt-2">
            <Button variant="default" onClick={onClose} className="w-full sm:w-auto">
              Back to Queue
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
