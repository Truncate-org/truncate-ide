# Truncate: Use Cases & User Narratives

## 🎯 Overview
Truncate is an **AI-Powered Data Audit & Exploration Workspace**. Built on a high-performance Rust core (Tauri), it provides data engineers and analysts with surgical precision for profiling, auditing, and cleaning datasets locally. By integrating local LLMs (Ollama) directly into the database workflow, Truncate ensures your sensitive data never leaves your machine.

---

## 🛠 Key Use Cases

### 1. Surgical Data Profiling
*   **Health Checks:** Automatically calculate row counts, null percentages, distinct values, and duplicate records for any table.
*   **Outlier Detection:** Instantly identify statistical outliers (Z > 3) in numerical columns to spot data entry errors or anomalies.
*   **Schema Inference:** Understand your data types and distributions without writing complex SQL aggregation queries.

### 2. AI-Driven Cleaning Strategies
*   **Local AI Audit:** Generate data cleaning strategies based on table profiles. Ask the local AI (via Ollama) how to handle nulls or resolve duplicates specific to your data distribution.
*   **Privacy-First Intelligence:** Get expert-level data advice without uploading your schema or sample data to cloud-based LLMs.
*   **Contextual Suggestions:** Receive SQL transformation ideas and data quality improvement steps tailored to your specific column profiles.

### 3. Integrated Database Exploration
*   **Universal Explorer:** Navigate your database schemas and tables through a clean, unified sidebar.
*   **Result Set Visualization:** View and interact with your data in high-performance tables designed for large result sets.
*   **Unified Workspace:** Switch between terminal-based commands, database exploration, and AI assistance in one cohesive interface.

---

## 📖 A Day in the Life: User Story

**The User:** *Marcus, a Data Quality Lead at a HealthTech firm.*

**The Scenario:** Marcus is tasked with auditing a patient record dataset before a migration. The data contains PII (Personally Identifiable Information) and cannot be uploaded to any cloud service for analysis.

1.  **Connection & Discovery:** Marcus opens **Truncate** and connects to his local staging database. He navigates the schema in the **Database Explorer** and selects the `patient_records` table.
2.  **Surgical Audit:** He clicks **RUN** in the **Data Audit Panel**. Within seconds, Truncate generates a full profile showing a 15% null rate in the `blood_type` column and identifies 42 duplicate patient entries.
3.  **Local AI Insight:** Concerned about the nulls, Marcus clicks **"Ask AI for Cleaning Strategy"**. Truncate sends the JSON profile to a local *Llama 3* instance. 
4.  **The Strategy:** The AI suggests a multi-step cleaning process: "Impute missing blood types using historical lab results from Table X" and provides a SQL snippet to deduplicate records based on a composite key of `last_name` and `dob`.
5.  **Conclusion:** Marcus completes the audit and has a clear migration strategy, all while ensuring the patient data stayed 100% private and on-premise.

---

## 👥 Who is Truncate For?

| Role | Why They Use Truncate |
| :--- | :--- |
| **Data Quality Engineers** | To perform rapid audits and health checks on new datasets. |
| **Database Administrators** | To monitor table health and identify outliers or duplicates quickly. |
| **Data Analysts** | For local AI assistance in generating complex SQL and cleaning logic. |
| **Compliance Officers** | To ensure data analysis and AI interaction happens in a secure, local environment. |
| **Backend Developers** | For a unified workspace that combines a database client, terminal, and AI assistant. |

---

## 🚀 Getting Started
Ready to audit your data? 
1. **Connect**: Link your database in the Connection Panel.
2. **Profile**: Select a table and run the **Data Audit** to see its health profile.
3. **Analyze**: Use the **AI Assistant** to generate strategies and SQL based on your data.
