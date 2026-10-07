import {
  createApp,
  model,
  fields,
  agent,
  tool,
  OllamaProvider,
  OpenRouterProvider,
  OpenAiProvider,
  schema,
  string,
  number,
  email,
  validate,
  events,
  jobs,
  DatabaseManager,
  setDatabaseManager,
  response,
  AdminPage,
} from 'jsango';

// ============================================================================
// 1. DATABASE & MODELS (Zero-Config In-Memory SQLite / DB)
// ============================================================================

// Initialize in-memory database (no PostgreSQL / MySQL setup required to test!)
const dbManager = new DatabaseManager({
  default: 'default',
  connections: {
    default: {
      driver: 'memory',
    },
  },
});
setDatabaseManager(dbManager);

// Create the products table in the in-memory database
const db = await dbManager.connection('default');
await db.query(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 10,
    created_at DATETIME,
    updated_at DATETIME
  )
`);

// Define Product Model
export const Product = model({
  name: 'Product',
  table: 'products',
  fields: {
    id: fields.id(),
    name: fields.string(),
    category: fields.string(),
    price: fields.float(),
    stock: fields.integer({ defaultValue: 10 }),
  },
  timestamps: true,
});

// Seed sample products
await Product.create({ name: 'MacBook Pro M3', category: 'Laptops', price: 1999.0, stock: 5 });
await Product.create({ name: 'Sony WH-1000XM5', category: 'Audio', price: 349.99, stock: 15 });
await Product.create({ name: 'Keychron Q1 Pro', category: 'Keyboards', price: 199.5, stock: 8 });

// ============================================================================
// 2. EVENTS & BACKGROUND JOBS
// ============================================================================

// Event listener: triggers whenever an order is placed
events.on<{ orderId: string; userEmail: string; amount: number }>('order.created', async (data) => {
  console.log(`[Event] Order created: ${data.orderId} for ${data.userEmail} ($${data.amount})`);
  // Dispatch a background job to send the confirmation email
  await jobs.dispatch('send-confirmation-email', data);
});

// Job worker: processes background task
jobs.register<{ orderId: string; userEmail: string }>('send-confirmation-email', (job) => {
  console.log(`[Job Worker] Sending receipt email to: ${job.userEmail} for Order #${job.orderId}`);
});

// ============================================================================
// 3. AI AGENT & TOOLS
// ============================================================================

// Tool 1: Real-time inventory check from database
export const checkInventory = tool({
  name: 'checkInventory',
  description: 'Checks stock and price of a product by name in database',
  schema: {
    productName: string(),
  },
  execute: async ({ productName }: { productName: string }) => {
    console.log(`[Tool] 🔍 checkInventory invoked with productName: "${productName}"`);
    const item = await Product.where('name', 'LIKE', `%${productName}%`).first();
    if (!item) {
      return { found: false, message: `Product '${productName}' is not in stock.` };
    }
    const result = {
      found: true,
      name: item.get('name'),
      price: item.get('price'),
      stock: item.get('stock'),
    };
    console.log(`[Tool] 🔍 checkInventory result:`, result);
    return result;
  },
});

// Tool 2: Calculates special discount promo
export const calculateDiscount = tool({
  name: 'calculateDiscount',
  description: 'Calculates the discounted price given the original price and discount percentage',
  schema: {
    price: number(),
    discountPercent: number(),
  },
  execute: ({ price, discountPercent }: { price: number; discountPercent: number }) => {
    console.log(`[Tool] 💰 calculateDiscount invoked: price=$${price}, discount=${discountPercent}%`);
    const discountedPrice = price * (1 - discountPercent / 100);
    const result = {
      originalPrice: price,
      discountPercent,
      finalPrice: Number(discountedPrice.toFixed(2)),
    };
    console.log(`[Tool] 💰 calculateDiscount result:`, result);
    return result;
  },
});

