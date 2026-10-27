import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  onlineAgentsCount: number;
  onlineAgents: string[];
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  onlineAgentsCount: 0,
  onlineAgents: [],
});

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:8080";

export const SocketProvider: React.FC<{
  currentAgent: string;
  children: React.ReactNode;
}> = ({ currentAgent, children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineAgentsCount, setOnlineAgentsCount] = useState(1);
  const [onlineAgents, setOnlineAgents] = useState<string[]>([]);

  useEffect(() => {
    const s = io(SOCKET_SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    s.on("connect", () => {
      setConnected(true);
      if (currentAgent) {
        s.emit("agent:identify", currentAgent);
      }
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    s.on("system:agents_online", (data: { count: number; agents: string[] }) => {
      setOnlineAgentsCount(data.count);
      setOnlineAgents(data.agents);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // Update agent registration when currentAgent changes
  useEffect(() => {
    if (socket && connected && currentAgent) {
      socket.emit("agent:identify", currentAgent);
    }
  }, [socket, connected, currentAgent]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        onlineAgentsCount,
        onlineAgents,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
