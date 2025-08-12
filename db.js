// db.js
// Manages the connection to the Neon PostgreSQL database.

const { Pool } = require("pg");
require("dotenv").config();

// The connection string is pulled from the .env file
const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error("NEON_DATABASE_URL is not set in the .env file.");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

/**
 * Executes a SQL query against the database.
 * @param {string} sql The SQL query string to execute.
 * @param {Array} params Optional parameters for parameterized queries.
 * @returns {Promise<Object>} The result object from the database query.
 */
async function executeQuery(sql, params = []) {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(sql, params);
    return result;
  } catch (error) {
    console.error("[ERROR] Database query failed:", error);
    throw new Error(`Database execution error: ${error.message}`);
  } finally {
    if (client) {
      client.release(); // Release the client back to the pool
    }
  }
}

module.exports = { executeQuery };
