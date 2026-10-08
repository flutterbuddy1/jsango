# Model Context Protocol (MCP) in JSango

JSango can **expose** its tools as an MCP server (for Claude Desktop, Cursor and other MCP
clients) and **consume** tools from remote MCP servers in its agents.

---

## Exposing JSango Tools as an MCP Server

```typescript
import { McpServer, tool, createApp, HttpResponse, object, string } from 'jsango';

const findUser = tool({
  name: 'find_user',
  description: 'Lookup user by email address',
  schema: object({ email: string() }),
  execute: async ({ email }: { email: string }) => {
    return await User.where('email', email).first();
  },
});

const server = new McpServer({ name: 'acme-tools', version: '1.0.0' }).registerTool(findUser);

// Serve it over HTTP (MCP "Streamable HTTP" transport, JSON responses)
const app = createApp();
app.post('/mcp', async (ctx) => {
  const reply = await server.handleJsonRpc(await ctx.request.json());
  return reply ?? HttpResponse.noContent(); // notifications get no body
});
await app.listen(3000);
```

`handleJsonRpc` implements `initialize`, `ping`, `tools/list` and `tools/call`. If a tool
throws, the result has `isError: true` so the calling model can read the error. You can also call
it directly, without HTTP:

```typescript
const result = await server.handleJsonRpc({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'find_user', arguments: { email: 'alex@example.com' } },
});
```

Protect the endpoint like any other route, e.g. with your auth middleware.

### Local servers (stdio)

Desktop clients (Claude Code, Cursor, VS Code) start local MCP servers as a process and talk over
stdin/stdout. `serveStdio()` does that; pass `instructions` to tell the model how to use your tools:

```typescript
import { McpServer, tool, object, string } from 'jsango';

const server = new McpServer({
  name: 'acme-tools',
  version: '1.0.0',
  instructions: 'Use find_user before changing an account.',
}).registerTool(
  tool({
    name: 'find_user',
    description: 'Lookup user by email address',
    schema: object({ email: string() }),
    execute: async ({ email }: { email: string }) => ({ email }),
  })
);

await server.serveStdio(); // log to stderr: stdout carries the protocol
```

jsango itself ships one for AI coding agents: `npx jsango mcp` (see "Building with AI assistants").

---

## Consuming Remote MCP Tools in JSango Agents

`McpClient.connect()` performs the MCP handshake. `tools()` then returns the server's tools
as regular jsango tools:

```typescript
import { McpClient, agent } from 'jsango';

const remote = await McpClient.connect('https://mcp.internal.company.com/mcp', {
  headers: { Authorization: `Bearer ${process.env.MCP_TOKEN}` },
});

const orchestrator = agent({
  name: 'Orchestrator',
  instructions: 'Use remote MCP tools to fulfill tasks.',
  tools: await remote.tools(),
});

// or call a tool yourself
const text = await remote.callTool('find_user', { email: 'alex@example.com' });
```

The client speaks MCP over HTTP POST and accepts both JSON and SSE (`text/event-stream`)
responses, including the `Mcp-Session-Id` session header. The stdio transport (for local
command-line servers) isn't included.
