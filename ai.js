// ai.js
// Handles all interactions with the GROQ API.

const Groq = require("groq-sdk");
require("dotenv").config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// This is the master prompt that defines the AI's role, schema, and rules.
const getSystemPromptForSql = () => `
You are an expert PostgreSQL query writer. Your task is to convert a user's natural language question into a valid PostgreSQL query.

You will query a view named \`v_sessions\`.

**Schema for v_sessions:**
- session_id (BIGSERIAL, PK): Unique ID for the session.
- topic_code (TEXT): The specific code for the topic.
- type (TEXT): The type of session (e.g., 'Live Class', 'Test Review Session').
- domain (TEXT): The subject domain (e.g., 'Backend', 'Data Science').
- class (TEXT): The name of the class.
- instructor (TEXT): The full name of the instructor.
- session_date (TIMESTAMPTZ): The session date and time, stored in UTC.
- pst_date (DATE): The session date in 'America/Los_Angeles' (PST/PDT) timezone.
- pst_year (INT): The year in PST.
- pst_quarter (INT): The quarter in PST (1-4).
- pst_month (INT): The month in PST (1-12).
- average (NUMERIC): The average rating for the session (1-5).
- responses (INT): The number of ratings received.
- students_attended (INT): The number of students who attended.
- rated_pct (NUMERIC): The percentage of attendees who left a rating (responses / students_attended).

**Important Rules:**
1.  **Timezone is Key:** ALL date and time filtering MUST be done using the \`pst_date\`, \`pst_year\`, \`pst_quarter\`, and \`pst_month\` columns. The user will always ask for dates in PST. For example, "Q1 2025" means \`WHERE pst_year = 2025 AND pst_quarter = 1\`. "January 2025" means \`WHERE pst_year = 2025 AND pst_month = 1\`.
2.  **Rounding:** ALL aggregate calculations on the \`average\` column (like AVG, STDDEV, or weighted averages) MUST be rounded to two decimal places using \`ROUND(..., 2)\`.
3.  **Weighted Average:** When asked for a "weighted average rating", you MUST use the formula: \`ROUND((SUM(average * responses) / SUM(responses))::numeric, 2)\`. Ensure you handle potential division by zero.
4.  **Simple Average:** When asked for a "simple average" or just "average rating", use \`ROUND(AVG(average), 2)\`.
5.  **Synonyms:** Treat 'class', 'topic', and 'session name' as synonyms that all refer to the \`class\` column.
6.  **Thresholds:** If the user mentions a minimum number of sessions (e.g., "min 3 sessions"), use a \`HAVING COUNT(*) >= 3\` clause after grouping. If a threshold is implied by context (e.g., "highest-rated instructor"), a reasonable minimum like 3 sessions is appropriate.
7.  **Consistency:** "Most consistent" instructor means the one with the lowest standard deviation of ratings. Calculate this using \`ROUND(STDDEV(average), 2)\`.
8.  **Response Count:** When asked for the 'number of sessions with responses', you MUST use \`COUNT(*) FILTER (WHERE responses > 0)\`. For the total 'number of sessions', use \`COUNT(*)\`.
9.  **Trend Analysis:** For questions about "month-over-month trend" or "increasing/decreasing ratings over time", you MUST generate a query that simply shows the data for comparison. Use a Common Table Expression (CTE) with the LAG() window function. The final query MUST be a simple \`SELECT ... FROM cte\` without any \`WHERE\` clause. For example: \`WITH monthly_avg AS (SELECT pst_month, ROUND(AVG(average), 2) AS current_avg FROM v_sessions WHERE pst_year = 2025 AND pst_quarter = 1 GROUP BY pst_month) SELECT pst_month, current_avg, LAG(current_avg, 1) OVER (ORDER BY pst_month) AS previous_avg FROM monthly_avg ORDER BY pst_month;\`
10. **Output Format:** ONLY output the raw SQL query. Do not include any explanations, comments, or markdown formatting like \`\`\`sql. Just the query itself.
`;

/**
 * Generates an SQL query from a natural language user query.
 * @param {string} userQuery The user's question in English.
 * @returns {Promise<string>} The generated SQL query.
 */
async function getAiSql(userQuery) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: getSystemPromptForSql(),
        },
        {
          role: "user",
          content: `User Question: "${userQuery}"\n\nSQL Query:`,
        },
      ],
      model: "llama3-70b-8192",
      temperature: 0,
      max_tokens: 1024,
    });
    return chatCompletion.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("[ERROR] Error in getAiSql:", error);
    throw new Error("Failed to generate SQL from GROQ API.");
  }
}

/**
 * Generates a human-readable summary of the query results.
 * @param {string} userQuery The original user query.
 * @param {string} sqlQuery The executed SQL query.
 * @param {Array<Object>} data The data returned from the database.
 * @returns {Promise<string>} A natural language summary.
 */
async function getAiSummary(userQuery, sqlQuery, data) {
  if (!data || data.length === 0) {
    return "The query ran successfully, but returned no results.";
  }
  try {
    const summaryPrompt = `
You are a helpful data analyst. Your job is to interpret the results of a database query and provide a concise, easy-to-understand summary.

The user asked the following question:
"${userQuery}"

To answer this, the following SQL query was executed:
\`\`\`sql
${sqlQuery}
\`\`\`

The query returned the following data:
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

Based on all this information, please provide a one or two-sentence summary of the finding. Be direct and clear.
`;
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful data analyst who summarizes query results in plain English.",
        },
        {
          role: "user",
          content: summaryPrompt,
        },
      ],
      model: "llama3-8b-8192", // A smaller model is fine for summarization
      temperature: 0.2,
      max_tokens: 256,
    });
    return (
      chatCompletion.choices[0]?.message?.content?.trim() ||
      "Could not generate a summary."
    );
  } catch (error) {
    console.error("[ERROR] Error in getAiSummary:", error);
    throw new Error("Failed to generate summary from GROQ API.");
  }
}

module.exports = { getAiSql, getAiSummary };
