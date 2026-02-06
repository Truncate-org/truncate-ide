# Phase 1: Foundations (Mandatory)

## 1. Define AI Role & Scope
**Write a strict system prompt:**
- AI is a database assistant, not a chatbot
- Forbidden to invent tables, columns, or data
- Must say “I don’t have enough information” when schema is insufficient
- Store this prompt centrally (backend, not frontend)

## 2. Select Local Model
**Choose model optimized for code/SQL:**
- Qwen2.5-Coder / SQLCoder / Llama 3 Instruct
- Decide quantization (4-bit / 8-bit) based on RAM
- Lock temperature (0.1–0.2)

# Phase 2: Local AI Runtime (Auto Start / Stop)

## 3. Bundle AI Runtime
- Bundle Ollama (or equivalent) binary with the app
- Do NOT bundle model weights

## 4. Auto-Start AI on App Launch
**On IDE startup:**
- Check if AI service is running
- If not, start it as a child process
- Block AI UI until service is ready
- Show “Local AI initializing…” state

## 5. Auto-Stop AI on App Exit
**On app close:**
- Gracefully terminate AI process
- Ensure no orphan background processes remain

# Phase 3: Schema-Aware Context Injection

## 6. Schema Collection Layer
**On every DB connect / switch:**
- Fetch tables, columns, types
- Cache schema snapshot
- Invalidate cache on:
    - CREATE / DROP / ALTER
    - Database switch
    - CSV import

## 7. Context Builder
**Before every AI call:**
- Inject DB type
- Active database name
- Tables + columns + types
- Reject AI calls if no active schema exists

# Phase 4: AI Request / Response Control

## 8. Strict Output Format
**Enforce JSON-only responses:**
- `intent`
- `sql` (optional)
- `explanation`
- `confidence`
- Discard responses that fail JSON parsing

## 9. Query Intent Routing
**Classify user input:**
- Explain schema
- Generate SQL
- Fix SQL
- Route to correct AI handler

# Phase 5: Validation & Hallucination Control

## 10. SQL Validation Engine
**Before showing or executing AI SQL:**
- Parse SQL
- Validate tables exist
- Validate columns exist
- Validate DB dialect
- Block invalid queries

## 11. Retry-on-Error Loop
**If validation fails:**
- Feed exact error back to AI
- Retry generation (max 2–3 attempts)
- If still invalid → show error, not AI guess

# Phase 6: IDE Integration

## 12. AI Panel UI
- Docked right panel (VS Code–style)
- Scrollable conversation
- Clear “Active DB” indicator
- Disabled state when no DB connected

## 13. Editor / Terminal Integration
**Allow:**
- “Explain this query”
- “Fix this query”
- “Generate query from question”
- Never auto-execute AI SQL
- Always require user confirmation

# Phase 7: Performance & Safety

## 14. Throttling & Limits
- Prevent multiple concurrent AI calls
- Cancel previous request if user edits input
- Timeout long responses

## 15. Safe Defaults
- Read-only mode by default
- Explicit confirmation for DELETE / DROP / UPDATE
- Clear warning messages

# Phase 8: Logging & Future Improvement

## 16. AI Interaction Logging (Local Only)
**Log:**
- Prompt
- Schema snapshot
- AI output
- Validation errors
- Store locally for debugging and tuning

## 17. Feedback Loop
- Flag hallucinated or rejected responses
- Use logs later for prompt refinement or LoRA fine-tuning

# Final Success Criteria
- [ ] AI starts automatically when IDE opens
- [ ] AI stops automatically when IDE closes
- [ ] AI never runs without schema context
- [ ] AI never invents database structures
- [ ] AI feels like a trusted local copilot, not a chatbot
- [ ] Zero cloud dependency