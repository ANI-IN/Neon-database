// server.js - Complete Fixed Version
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { getAiSql, getAiSummary } = require("./ai");
const { executeQuery } = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.use(express.static(path.join(__dirname, "public")));
// Much simpler and more reliable SQL validation
function isValidSqlQuery(sqlQuery) {
  if (!sqlQuery || typeof sqlQuery !== "string") {
    console.log("[DEBUG] SQL validation failed: empty or non-string");
    return false;
  }

  const trimmedSql = sqlQuery.trim();
  console.log("[DEBUG] Validating SQL:", trimmedSql.substring(0, 100) + "...");

  if (!trimmedSql) {
    console.log("[DEBUG] SQL validation failed: empty after trim");
    return false;
  }

  // More flexible validation - allow WITH (CTEs) and SELECT
  const startsCorrectly = /^\s*(WITH|SELECT)\s+/i.test(trimmedSql);
  console.log("[DEBUG] Starts with WITH/SELECT:", startsCorrectly);

  if (!startsCorrectly) {
    console.log(
      "[DEBUG] SQL validation failed: doesn't start with WITH or SELECT"
    );
    return false;
  }

  // Basic check for SQL structure
  const hasBasicStructure =
    /\bFROM\s+/i.test(trimmedSql) || /\bSELECT\s+/i.test(trimmedSql);
  console.log("[DEBUG] Has basic SQL structure:", hasBasicStructure);

  return hasBasicStructure;
}

// Main endpoint
app.post("/api/query", async (req, res) => {
  const { query: userQuery } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: "Query is required." });
  }

  console.log(`[INFO] Received query: "${userQuery}"`);

  try {
    // Step 1: Generate SQL
    console.log("[INFO] Generating SQL...");
    const sqlQuery = await getAiSql(userQuery);
    console.log(`[INFO] Generated SQL: ${sqlQuery}`);

    // Step 2: Validate SQL
    if (!isValidSqlQuery(sqlQuery)) {
      console.error("[ERROR] SQL validation failed");
      console.error(`[ERROR] Full SQL: ${sqlQuery}`);
      return res.status(500).json({
        error: "Generated SQL query is invalid",
        details: `SQL: ${sqlQuery}`,
        suggestion: "Try rephrasing your question",
      });
    }

    console.log("[INFO] SQL validation passed");

    // Step 3: Execute SQL
    console.log("[INFO] Executing SQL on database...");
    const { rows: data } = await executeQuery(sqlQuery);
    console.log(
      `[INFO] Query executed successfully. Fetched ${data.length} rows.`
    );

    // Step 4: Generate summary
    console.log("[INFO] Generating summary...");
    const summary = await getAiSummary(userQuery, sqlQuery, data);
    console.log(`[INFO] Summary generated: ${summary.substring(0, 100)}...`);

    // Step 5: Return response
    res.json({
      data,
      summary,
      sql: sqlQuery,
    });
  } catch (error) {
    console.error("[ERROR] Error in /api/query:", error);

    if (
      error.message.includes("Service unavailable") ||
      error.message.includes("503")
    ) {
      res.status(503).json({
        error: "AI service temporarily unavailable",
        details: "GROQ API is down. Try again in a few minutes.",
        suggestion: "Check https://groqstatus.com/ for status",
      });
    } else if (error.message.includes("Database execution error")) {
      res.status(500).json({
        error: "Database query failed",
        details: error.message,
        suggestion: "The SQL might have syntax errors",
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
        suggestion: "Please try again",
      });
    }
  }
});

// Other endpoints remain the same
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
