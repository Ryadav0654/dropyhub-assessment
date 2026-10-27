import { client, initDB } from "../database/db";
import path from "path";
import fs from "fs";
import type { MockTicket } from "../types";

const seedMockData = async () => {
  try {
    await initDB();

    console.log("Seeding database...");

    const mockDataPath = fs.existsSync(path.resolve("mock-data.json"))
      ? path.resolve("mock-data.json")
      : path.join(import.meta.dir, "../../mock-data.json");
    const rawMockData = fs.readFileSync(mockDataPath, "utf-8");
    const mockTickets: MockTicket[] = JSON.parse(rawMockData);

    const query = `
      INSERT INTO tickets (
        ticket_id,
        customer_name,
        customer_email,
        subject,
        description,
        urgency,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (ticket_id) DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        customer_email = EXCLUDED.customer_email,
        subject = EXCLUDED.subject,
        description = EXCLUDED.description,
        urgency = EXCLUDED.urgency,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP;
    `;

    for (const ticket of mockTickets) {
      await client.query(query, [
        ticket.ticket_id,
        ticket.customer_name,
        ticket.customer_email,
        ticket.subject,
        ticket.description,
        ticket.urgency,
        ticket.status,
        ticket.created_at,
        ticket.created_at,
      ]);
      console.log(`Seeded ticket: ${ticket.ticket_id} - ${ticket.subject}`);
    }

    console.log(`Database seeded successfully with ${mockTickets.length} tickets.`);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
};

seedMockData();


