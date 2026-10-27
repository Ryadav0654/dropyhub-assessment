import { sweepGhostTickets, sweepOverdueTickets } from "./ticketService";
import type { SweepResult } from "../types";

let sweeperInterval: ReturnType<typeof setInterval> | null = null;
let isSweeping = false;

export async function runSweepNow(): Promise<SweepResult> {
  if (isSweeping) {
    return { ghostCount: 0, overdueCount: 0 };
  }

  isSweeping = true;
  try {
    const ghostCount = await sweepGhostTickets();
    const overdueCount = await sweepOverdueTickets();

    return { ghostCount, overdueCount };
  } catch (error) {
    console.error("Sweeper error:", error);
    return { ghostCount: 0, overdueCount: 0 };
  } finally {
    isSweeping = false;
  }
}

export function startSweeper(intervalMs = 5000): void {
  if (sweeperInterval) return;

  sweeperInterval = setInterval(() => {
    runSweepNow().catch((err) => {
      console.error("Sweeper tick error:", err);
    });
  }, intervalMs);
}

export function stopSweeper(): void {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
  }
}
