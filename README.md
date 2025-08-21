# AI Database Analyst

A web application that converts natural language questions into PostgreSQL queries using AI, specifically designed for analyzing live class session data.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [System Flow](#system-flow)
- [Database Schema](#database-schema)
- [Components Deep Dive](#components-deep-dive)
- [API Endpoints](#api-endpoints)
- [ETL Process](#etl-process)
- [Frontend Implementation](#frontend-implementation)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

## Overview

This application enables users to query session data using natural language. Instead of writing complex SQL queries, users can ask questions like "Who is the most consistent instructor in Q2 2025?" and get comprehensive results with AI-generated summaries.

### Key Features

- **Natural Language Processing**: Convert plain English to SQL using Groq AI
- **Session Analytics**: Analyze instructor performance, student engagement, and session trends
- **Time-based Analysis**: Quarter-wise, month-wise comparisons with PST timezone handling
- **Real-time Results**: Instant query execution with formatted results
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Architecture

![Architecture Diagram](./images/Architecture%20Diagram.png)

## System Flow

### Query Processing Flow

![Query Processing Flow Diagram](./images/Query%20Processing%20Flow.png)

### AI Query Generation Logic

![AI Query Generation Logic Diagram](./images/AI%20Query%20Generation%20Logic.png)

## Database Schema

### Star Schema Design

![Star Schema Design Diagram](./images/Star%20Schema%20Design.png)

### View Structure

The application primarily queries `v_sessions` view which denormalizes the star schema:

```sql
CREATE OR REPLACE VIEW v_sessions AS
SELECT
  fs.session_id,
  fs.topic_code,
  dt.type_name AS type,
  dd.domain_name AS domain,
  dc.class_name AS class,
  di.instructor_name AS instructor,
  fs.session_ts_utc,
  fs.pst_date, fs.pst_year, fs.pst_month, fs.pst_quarter,
  fs.average, fs.responses, fs.students_attended, fs.rated_pct
FROM fact_session fs
JOIN dim_type dt ON dt.type_id = fs.type_id
JOIN dim_domain dd ON dd.domain_id = fs.domain_id
JOIN dim_class dc ON dc.class_id = fs.class_id
JOIN dim_instructor di ON di.instructor_id = fs.instructor_id;
```

## Components Deep Dive

### 1. AI Module (`ai.js`)

**Purpose**: Handles communication with Groq AI API for SQL generation and result summarization.

**Key Functions**:

- `getAiSql(userQuery, maxRetries)`: Converts natural language to SQL
- `getAiSummary(userQuery, sqlQuery, data)`: Generates human-readable summaries

**Logic Flow**:

![Logic Flow Diagram](./images/Logic%20Flow%20Diagram.png)

**Retry Mechanism**:

- 3 attempts for SQL generation
- 2 attempts for summary generation
- Exponential backoff on 503 errors
- Different models for different tasks (llama3-70b for SQL, llama3-8b for summaries)

### 2. Database Module (`db.js`)

**Purpose**: Manages PostgreSQL connections using connection pooling.

**Key Features**:

- Connection pooling for performance
- SSL configuration for Neon database
- Automatic client release
- Comprehensive error handling

**Connection Flow**:

![Connection Flow Diagram](./images/Connection%20Flow.png)

### 3. Server Module (`server.js`)

**Purpose**: Express.js server handling HTTP requests and coordinating between components.

**Endpoints**:

- `POST /api/query`: Main query processing
- `GET /api/instructors`: Fetch instructor list
- `GET /api/domains`: Fetch domain list
- `GET /api/classes`: Fetch class list

**Query Processing Logic**:

![Query Processing Logic Diagram](./images/Query%20Processing%20Logic.png)

**SQL Validation Rules**:

- Must start with `WITH` or `SELECT`
- Must contain basic SQL structure (`FROM` clause)
- String and non-empty validation
- Security-focused (prevents non-SELECT operations)

## API Endpoints

### POST /api/query

**Request Body**:

```json
{
  "query": "Who is the most consistent instructor in Q2 2025?"
}
```

**Response**:

```json
{
  "data": [
    {
      "instructor": "John Doe",
      "avg_rating": 4.85,
      "sessions": 12,
      "variance": 0.12
    }
  ],
  "summary": "John Doe is the most consistent instructor in Q2 2025 with an average rating of 4.85 across 12 sessions.",
  "sql": "WITH instructor_stats AS (SELECT instructor, AVG(average) as avg_rating, COUNT(*) as sessions, VARIANCE(average) as variance FROM v_sessions WHERE pst_year = 2025 AND pst_quarter = 2 GROUP BY instructor HAVING COUNT(*) >= 6) SELECT * FROM instructor_stats ORDER BY variance ASC LIMIT 1;"
}
```

**Error Response**:

```json
{
  "error": "Generated SQL query is invalid",
  "details": "SQL: INVALID QUERY",
  "suggestion": "Try rephrasing your question"
}
```

### GET /api/instructors

**Response**:

```json
[{ "instructor_name": "John Doe" }, { "instructor_name": "Jane Smith" }]
```

## ETL Process

### Data Pipeline Flow

![Data Pipeline Flow Diagram](./images/Data%20Pipeline%20Flow.png)

### Column Mapping Logic

The ETL script uses flexible column mapping to handle various Excel formats:

```javascript
const COLS = {
  topic: ["Topic Code", "Topic code", "Topic", "Type Code"],
  type: ["Type", "Session Type"],
  domain: ["Domain"],
  class: ["Class"],
  instructor: ["Instructor", "Instructor Name"],
  sessionDate: ["Session Date", "Date"],
  average: ["Average", "Overall Average", "Rating"],
  responses: ["No of Student Responses", "Responses"],
  attended: ["No of Students Attended", "Attended"],
  ratedPct: ["% Rated", "Rated %", "Percent Rated"],
};
```

### Date Handling

Multiple date format support:

- Excel serial numbers (e.g., 44927)
- Formatted strings ("January 4, 2025")
- Standard formats ("2025-01-04")
- JavaScript Date objects

### PST Timezone Calculations

```javascript
// Calendar fields calculation
const [y, m, d] = pstDate.split("-").map(Number);
const q = Math.floor((m - 1) / 3) + 1; // Quarter calculation
const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;

// UTC timestamp for 09:00 PST
make_timestamptz(year, month, day, 9, 0, 0, "America/Los_Angeles");
```

## Frontend Implementation

### Technology Stack

- **HTML5**: Semantic structure
- **Tailwind CSS**: Utility-first styling
- **Vanilla JavaScript**: No framework dependencies
- **Responsive Design**: Mobile-first approach

## Configuration

### Environment Variables

```bash
# Database Configuration
NEON_DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# AI Configuration
GROQ_API_KEY=your_groq_api_key_here

# Server Configuration (optional)
PORT=3001
```

### System Prompt Configuration

The AI system prompt includes:

- Database schema definition
- Query patterns and examples
- Output format specifications
- Best practices for PostgreSQL

## Deployment

### Vercel Deployment

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run ETL (optional)
node etl/load_excel.mjs --file=path/to/your/data.xlsx

# Start development server
npm start
```

## Usage Examples

### Performance Analysis Queries

1. **Instructor Ranking**:

   ```
   "Show top 5 instructors by weighted average rating in Q1 2025 with minimum 10 sessions"
   ```

2. **Trend Analysis**:

   ```
   "Compare average ratings month-over-month for Q1 2025"
   ```

3. **Domain Comparison**:
   ```
   "Which domain had better student engagement in Q2 2025?"
   ```

### Advanced Analytics

1. **Consistency Analysis**:

   ```
   "Find the most consistent instructor in each domain for 2025"
   ```

2. **Multi-domain Instructors**:

   ```
   "List instructors who teach multiple domains with overall rating above 4.4"
   ```

3. **Session Type Analysis**:
   ```
   "Compare 'Live Class' vs 'Test Review Session' effectiveness in Q1 2025"
   ```

## Troubleshooting

### Common Issues

1. **SQL Generation Failures**:

   - **Symptom**: "Generated SQL query is invalid"
   - **Solution**: Rephrase question more specifically
   - **Debug**: Check generated SQL in browser console

2. **Database Connection Issues**:

   - **Symptom**: "Database execution error"
   - **Solution**: Verify `NEON_DATABASE_URL` configuration
   - **Debug**: Check server logs for connection details

3. **AI API Failures**:
   - **Symptom**: "AI service temporarily unavailable"
   - **Solution**: Wait and retry, check Groq API status
   - **Debug**: Verify `GROQ_API_KEY` is valid

### Performance Optimization

1. **Query Optimization**:

   - Use specific date ranges
   - Limit result sets with HAVING clauses
   - Utilize indexed columns (pst_year, pst_quarter, pst_month)

2. **Database Indexing**:

   ```sql
   CREATE INDEX idx_fact_session_time ON fact_session (pst_year, pst_quarter, pst_month);
   CREATE INDEX idx_fact_session_instr ON fact_session (instructor_id);
   ```

3. **Connection Pooling**:
   - Default pool size: 10 connections
   - Automatic connection release
   - SSL optimization for cloud databases

### Monitoring and Logging

The application includes comprehensive logging:

- Request/response logging
- SQL execution timing
- AI API interaction logs
- Error tracking with stack traces

**Log Levels**:

- `[INFO]`: Normal operations
- `[DEBUG]`: Detailed execution flow
- `[ERROR]`: Errors and exceptions
