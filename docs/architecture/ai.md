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
- **Custom providers in one function**: `provider(async ({ messages }) => text)`; OpenAI-compatible APIs work through `new OpenAiProvider({ baseUrl })`.
- **Streaming**: OpenAI, Anthropic and Gemini streams carry text, tool calls and token usage; a stream is read once.

### 2.2 Agent Runtime

- **Autonomous Step Loop**: Dynamic multi-turn reasoning with tool invocation, side-effect isolation, and final answer reflection.
- **Token streaming**: when a run has listeners (`agent.stream()`, SSE, voice), the model is streamed and every token is emitted as `message.delta`; stopping the stream cancels the run.
- **Token-efficient memory**: per tenant + user + conversation; old tool results are not re-sent, RAG context is not stored, history has a token budget, optional running summary (`history: { maxTokens, summarize }`).
- **Human-in-the-Loop**: Tools flagged with `requiresApproval: true` pause the run and return an approval id (resuming a paused run is not supported yet; see LIMITATIONS).
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

### 2.7 Voice Runtime

```
 transports                    VoiceSession (one per call)                       providers
 ──────────                    ───────────────────────────                       ─────────
 WebSocket (browser) ──┐       pipeline:  stt ─► agent.stream() ─► sentences ─► tts   any STT / LLM / TTS
 Twilio Media Streams ─┼─PCM16─►          (VAD / provider end-of-turn, barge-in)        stt(fn) / tts(fn)
 WebRTC (control only) ┘       realtime:  RealtimeAdapter (speech-to-speech)            OpenAI Realtime, Gemini Live
                                          same agent tools, permissions, memory, insights
```

- **One engine, any transport**: `VoiceSession` takes PCM16 at the transport's rate and resamples
  for each provider. The browser WebSocket, Twilio (μ-law 8 kHz) and tests are thin adapters
  around it.
- **Pipeline mode** works with the agent's own LLM provider. Tokens are cut into sentences and each
  sentence is synthesized while the LLM keeps writing, so the first audio comes after the first
  clause.
- **Barge-in** aborts the LLM and text-to-speech calls (`AbortSignal`), clears playback, and saves
  only the heard part of the reply to memory (`agent.remember()`), using per-sentence audio
  lengths.
- **Realtime mode** runs speech-to-speech adapters. Replies the caller interrupted are dropped,
  and their tool calls never run. Tools go through `agent.callTool()`, which applies the same
  permission and approval checks as `run()`.
- **WebRTC** (`app.webrtcAgent()`): the server creates the provider call with its key. Audio goes
  browser ↔ provider directly, and the session runs on a sideband control connection, with
  hang-up on the time limit.

### 2.8 AI Insights

- Agents and voice sessions report `run`, `call.started`, `turn`, `call.ended` and `call.recorded`
  records through `observeAi()`. Reporting costs nothing when no one listens.
- `createInsights()` / `app.aiInsights()` stores them in memory or SQL (`ai_runs`, `ai_calls`,
  `ai_turns`). It prices tokens and audio minutes from an app-supplied table, updates optional
  Prometheus metrics, applies retention, and answers `summary` / `series` / `runs` / `calls` /
  `call` queries.
- Admin integration (`aiWidgets()`, `aiAdminPage()`) uses ordinary dashboard widgets. Content
  (prompts, answers, transcripts, recordings) is opt-in.
