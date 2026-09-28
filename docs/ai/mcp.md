# Model Context Protocol (MCP) in JSango

JSango provides native support for the Model Context Protocol (MCP), allowing you to expose JSango tools as standard MCP servers or consume tools from remote MCP servers.

---

## Exposing JSango Tools as an MCP Server

You can mount your JSango tools into an MCP JSON-RPC server with one call:

```typescript
import { McpServer, tool } from 'jsango';
import { object, string } from '@jsango/validation';

const findUser = tool({
  name: 'find_user',
  description: 'Lookup user by email address',
  schema: object({ email: string() }),
  execute: async ({ email }) => {
    return await User.where('email', email).first();
  },
});

const server = new McpServer({
  name: 'JSango Enterprise MCP',
  version: '1.0.0',
});

server.registerTool(findUser);

// Handle JSON-RPC message
const response = await server.handleMessage({
  jsonrpc: '2.0',
  id: '1',
  method: 'tools/call',
  params: {
    name: 'find_user',
    arguments: { email: 'alex@example.com' },
  },
});
```

---

## Consuming Remote MCP Tools in JSango Agents

Use `McpClient` to discover and connect tools from external MCP providers into your agent:

```typescript
import { McpClient, agent } from 'jsango';

const client = new McpClient({
  baseUrl: 'https://mcp.internal.company.com',
});

const remoteTools = await client.discoverTools();

const agentInstance = agent({
  name: 'Orchestrator',
  instructions: 'Use remote MCP tools to fulfill tasks.',
  tools: remoteTools,
});
```
