# ADR-AI-001: First-Class AI Runtime Architecture

## Status

Accepted

## Context

Modern backend applications increasingly require native LLM inference, autonomous agents, tool orchestration, RAG, and real-time streaming to frontends. Existing approaches often force developers to bolt on heavy, disjointed external agent frameworks that duplicate HTTP routing, validation, authentication, and database logic.

## Decision

JSango integrates AI as a first-class citizen directly into its core lifecycle without introducing separate, incompatible architectures:

1. **Package Architecture**: `@jsango/ai` provides internal modular implementations for providers, agents, tools, memory, RAG, workflows, MCP, and evals.
2. **Facade Re-exports**: Public AI primitives (`ai`, `agent`, `tool`, `workflow`, `knowledge`, `memory`, `evaluate`, `mcp`) are exposed directly from `jsango`.
3. **Application Integration**: `app.agent('/path', agent)` and `app.wsAgent('/path', agent)` handle REST, SSE streaming, and WebSocket bi-directional communication automatically.
4. **Validation Unification**: JSango Validation schemas serve as the single source of truth for runtime validation, LLM function calling schemas, and OpenAPI documentation.
5. **Security**: All tool invocations execute strictly within the authenticated identity context (`ctx.user`), enforcing RBAC and human approval mechanisms (`requiresApproval: true`).

## Consequences

- **Positive**: Zero boilerplate to create production-grade AI agents and RAG pipelines.
- **Positive**: Provider neutrality (OpenAI, Anthropic, Gemini, Ollama, and Fake testing provider).
- **Positive**: Seamless integration with JSango ORM, WebSockets, Cache, Queues, and Admin.
- **Negative**: Adds new concepts (Agents, Workflows, Vector Stores), managed via strict progressive disclosure.
