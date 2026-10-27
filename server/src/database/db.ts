import { Pool } from "pg";
import path from "path";
import fs from "fs";

const client = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initDB = async () => {
  try {
    const schemaPath = fs.existsSync(path.resolve("src/database/schema.sql"))
      ? path.resolve("src/database/schema.sql")
      : path.join(import.meta.dir, "schema.sql");
    const sql = fs.readFileSync(schemaPath, "utf-8");

    // 2. Run your setup queries
    await client.query(sql);
    console.log("Database tables checked/created successfully.");
  } catch (err: any) {
    // This will now catch connection errors (e.g., "ECONNREFUSED")
    console.error("Error initializing database tables:", err.message);

    // Optional: Exit the process if the database connection is mandatory for your server
    process.exit(1);
  }
};


export { client, initDB };
