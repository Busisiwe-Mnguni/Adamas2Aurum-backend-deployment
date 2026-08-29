import { betterAuth } from "better-auth"
import pool from "./utils/db.js"

// Strip trailing slash so better-auth doesn't produce double slashes
const baseURL = (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "")

export const auth = betterAuth({
    // Pass the mysql2/promise pool directly — better-auth uses Kysely internally
    database: pool,
    basePath: "/api/auth",
    baseURL: baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        minPasswordLength: 6,
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
    },
    trustedOrigins: [
        "http://localhost:8055",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
})
