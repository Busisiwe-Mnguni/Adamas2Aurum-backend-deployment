/**
 * Programmatic database migration for Better Auth.
 * Creates the required tables (user, session, account, verification) in MySQL.
 *
 * Usage: node migrate.js
 */
import "./env.js";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "./src/auth.js";

async function runMigrations() {
  try {
    const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);

    if (toBeCreated.length === 0 && Object.keys(toBeAdded).length === 0) {
      console.log("Database is up to date. No migrations needed.");
      process.exit(0);
    }

    console.log("Tables to create:", toBeCreated);
    console.log("Columns to add:", toBeAdded);

    await runMigrations();
    console.log("Migrations completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
}

runMigrations();
