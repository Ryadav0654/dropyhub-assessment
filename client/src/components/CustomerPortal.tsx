import React, { useState } from "react";
import type { CreateTicketPayload, Ticket, UrgencyLevel } from "../types";
import { api } from "../services/api";
import { toast } from "sonner";
import {
  Send,
  CheckCircle2,
  Search,
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";



export const CustomerPortal: React.FC = () => {
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<Ticket | null>(null);
  const [copied, setCopied] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("High");

  // Tracking section
  const [searchId, setSearchId] = useState("");
  const [trackingTicket, setTrackingTicket] = useState<Ticket | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !name.trim() ||
      !email.trim() ||
      !subject.trim() ||
      !description.trim()
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateTicketPayload = {
        customerName: name.trim(),
        customerEmail: email.trim(),
        subject: subject.trim(),
        description: description.trim(),
        urgency,
      };

      const res = await api.createTicket(payload);
      setSubmittedTicket(res.data);
      toast.success("Ticket submitted successfully", {
        description: `Reference ${res.data.ticketId} created with 24h SLA.`,
      });

      // Clear form
      setName("");
      setEmail("");
      setSubject("");
      setDescription("");
    } catch (err: any) {
      toast.error(err.message || "Could not submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTrackTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;

    setTrackingLoading(true);
    setTrackingError("");
    try {
      const formatted = searchId.trim().toUpperCase();
      const res = await api.getTicketById(formatted);
      setTrackingTicket(res.data);
    } catch {
      setTrackingError(
        "Ticket not found. Please verify the ID format (e.g. TKT-9001).",
      );
      setTrackingTicket(null);
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-10">
      {/* Hero Welcome */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/60 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Priority Customer Support</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Submit a Support Request
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Our engineering & support agents respond with a guaranteed 24-hour
          turnaround SLA.
        </p>
      </div>

      {/* Submission Form Card or Success Screen */}
      {submittedTicket ? (
        <Card className="max-w-lg mx-auto shadow-xl border-emerald-200 overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-transparent p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Request Received
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Your ticket has been dispatched to our support queue.
            </p>

            <div className="my-6 p-4 rounded-xl bg-white border border-slate-200 text-left space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Ticket Reference:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-blue-600">
                  <span>{submittedTicket.ticketId}</span>
                  <button
                    onClick={() => handleCopyId(submittedTicket.ticketId)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                    title="Copy Ticket ID"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Subject:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                  {submittedTicket.subject}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">SLA Due:</span>
                <span className="font-semibold text-emerald-700">
                  {new Date(submittedTicket.slaDueAt!).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  , tomorrow
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setSubmittedTicket(null)}
                className="w-full text-xs"
              >
                Submit Another Request
              </Button>
              <Button
                onClick={() => {
                  setSearchId(submittedTicket.ticketId);
                  setTrackingTicket(submittedTicket);
                  setSubmittedTicket(null);
                }}
                className="w-full text-xs gap-1.5"
              >
                <span>Track Progress</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Full Name
                </label>
                <Input
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="bg-slate-50/50 border-slate-200/80 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Email Address
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="bg-slate-50/50 border-slate-200/80 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Subject
                </label>
                <Input
                  required
                  minLength={5}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Summarize the question or issue"
                  className="bg-slate-50/50 border-slate-200/80 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Priority
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                  className="flex h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/50 px-3.5 py-2 text-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus:bg-white text-slate-800"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                  <option value="Critical">Critical Priority</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Description
                </label>
                <span className="text-[10px] text-slate-400">
                  {description.length} / 1000 characters
                </span>
              </div>
              <Textarea
                required
                minLength={10}
                maxLength={1000}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide any details, steps to reproduce, or context that can help our team resolve your request quickly..."
                className="bg-slate-50/50 border-slate-200/80 focus:bg-white"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Guaranteed 24-Hour SLA
              </span>
              <Button type="submit" disabled={submitting} className="gap-2">
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? "Submitting..." : "Send Ticket"}</span>
              </Button>
            </div>
          </form>

      )}

      {/* Ticket Tracking Section */}
      <Card className="bg-white border-slate-200/80 shadow-xs">
        <CardContent className="p-6">
          <div className="max-w-md mx-auto text-center space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Track Ticket Status
            </h3>
            <p className="text-xs text-slate-500">
              Already have a reference ID? Track live progress below.
            </p>

            <form onSubmit={handleTrackTicket} className="flex gap-2">
              <Input
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Enter Ticket ID (e.g. TKT-9001)"
                className="font-mono bg-slate-50/50 border-slate-200/80 focus:bg-white"
              />
              <Button
                type="submit"
                disabled={trackingLoading || !searchId.trim()}
                className="gap-1.5 shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{trackingLoading ? "..." : "Track"}</span>
              </Button>
            </form>
          </div>

          {trackingError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl text-center max-w-md mx-auto mt-4">
              {trackingError}
            </div>
          )}

          {trackingTicket && (
            <div className="mt-6 max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <Badge variant="default" className="font-mono text-xs">
                  {trackingTicket.ticketId}
                </Badge>
                <Badge
                  variant={
                    trackingTicket.status === "Open"
                      ? "warning"
                      : trackingTicket.status === "In Progress"
                        ? "indigo"
                        : "success"
                  }
                >
                  {trackingTicket.status}
                </Badge>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {trackingTicket.subject}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {trackingTicket.description}
                </p>
              </div>

              {trackingTicket.status === "Resolved" && (
                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 text-xs space-y-1.5">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Support Resolution:
                  </span>
                  <p className="text-emerald-900 bg-white p-2.5 rounded-lg border border-emerald-100 leading-relaxed">
                    {trackingTicket.resolutionNote ||
                      "Issue was addressed and solved."}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
