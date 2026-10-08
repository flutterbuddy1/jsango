# JSango AI Architecture & Runtime

## Executive Summary

Phase 20 introduces a first-class AI development platform, Agent runtime, and Workflow Orchestration engine directly into JSango.

The AI runtime is built on the core principle: **"Powerful Internally, Simple Externally."**

---

## 1. Architectural Layers

```
                     JSANGO APPLICATION
                             │
     ┌───────────────────────┼────────────────────────┐
     │                       │                        │
    API                  REALTIME                     AI
     │                       │                        │
   HTTP                  WebSocket                  Agents
   Router                Streaming                  Tools
   ORM                    Events                    Memory
   Auth                                              RAG
   Admin                                           Workflows
                                                     MCP
                                                    Evals
                                                      │
                                                      ↓
                                                AI RUNTIME
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       │                              │                              │
                MODEL ROUTER                     TOOL RUNTIME                  STORAGE ADAPTERS
                       │                              │                              │
         ┌─────────────┼─────────────┐        ┌───────┼───────┐               ┌──────┴──────┐
         ↓             ↓             ↓        ↓       ↓       ↓               ↓             ↓
      OpenAI       Anthropic      Gemini   Schemas  Auth   Audit          Database        Memory/
      Ollama         Fake          ...     Validation (RBAC)  Log          (PGVector)       Cache
```

---

## 2. Key Subsystems

### 2.1 Provider Abstraction & Model Router

- **Provider Neutrality**: Universal `ILlmProvider` contract with standardized request/response/stream protocols.
- **Dynamic Fallbacks**: Automatic fallback chains (`openai:gpt-4o` -> `anthropic:claude-3-5-sonnet` -> `gemini:1.5-flash`) handling rate limits, timeouts, and provider downtime with exponential backoff.
- **Deterministic Fake Provider**: Zero-cost offline test fixture provider (`FakeLlmProvider`) for CI and local unit testing.

### 2.2 Agent Runtime

- **Autonomous Step Loop**: Dynamic multi-turn reasoning with tool invocation, side-effect isolation, and final answer reflection.
- **Human-in-the-Loop**: Tools flagged with `requiresApproval: true` suspend execution safely, issue approval IDs, and resume upon authorization.
- **Transport Flexibility**: Native HTTP endpoint mounting (`app.agent('/support', agent)`) and bi-directional WebSocket streaming (`app.wsAgent('/chat', agent)`).

### 2.3 Tools & Automatic Schema Generation

- **Single Source of Truth**: Uses `@jsango/validation` schemas to simultaneously provide runtime argument validation, LLM JSON Schema generation, OpenAPI documentation, and TypeScript types.
- **Permission Boundaries**: Enforces RBAC checks before tool execution. AI can never bypass application authentication.

### 2.4 Workflow Orchestrator

- Supports **Sequential** (`.step()`), **Parallel** (`.parallel()`), **Conditional Branching** (`.branch()`), and **Bounded Loops** (`.loop()`).
- Immutable state checkpoints across workflow steps.

### 2.5 RAG & Knowledge Engine

- Recursive text chunking with sliding window overlap.
- Embedding generation with cosine similarity search.
- In-memory store for instant tests and extensible PGVector adapter for production datasets.

### 2.6 Model Context Protocol (MCP)

- Exposes JSango tools as standard MCP JSON-RPC tool endpoints.
- Consumes external MCP tools and transparently maps them to native JSango `ToolDefinition`s.
