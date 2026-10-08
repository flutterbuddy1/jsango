# JSango Single-File AI Application Example

Ye example ek single file (`src/index.ts`) me JSango ke saare key features ko demonstrate karta hai:

- 🧠 **Autonomous AI Agent** (with real Database Inventory Tool & Discount Tool)
- 🦙 **Ollama & OpenRouter Integration** (Local offline Ollama by default, OpenRouter / OpenAI switchable via env)
- 📦 **In-Memory Database & Models** (Zero setup! No Postgres or MySQL required)
- ⚡ **Auto-Generated CRUD** (`app.crud('/api/products', Product)`)
- 🛡️ **Schema Validation** (`validate(schema({ ... }))`)
- 🔔 **Event Bus & Background Jobs** (`events.emit()` & `jobs.dispatch()`)
- 📊 **Built-in React Admin UI** (at `/admin`)
- 📖 **Interactive OpenAPI / Swagger Docs** (at `/docs`)

---

## Quick Start / Kaise Run Karein

> 💡 **Note**: Ye monorepo `pnpm` use karta hai. Always use `pnpm` instead of `npm`.

### 1. Build the project

Repo ke root directory se:

```bash
pnpm build
```

### 2. Start the application

```bash
# Is example directory me jaao:
cd examples/basic-ai-app

# Start the dev server (runs on Port 3001 by default):
pnpm dev
```

Agar custom port pe chalana ho:

```bash
PORT=4000 pnpm dev
```

---

## Endpoints

Server start hone ke baad browser ya curl se test karein:

| Endpoint                               | Method     | Description                                          |
| -------------------------------------- | ---------- | ---------------------------------------------------- |
| `http://localhost:3001/`               | GET        | Welcome message & API Directory                      |
| `http://localhost:3001/docs`           | GET        | Interactive Swagger UI API Docs                      |
| `http://localhost:3001/admin`          | GET        | React Admin Console                                  |
| `http://localhost:3001/api/products`   | GET/POST   | Auto-CRUD for products                               |
| `http://localhost:3001/api/checkout`   | POST       | Validated checkout endpoint (triggers events & jobs) |
| `http://localhost:3001/api/agent/chat` | POST / GET | AI Store Assistant (supports JSON & SSE streaming)   |

---

## AI Agent ko Test Karna

### POST request:

```bash
curl -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"input": "Do you have MacBook in stock?"}'
```

### Streaming (SSE):

```bash
curl "http://localhost:3001/api/agent/chat?input=Tell+me+about+the+Keychron+keyboard&stream=true"
```

---

## LLM Provider Configuration

Default me ye local Ollama (`http://localhost:11434`) use karta hai:

- Make sure Ollama is running (`ollama run llama3.2`)

Agar aap **OpenRouter** use karna chahte hain:

```bash
OPENROUTER_API_KEY="sk-or-your-key" pnpm dev
```

Agar aap **OpenAI** use karna chahte hain:

```bash
OPENAI_API_KEY="sk-your-key" pnpm dev
```
