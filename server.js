// server.js
// Main entry point for the backend server.

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { getAiSql, getAiSummary } = require("./ai");
const { executeQuery } = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve the frontend

// Main endpoint to handle natural language queries
app.post("/api/query", async (req, res) => {
  const { query: userQuery } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: "Query is required." });
  }

  console.log(`[INFO] Received query: "${userQuery}"`);

  try {
    // Step 1: Get SQL from the AI based on the user query and schema
    console.log("[INFO] Generating SQL...");
    const sqlQuery = await getAiSql(userQuery);
    console.log(`[INFO] Generated SQL: ${sqlQuery}`);

    if (!sqlQuery || !sqlQuery.toUpperCase().startsWith("SELECT")) {
      console.error("[ERROR] Failed to generate valid SQL.");
      return res.status(500).json({
        error:
          "Failed to generate a valid SQL query. The AI may have returned an invalid response.",
      });
    }

    // Step 2: Execute the SQL query against the database
    console.log("[INFO] Executing SQL on Neon DB...");
    const { rows: data } = await executeQuery(sqlQuery);
    console.log(`[INFO] Fetched ${data.length} rows from DB.`);

    // Step 3: Get a natural language summary of the results from the AI
    console.log("[INFO] Generating summary...");
    const summary = await getAiSummary(userQuery, sqlQuery, data);
    console.log(`[INFO] Generated Summary: ${summary}`);

    // Step 4: Return the structured response
    res.json({
      data,
      summary,
      sql: sqlQuery,
    });
  } catch (error) {
    console.error(
      "[ERROR] An error occurred in the /api/query endpoint:",
      error
    );
    res.status(500).json({
      error: "An internal server error occurred.",
      details: error.message,
    });
  }
});

// New endpoints for instructions page
app.get("/api/instructors", async (req, res) => {
  try {
    console.log("[INFO] Fetching instructors list...");
    const { rows: data } = await executeQuery(
      "SELECT instructor_name FROM dim_instructor ORDER BY instructor_name"
    );
    res.json(data);
  } catch (error) {
    console.error("[ERROR] Failed to fetch instructors:", error);
    res.status(500).json({
      error: "Failed to fetch instructors",
      details: error.message,
    });
  }
});

app.get("/api/domains", async (req, res) => {
  try {
    console.log("[INFO] Fetching domains list...");
    const { rows: data } = await executeQuery(
      "SELECT domain_name FROM dim_domain ORDER BY domain_name"
    );
    res.json(data);
  } catch (error) {
    console.error("[ERROR] Failed to fetch domains:", error);
    res.status(500).json({
      error: "Failed to fetch domains",
      details: error.message,
    });
  }
});

app.get("/api/classes", async (req, res) => {
  try {
    console.log("[INFO] Fetching classes list...");
    const { rows: data } = await executeQuery(
      "SELECT class_name FROM dim_class ORDER BY class_name"
    );
    res.json(data);
  } catch (error) {
    console.error("[ERROR] Failed to fetch classes:", error);
    res.status(500).json({
      error: "Failed to fetch classes",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
