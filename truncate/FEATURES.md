# Truncate: Feature Architecture & Roadmap

This document outlines the current capabilities of Truncate and proposes high-impact future features designed to elevate it into a premier, enterprise-grade Data Audit & Exploration platform.

---

## ⚡ Current Core Features

### 1. Local AI Intelligence (Ollama Engine)
*   **Zero-Network AI:** Deep integration with local LLMs (Llama 3, Qwen) via a managed sidecar process.
*   **Privacy Guarantee:** Analyze schemas and data profiles without sending a single byte to external APIs like OpenAI or Anthropic.

### 2. Surgical Data Profiling
*   **Instant Health Diagnostics:** Automatically calculate row counts, null percentages, distinct values, and duplicate records.
*   **Statistical Outlier Detection:** Utilizes Z-score analysis to instantly flag anomalous data points in numerical columns.
*   **Intelligent Schema Inference:** Infers data types and distributions beyond basic SQL schema definitions.

### 3. AI-Driven Cleaning Strategies
*   **Context-Aware Advice:** Sends generated JSON profiles to the local AI to receive bespoke data cleaning methodologies.
*   **SQL Strategy Generation:** AI generates the necessary SQL snippets (e.g., deduplication queries, imputation scripts) to resolve identified issues.

### 4. Integrated Database Workspace
*   **Universal Database Explorer:** A clean, hierarchical sidebar for navigating schemas, tables, and views across connections.
*   **High-Performance Result Sets:** Render massive datasets smoothly using virtualization and optimized rendering techniques.
*   **Embedded Terminal:** A low-latency `xterm.js` terminal directly within the IDE for running migrations, scripts, or Docker commands without switching contexts.

### 5. AST Query Safety Layer (Phase 0 Hardening)
*   **Pre-execution Validation:** A fundamental differentiator against tools like DBeaver. Every query passes through an Abstract Syntax Tree (AST) parser to classify intent (Read vs. Mutating) before execution.
*   **Destruction Guardrails:** Blocks dangerous queries (e.g., `DROP TABLE`, `UPDATE` without `WHERE`) by default, requiring explicit user override.

### 6. High-Performance Architecture
*   **Rust/Tauri Core:** Minimal memory footprint, native performance, and sub-second startup times compared to Electron-based apps.

---

## 🚀 Proposed Future Features (Roadmap)

To provide unmatched value to data engineers and analysts, the following features are recommended for future development. These align with Truncate's core philosophy: **Local, Fast, and Tactical.**

### Phase 1: Data Portability & Safe Automation

*   **Historical Data Snapshots ("Git for Data")**
    *   **The Concept:** The foundational safety net for all automated data remediation. Before any destructive action (UPDATE, DELETE, DROP) is taken, Truncate takes a lightweight, instantaneous snapshot of the targeted table state.
    *   **Implementation Details:** Leverages highly optimized, native database operations (e.g., `CREATE TABLE ... AS SELECT` in Postgres/SQLite or transactional wrappers) managed entirely by the Rust backend to avoid reinventing delta-log engines. 
    *   **User Value:** Provides engineers with a 1-click rollback button, allowing them to experiment with complex AI-suggested cleaning strategies with zero fear of permanent data loss.

*   **Natural Language to SQL (NL2SQL) with Intent Classification**
    *   **The Concept:** Allows non-technical analysts and busy engineers to query databases using conversational English (e.g., *"Show me patients missing blood types who were admitted last week"*).
    *   **Safety via AST:** Unlike basic LLM wrappers, Truncate passes the AI-generated SQL through an Abstract Syntax Tree (AST) parser *before* execution. The parser classifies the intent and guarantees that NL2SQL commands are strictly read-only (`SELECT`). Any mutating intent is hard-blocked and requires explicit user override.

*   **Automated PII Detection & Masking**
    *   **Dual-Layer Architecture:** Employs a robust, two-tiered detection system. It first uses a blazing-fast, Rust-based regex engine to identify standard PII (SSNs, credit cards, standard emails). It then uses local Ollama Named Entity Recognition (NER) models to sample and classify ambiguous text columns (e.g., detecting names within a "Notes" column).
    *   **Air-Gap Ready:** Because the fallback is rules-based, the feature remains fully functional even in strict air-gapped or GPU-less environments.
    *   **1-Click Obfuscation:** Provides users with instant options to hash, redact, or shuffle sensitive columns before exporting data to CSV or migrating it to less secure environments.

*   **Cross-Database Migrations**
    *   **The Concept:** A day-one requirement for enterprise workflows, allowing users to seamlessly move cleaned, audited data between different database engines.
    *   **Workflow:** Users can drag a fully audited table from a local staging database (e.g., SQLite) and drop it into a remote production database (e.g., PostgreSQL). Truncate automatically handles the schema translation, type casting, and bulk-insert optimizations under the hood.

### Phase 2: Actionable AI & Visual Auditing

*   **One-Click Auto-Remediation**
    *   **The Workflow:** Strictly gated behind Phase 1 Snapshots and AST Guardrails. When the Data Audit Panel flags an issue (e.g., 500 duplicate records), the local AI drafts the precise `DELETE` or `UPDATE` SQL transaction required to resolve it.
    *   **Safe Execution:** The user is presented with a diff-style preview of the affected rows. Upon clicking "Execute," Truncate automatically triggers a snapshot, runs the transaction, and verifies the new data profile.

*   **Interactive ER Diagram Generator**
    *   **Visual Exploration:** Automatically parses schemas, primary keys, and foreign key constraints to generate an interactive, visual map of the database.
    *   **User Experience:** Features a drag-and-drop canvas where users can visually explore table relationships, understand complex joins, and export high-resolution diagrams (PDF/PNG) for team documentation.

*   **Visual Data Distributions**
    *   **Inline Analytics:** Moves beyond raw text statistics. Embeds micro-charts (histograms, box plots, and sparklines) directly into the Data Audit grid.
    *   **Instant Outlier Detection:** Allows users to visually spot skewed distributions or statistical outliers (Z > 3) at a glance, dramatically accelerating the data profiling process.

### Phase 3: Enterprise & Workflow Integration

*   **Audit Threshold Alerts**
    *   **Proactive Monitoring:** Allows data quality teams to define strict baselines and rules (e.g., "Alert me if the null percentage in `user_email` exceeds 2%").
    *   **Automated Checks:** Truncate can run these profiles as scheduled background tasks against production replicas, visually flagging degraded tables on the dashboard before downstream systems are affected.

*   **Vector Search & RAG Generation**
    *   **Local Embeddings:** Empowers users to generate vector embeddings for their text data using local Ollama models directly within the IDE.
    *   **Semantic SQL:** Bridges the gap between traditional relational data and AI. Allows users to perform semantic searches (e.g., finding conceptually similar records) using standard SQL interfaces enhanced with vector similarity functions.

*   **Team Collaboration & Audit Logs**
    *   **Immutable Logging:** Automatically records every query executed, the AI strategies generated, and the data remediation steps taken.
    *   **Compliance Ready:** Provides one-click exports of audit logs in SOC2 and HIPAA-compliant formats, satisfying strict enterprise requirements for tracking data modifications.

---

## 🎯 Value Proposition for Customers
By implementing these future features, Truncate transitions from a **Diagnostic Tool** to a **Complete Remediation Platform**. Customers will not only find the problems in their data but will be able to fix them instantly, securely, and visually, all without ever writing manual boilerplate SQL or compromising data privacy.
