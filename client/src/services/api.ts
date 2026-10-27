import axios, { AxiosError } from "axios";
import type { Ticket, CreateTicketPayload } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api/tickets";

export interface ApiErrorResponse {
  success: false;
  statusCode?: number;
  error: string;
  lockedBy?: string;
  lockExpiresAt?: string;
  errors?: any[];
}

export class ApiError extends Error {
  public statusCode: number;
  public lockedBy?: string;
  public lockExpiresAt?: string;
  public validationErrors?: any[];

  constructor(data: Partial<ApiErrorResponse>, status: number) {
    super(data.error || "An API error occurred");
    this.name = "ApiError";
    this.statusCode = status;
    this.lockedBy = data.lockedBy;
    this.lockExpiresAt = data.lockExpiresAt;
    this.validationErrors = data.errors;
  }
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response) {
      const data = error.response.data || { error: error.message, success: false };
      return Promise.reject(new ApiError(data, error.response.status));
    }
    return Promise.reject(
      new ApiError({ error: error.message || "Network error", success: false }, 500),
    );
  },
);

export const api = {
  getTickets: async (params?: { status?: string; search?: string; urgency?: string }) => {
    const queryParams: Record<string, string> = {};
    if (params?.status && params.status !== "All") queryParams.status = params.status;
    if (params?.urgency && params.urgency !== "All") queryParams.urgency = params.urgency;
    if (params?.search && params.search.trim()) queryParams.search = params.search.trim();

    const response = await apiClient.get<{ success: boolean; count: number; data: Ticket[] }>("", {
      params: queryParams,
    });
    return response.data;
  },

  getTicketById: async (ticketId: string) => {
    const response = await apiClient.get<{ success: boolean; data: Ticket }>(`/${ticketId}`);
    return response.data;
  },

  createTicket: async (payload: CreateTicketPayload) => {
    const response = await apiClient.post<{ success: boolean; data: Ticket }>("", payload);
    return response.data;
  },

  claimTicket: async (ticketId: string, agentId: string) => {
    const response = await apiClient.post<{ success: boolean; message: string; data: Ticket }>(
      `/${ticketId}/claim`,
      { agentId },
    );
    return response.data;
  },

  heartbeatTicket: async (ticketId: string, agentId: string) => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: { lockExpiresAt: string };
    }>(`/${ticketId}/heartbeat`, { agentId });
    return response.data;
  },

  releaseTicket: async (ticketId: string, agentId: string) => {
    const response = await apiClient.post<{ success: boolean; message: string; data: Ticket }>(
      `/${ticketId}/release`,
      { agentId },
    );
    return response.data;
  },

  resolveTicket: async (ticketId: string, agentId: string, note?: string) => {
    const response = await apiClient.post<{ success: boolean; message: string; data: Ticket }>(
      `/${ticketId}/resolve`,
      { agentId, note },
    );
    return response.data;
  },
};