// Provider selection helper:
// 1. If OPENROUTER_API_KEY is present -> uses OpenRouter
// 2. If OPENAI_API_KEY is present -> uses OpenAI
// 3. Otherwise -> uses local Ollama (auto-normalizes baseUrl: 'http://localhost:11434' to '/v1')
function selectProvider() {
  if (process.env.OPENROUTER_API_KEY) {
    console.log('[AI] Using OpenRouter Provider');
    return new OpenRouterProvider({
      apiKey: process.env.OPENROUTER_API_KEY,
      siteName: 'JSango Basic AI App',
      defaultModel: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat',
    });
  }

  if (process.env.OPENAI_API_KEY) {
    console.log('[AI] Using OpenAI Provider');
    return new OpenAiProvider({
      apiKey: process.env.OPENAI_API_KEY,
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
  }

  const model = process.env.OLLAMA_MODEL || 'gemma4:31b-cloud';
  const url = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  console.log(`[AI] Using local Ollama Provider (${url}) with model: ${model}`);
  return new OllamaProvider({
    baseUrl: url,
    defaultModel: model,
  });
}

// Define the autonomous AI Agent
export const storeAgent = agent({
  name: 'Shubh',
  instructions: `You are an intelligent e-commerce shopping assistant named Shubh.
When a user asks about product availability, stock, or price, you MUST call the 'checkInventory' tool.
When a user asks for a discount or promo, you MUST call the 'calculateDiscount' tool.
Always answer using the exact real-time data returned by the tools.`,
  tools: {
    checkInventory,
    calculateDiscount,
  },
  onEvent: (event) => {
    if (event.type === 'tool.started') {
      console.log(`[Agent: Shubh] 🛠️ Executing tool '${event.data.toolName}' with:`, event.data.input);
    }
    if (event.type === 'tool.completed') {
      console.log(`[Agent: Shubh] ✅ Tool '${event.data.toolName}' finished successfully`);
    }
    if (event.type === 'tool.failed') {
      console.log(`[Agent: Shubh] ❌ Tool '${event.data.toolName}' failed:`, event.data.error);
    }
  },
  provider: selectProvider(),
});



export const storeAgent2 = agent({
  name: 'Shubh',
  instructions: `You are an intelligent e-commerce shopping assistant named Shubh.
When a user asks about product availability, stock, or price, you MUST call the 'checkInventory' tool.
When a user asks for a discount or promo, you MUST call the 'calculateDiscount' tool.
Always answer using the exact real-time data returned by the tools.`,
  tools: {
    checkInventory,
    calculateDiscount,
  },
  onEvent: (event) => {
    if (event.type === 'tool.started') {
      console.log(`[Agent: Shubh] 🛠️ Executing tool '${event.data.toolName}' with:`, event.data.input);
    }
    if (event.type === 'tool.completed') {
      console.log(`[Agent: Shubh] ✅ Tool '${event.data.toolName}' finished successfully`);
    }
    if (event.type === 'tool.failed') {
      console.log(`[Agent: Shubh] ❌ Tool '${event.data.toolName}' failed:`, event.data.error);
    }
  },
  provider: selectProvider(),
});


// let pp = workflow("something")
//   .step("Step1", storeAgent)
//   .step("Step2", storeAgent2);



// ============================================================================
// 4. JSANGO APPLICATION SETUP
// ============================================================================

export function createApplication() {
  const app = createApp();

  // Root welcome endpoint
  app.get('/', () => ({
    message: 'Welcome to JSango All-in-One AI App!',
    endpoints: {
      docs: '/docs',
      admin: '/admin',
      productsApi: '/api/products',
      aiChat: '/api/agent/chat',
      orderCheckout: '/api/checkout',
    },
    version: '1.0.0',
  }));

  // app.get("/testingflow", async (ctx: any) => {
  //   return await pp.run("do you have macbook pro?");
  // });
  // Automatic CRUD Endpoints for Products:
  // - GET    /api/products       (list with search & pagination)
  // - POST   /api/products       (create)
  // - GET    /api/products/:id   (detail)
  // - PUT    /api/products/:id   (update)
  // - DELETE /api/products/:id   (delete)
  app.crud('/api/products', Product);

  // Mount AI Agent directly as an HTTP endpoint:
  // - POST /api/agent/chat  -> Body: { "input": "Do you have MacBook?" }
  // - GET  /api/agent/chat?input=... -> Plain or SSE streaming with ?stream=true
  app.agent('/api/agent/chat', storeAgent);

  // Checkout Route with Schema Validation & Event Triggering
  const CheckoutSchema = schema({
    userEmail: email(),
    productName: string().min(2),
    quantity: number().int().min(1),
  });

  app.post('/api/checkout', validate(CheckoutSchema), async (ctx: any) => {
    const data = ctx.state.get('validatedBody') as {
      userEmail: string;
      productName: string;
      quantity: number;
    };

    const item = await Product.where('name', 'LIKE', `%${data.productName}%`).first();
    if (!item) {
      return response.notFound('Product not found');
    }

    const currentStock = (item.get('stock') as number) || 0;
    if (currentStock < data.quantity) {
      return response.badRequest('Insufficient stock');
    }

    // Decrement stock and save
    item.set('stock', currentStock - data.quantity);
    await item.save();

    const totalAmount = (item.get('price') as number) * data.quantity;
    const orderId = `ord_${Date.now()}`;

    // Emit event -> Triggers confirmation email job asynchronously
    await events.emit('order.created', {
      orderId,
      userEmail: data.userEmail,
      amount: totalAmount,
    });

    return response.created({
      message: 'Order placed successfully!',
      orderId,
      totalAmount,
      remainingStock: currentStock - data.quantity,
    });
  });

  // Built-in React Admin UI (Available at /admin)
  app.admin({
    path: '/admin',
    title: 'Admin',
    brandSubtitle: "Secure application",
    logoUrl: "https://flutterbuddy1.github.io/jsango/images/logo.png",
    resources: [Product],
    credentials: {
      email: "admin@admin.com",
      password: "123456"
    },
    pages: [
      new AdminPage({
        id: "chat",
        path: "/chat",
        label: "Chat",
        description: "Chat with our AI assistant",
        permission: "auth.user.view",
        navigationIcon: `chat`
      })
    ]
  });

  // Built-in Interactive OpenAPI / Swagger UI (Available at /docs)
  app.openapi({
    title: 'JSango AI Store API',
    version: '1.0.0',
    description: 'Complete API with integrated AI Agents, CRUD, and Admin Console',
  });

  return app;
}

// ============================================================================
// 5. BOOTSTRAP & SERVER START
// ============================================================================

// Run server when launched directly
if (process.env.NODE_ENV !== 'test') {
  const app = createApplication();

  // Use PORT env or default to 3001 (avoids collision with port 3000)
  const port = Number(process.env.PORT) || 3001;
  const host = process.env.HOST || '127.0.0.1';

  await app.listen(port, host);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║             ⚡ JSANGO SINGLE-FILE AI APPLICATION               ║
╠════════════════════════════════════════════════════════════════╣
║  • Server:        http://${host}:${port}                       
║  • Interactive Docs: http://${host}:${port}/docs               
║  • Admin UI:      http://${host}:${port}/admin                 
║  • Products CRUD: http://${host}:${port}/api/products          
║  • AI Agent Chat: http://${host}:${port}/api/agent/chat        
║  • Checkout API:  http://${host}:${port}/api/checkout          
╚════════════════════════════════════════════════════════════════╝
`);
}
