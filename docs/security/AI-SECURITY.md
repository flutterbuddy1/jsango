# JSango AI Security & Governance Policy

## 1. Principles of Secure AI Execution

1. **Identity & Authorization First**:
   AI agents and tool calls execute under the authenticated identity of the request context (`ctx.user`). An LLM is never given direct, unrestricted database access or administrative privileges.

2. **Tool Sandboxing & Side-Effect Isolation**:
   Tools with dangerous side-effects (e.g. `refundPayment`, `deleteRecord`, `sendEmail`) enforce `requiresApproval: true`. When invoked, execution pauses and requires explicit human verification via the Admin Console, API, or WebSocket.

3. **Input & Output Guardrails**:
   Every agent supports configurable input and output guardrails to prevent prompt injection, data exfiltration, and non-compliant model responses.

4. **Zero Key Exposure**:
   Provider API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) are managed through centralized configuration and environment isolation. Keys are never logged, sent in client telemetry, or serialized in error messages.

5. **Multi-Tenant Memory Isolation**:
   Memory keys are automatically partitioned by `tenantId:userId:conversationId`. Cross-tenant memory leakage is impossible by design.

---

## 2. Threat Model Matrix

| Threat Vector | Mitigation Strategy in JSango AI |
|---|---|
| **Prompt Injection** | Strict system instruction pinning, input filter guardrails, structured JSON Schema validation. |
| **Tool Injection / Abuse** | Tool arguments validated with `@jsango/validation`, permission checks (`permissions: [...]`), execution timeouts. |
| **Unintended Side-Effects** | Human-in-the-loop approval workflows (`requiresApproval: true`), idempotency keys. |
| **Cross-Tenant Data Leak** | Scoped memory isolation with composite tenant/user keys. |
| **Runaway Agent / Cost Spike** | Strict guardrails on `maxSteps` (default: 10), `maxTokens`, `maxCostUsd`, and `maxExecutionTimeMs`. |
| **Secret Exfiltration** | Sensitive prompt redaction in observability spans and audit logs. |
