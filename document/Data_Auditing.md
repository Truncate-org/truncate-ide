# Truncate Data Ingestion & Auditing Pipeline

A structured data workflow for ingestion, auditing, cleaning, and deployment.

## High-Level Architecture

1.  **File Upload**
2.  **Raw Staging**
3.  **Schema Detection**
4.  **Data Profiling (Audit Engine)**
5.  **AI Insight Layer**
6.  **Manual Review Layer**
7.  **Clean Transformation Layer**
8.  **Load to Target Database**
9.  **Audit Report Storage**

---

## Phase 1: Feed File (Ingestion Layer)

### Step 1: Upload
User uploads supported formats:
*   **CSV**
*   **TSV**
*   **Excel** (optional later)
*   **JSON** (future)

**Storage:** Files are stored temporarily in `~/AppData/Truncate/staging/`.
> **Note:** Do NOT directly insert into the production database.

---

## Phase 2: Raw Staging Layer

1.  Create an internal temporary SQLite database: `truncate_staging.db`.
2.  Load the raw file into a table named `staging_table_<timestamp>`.
3.  **Type Handling:** Do NOT enforce strict types yet. Everything is initially stored as `TEXT`.

---

## Phase 3: Data Profiling Engine (Audit Engine)

Run automatic checks on the staging data.

### 1. Null Analysis
For each column, calculate:
*   Null count
*   Null percentage
*   Consecutive null blocks
*   **Output Example:** `Column: email | Nulls: 142 | Null %: 8.3% | Flag: Warning`

### 2. Datatype Inference
Detect patterns for:
*   Integer, Float, Decimal, Boolean
*   Date, Email, Phone
*   Categorical values vs. Free text
*   **Validation:** Check for inconsistent values, mixed types, or format violations.

### 3. Duplicate Detection
*   Exact row duplicates
*   Primary-key-like duplicates
*   Column-specific duplicates (e.g., email, ID)

### 4. Outlier Detection
For numeric columns, utilize:
*   Z-score detection
*   IQR (Interquartile Range) method
*   Extreme value and negative value detection

### 5. Constraint Suggestions
Auto-detect potential:
*   Primary key candidates
*   Foreign key candidates
*   Unique and Not-null candidates

---

## Phase 4: AI Insight Layer

The AI reads structured audit summary metadata, **not** the raw data.

**Input JSON to AI:**
```json
{
  "columns": [...],
  "null_summary": [...],
  "duplicates": [...],
  "outliers": [...]
}
```

**AI Outputs:**
*   Suggested cleaned schema
*   Recommended datatypes and constraints
*   Cleaning strategy and transformation SQL

---

## Phase 5: Manual Audit Panel

A dedicated UI for user intervention:
*   **Column Inspector:** Change datatype via dropdown.
*   **Cleaning Toggles:** Remove null rows, fill nulls, remove duplicates, normalize case, trim whitespace.
*   **Outlier Handling:** Options to remove, cap, or ignore.
*   **Rule:** Manual override always wins over AI suggestions.

---

## Phase 6: Transformation Pipeline

System generates a SQL transformation plan based on user/AI decisions.

**Example SQL:**
```sql
CREATE TABLE clean_users AS
SELECT DISTINCT
   CAST(age AS INTEGER) as age,
   TRIM(email) as email,
   ...
FROM staging_table
WHERE age IS NOT NULL;
```

Users can review, manually edit, and execute the SQL.

---

## Phase 7: Load to Target Database

User selects the deployment method:
*   **Replace table**
*   **Create new table**
*   **Append data**

Target databases: MySQL, PostgreSQL, SQLite.

---

## Phase 8: Store Audit Report

Save the following to `truncate_audit.db` for reproducibility:
*   Original file hash
*   Profiling results
*   Cleaning decisions
*   Final schema

---

## New File Workflow (Reusable Pipeline)

When a new file is uploaded:
1.  Detect if it matches a previous structure.
2.  Compare schemas.
3.  Auto-apply previous cleaning rules.
4.  Highlight differences and request user confirmation.

---

## AI Responsibilities

| AI Can | AI Must NOT |
| :--- | :--- |
| Recommend datatypes | Modify raw data silently |
| Suggest constraints & cleaning rules | Execute destructive operations |
| Explain anomalies | Guess unknown columns |
| Generate transformation SQL | |

---

## Enterprise-Ready Additions

*   **Versioned pipelines:** Track changes over time.
*   **Rollback capability:** Revert to previous states.
*   **Audit logs:** Record all cleaning actions.
*   **Immutable history:** Permanent record of data changes.
*   **Config Export:** Export pipeline configurations as JSON.

---

## UI Components

*   **File Upload Panel**
*   **Audit Summary Dashboard**
*   **Column Inspector Sidebar**
*   **Duplicate & Outlier Viewers**
*   **AI Suggestion Panel**
*   **SQL Transformation Preview**
*   **Final Deployment Confirmation**