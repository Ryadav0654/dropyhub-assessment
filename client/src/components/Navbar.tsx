import React, { useState } from "react";
import { Users, ChevronDown, Layers, Send, Menu, X, Check } from "lucide-react";
import { useSocket } from "../context/SocketContext";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";

import { Button } from "./ui/button";

const PRESET_AGENTS = [
  {
    id: "agent_alex",
    name: "Alex Chen",
    role: "Senior Support Engineer",
    avatar: "AC",
  },
  {
    id: "agent_sarah",
    name: "Sarah Jenkins",
    role: "Billing Specialist",
    avatar: "SJ",
  },
  {
    id: "agent_vikram",
    name: "Vikram Malhotra",
    role: "Platform Lead",
    avatar: "VM",
  },
  {
    id: "agent_priya",
    name: "Priya Sharma",
    role: "Customer Success",
    avatar: "PS",
  },
];

interface NavbarProps {
  currentAgent: string;
  onAgentChange: (agentId: string) => void;
  activeRole: "agent" | "customer";
  onRoleChange: (role: "agent" | "customer") => void;
  onRefreshTickets?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentAgent,
  onAgentChange,
  activeRole,
  onRoleChange,
}) => {
  const { connected, onlineAgentsCount } = useSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeAgent = PRESET_AGENTS.find((a) => a.id === currentAgent) || {
    id: currentAgent,
    name: currentAgent,
    role: "Support Agent",
    avatar: "AG",
  };

  const handleSelectAgent = (agent: (typeof PRESET_AGENTS)[0]) => {
    onAgentChange(agent.id);
    toast.info(`Active account switched to ${agent.name}`);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-[#F8F9FA]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900 text-base tracking-tight">
              Helpdesk<span className="text-blue-600">Hub</span>
            </span>
          </div>
        </div>

        {/* Center Pill Switcher (Desktop) */}
        <div className="hidden md:flex items-center bg-slate-200/60 p-1 rounded-3xl border border-slate-200/80">
          <button
            onClick={() => onRoleChange("agent")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all ${
              activeRole === "agent"
                ? "bg-white text-blue-600 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Agent Workspace</span>
          </button>
          <button
            onClick={() => onRoleChange("customer")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all  ${
              activeRole === "customer"
                ? "bg-white text-blue-600 shadow-2xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Customer Portal</span>
          </button>
        </div>

        {/* Right Section (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Live Status Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/80 border border-slate-200/80 text-xs shadow-2xs">
            <span className="relative flex h-2 w-2">
              {connected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  connected ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
            </span>
            <span className="text-slate-600 font-medium text-[11px]">
              {connected ? "Connected" : "Disconnected"}
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Users className="w-3 h-3 text-slate-400" />
              <span>{onlineAgentsCount} online</span>
            </div>
          </div>

          {/* Agent Switcher via shadcn DropdownMenu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 pl-2 pr-3 rounded-xl border-slate-200 hover:bg-slate-50 gap-2.5"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold shadow-2xs">
                  {activeAgent.avatar}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-800 leading-none">
                    {activeAgent.name}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {activeAgent.role}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Switch Profile</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {PRESET_AGENTS.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className="flex items-center justify-between py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 text-[10px] font-bold">
                      {agent.avatar}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {agent.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{agent.role}</p>
                    </div>
                  </div>
                  {currentAgent === agent.id && (
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-700"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 bg-[#F8F9FA] p-4 space-y-4 animate-in slide-in-from-top-3">
          {/* Role selector */}
          <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => {
                onRoleChange("agent");
                setMobileMenuOpen(false);
              }}
              className={`py-2 text-center text-xs font-semibold rounded-lg transition ${
                activeRole === "agent"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600"
              }`}
            >
              Agent Workspace
            </button>
            <button
              onClick={() => {
                onRoleChange("customer");
                setMobileMenuOpen(false);
              }}
              className={`py-2 text-center text-xs font-semibold rounded-lg transition ${
                activeRole === "customer"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600"
              }`}
            >
              Customer Portal
            </button>
          </div>

          {/* Mobile Agent Picker */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Active Agent
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    handleSelectAgent(agent);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-left transition ${
                    currentAgent === agent.id
                      ? "border-blue-500 bg-blue-50/50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="w-6 h-6 rounded-md bg-slate-200 flex items-center justify-center text-slate-700 text-[10px] font-bold">
                    {agent.avatar}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {agent.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {agent.role}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Connection info */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span>{connected ? "WebSocket Connected" : "Disconnected"}</span>
            </div>
            <span>{onlineAgentsCount} Agents Online</span>
          </div>
        </div>
      )}
    </header>
  );
};
