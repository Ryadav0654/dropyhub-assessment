# Helpdesk Ticketing System (Client)

A modern, clean, real-time frontend dashboard for the customer support ticketing system built with React, Vite, TypeScript, Tailwind CSS, and Socket.IO.

![Helpdesk Workspace Landing Page](../docs/screenshots/landing-page.png)

## Features

- **Agent Workspace**:
  - Live ticket queue with real-time updates over WebSockets.
  - Overview metric cards (Total, Open, In Progress, Resolved, Overdue).
  - Search by ticket ID, customer name, subject, or description, with urgency & status filters.
  - **Live Ticket Locking**:
    - Clearly shows which agent is actively working on a ticket.
    - If another agent tries to open or claim an in-progress ticket, an informative status dialog displays who is working on it.
  - **Active Session Lease**:
    - Automatically refreshes the agent's active session while the ticket modal is open.
    - Live session timer so agents know how long the ticket is held.
    - Quick "Release" action to voluntarily return tickets to the shared queue.
  - **24-Hour SLA Countdown**:
    - Every ticket displays a live countdown towards its 24-hour SLA.
    - If 24 hours pass, the ticket highlights as "Overdue" in real time without refreshing.
  - **Audit History**: Complete chronological timeline of actions (`CREATED`, `CLAIMED`, `HEARTBEAT`, `RELEASED`, `RESOLVED`, etc.).
  - **Agent Switcher**: Easily switch between agent profiles to represent different staff members.
- **Customer Portal**:
  - Simple, responsive ticket submission form with validation.
  - Reference ID confirmation (`TKT-XXXX`) with 24-hour SLA guarantee.
  - Real-time ticket tracker allowing customers to check status and read agent resolution notes.

## Getting Started

1. Install dependencies:
```bash
bun install
```

2. Start development server:
```bash
bun run dev
```
The application will run on `http://localhost:5173`.

3. Build for production:
```bash
bun run build
```
