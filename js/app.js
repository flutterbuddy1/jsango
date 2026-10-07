/**
 * JSango Landing Page - Interactive Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinksWrapper = document.getElementById('navLinksWrapper');
  const navLinks = document.querySelectorAll('#navLinks .nav-link, .mobile-nav-actions a');

  if (mobileToggle && navLinksWrapper) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navLinksWrapper.classList.toggle('open');
      mobileToggle.classList.toggle('open', isOpen);
      mobileToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close menu when clicking any nav link
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          navLinksWrapper.classList.remove('open');
          mobileToggle.classList.remove('open');
          mobileToggle.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024 && navLinksWrapper.classList.contains('open')) {
        if (!navLinksWrapper.contains(e.target) && !mobileToggle.contains(e.target)) {
          navLinksWrapper.classList.remove('open');
          mobileToggle.classList.remove('open');
          mobileToggle.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  // 2. Showcase Code Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const codePanes = document.querySelectorAll('.code-pane');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabButtons.forEach((b) => b.classList.remove('active'));
      codePanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`pane-${targetId}`);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // 3. Architecture Layer Explorer
  const archLayers = document.querySelectorAll('.arch-layer-item');
  const layerTitle = document.getElementById('archLayerTitle');
  const layerDesc = document.getElementById('archLayerDesc');
  const layerPkg = document.getElementById('archLayerPkg');
  const layerSnippet = document.getElementById('archLayerSnippet');

  const layerData = {
    runtime: {
      title: '1. Runtime Layer',
      pkg: '@jsango/runtime',
      desc: 'Abstracts platform differences between Node.js 20+ and modern JavaScript runtimes without coupling business logic to node APIs.',
      snippet: `import { createRuntimeAdapter, detectRuntime } from '@jsango/runtime';

// Picks the adapter for the current runtime (Node.js, Bun, ...)
export const runtime = createRuntimeAdapter();
console.log(detectRuntime(), runtime.getEnv('NODE_ENV'), runtime.cwd());`,
    },
    core: {
      title: '2. Core Lifecycle & DI',
      pkg: '@jsango/core & @jsango/container',
      desc: 'Application lifecycle management, structured error hierarchy, and ultra-fast dependency injection with transient, singleton, and scoped lifetimes.',
      snippet: `import { Container } from '@jsango/container';

class BillingService {
  processInvoice(id: string) { return { id, paid: true }; }
}

const container = new Container();
container.registerSingleton('billing', () => new BillingService());
container.resolve<BillingService>('billing').processInvoice('inv_1');`,
    },
    http: {
      title: '3. HTTP Abstraction',
      pkg: '@jsango/http',
      desc: 'Zero-allocation streaming request/response abstractions, cookie managers, header sanitization, and multipart streaming parsers.',
      snippet: `import { HttpResponse, type RequestContext } from '@jsango/http';

export async function handle(ctx: RequestContext) {
  const body = await ctx.request.json<{ name: string }>();
  return HttpResponse.json({ hello: body.name }, { headers: { 'X-Powered-By': 'JSango' } });
}`,
    },
    router: {
      title: '4. SegRadix Router',
      pkg: '@jsango/router',
      desc: 'Optimized Segment Radix Trie router delivering >7.7M lookups/sec with typed parameter constraints (:uuid, :int, :slug).',
      snippet: `import { Router } from '@jsango/router';

const router = new Router();
router.get('/api/users/:id', (ctx) => ({ id: ctx.request.params['id'] }), {
  constraints: { id: 'uuid' }, // also: number, slug, alpha, alphanumeric or a RegExp
});
const match = router.match('GET', '/api/users/0b0e3c6e-7a7d-4d6a-9a8e-1f2b3c4d5e6f');`,
    },
    middleware: {
      title: '5. Middleware Pipeline',
      pkg: '@jsango/middleware',
      desc: 'Onion-style asynchronous middleware pipeline supporting rate limiting, CORS, CSRF, security headers, and telemetry tracing.',
      snippet: `import { createApp } from 'jsango';

const app = createApp();
app.use(async (ctx, next) => {
  const start = performance.now();
  const response = await next();
  ctx.logger.info('request', { path: ctx.request.pathname, ms: performance.now() - start });
  return response;
});`,
    },
    orm: {
      title: '6. Declarative ORM & Migrations',
      pkg: '@jsango/orm & @jsango/migrations',
      desc: 'Batteries-included ORM with AST query compilation, batch eager loading (.with()), relationships, and auto-diffing migration runners.',
      snippet: `import { defineModel, fields } from 'jsango';

export const User = defineModel('User', {
  id: fields.id(),
  email: fields.string({ unique: true }),
}, {
  table: 'users',
  timestamps: true,
  relations: {
    orders: { type: 'hasMany', target: 'Order', foreignKey: 'userId' },
  },
});

// npx jsango makemigrations && npx jsango migrate`,
    },
    admin: {
      title: '7. Auto Admin Console',
      pkg: '@jsango/admin-server & @jsango/admin-ui',
      desc: 'React SPA and orchestrator generating full CRUD, filters, search, TOTP 2FA, session control, audit trails, and data export.',
      snippet: `import { AdminResource } from '@jsango/admin-core';

export const UserResource = new AdminResource({
  modelName: 'User',
  label: 'User Account',
  pluralLabel: 'User Accounts',
  searchFields: ['email', 'name'],
  listFields: ['id', 'email', 'createdAt'],
});

// app.admin({ resources: [UserResource] });`,
    },
    ai: {
      title: '8. AI Platform & Agent Runtime',
      pkg: '@jsango/ai',
      desc: 'Provider-neutral LLM runtime supporting OpenAI, Anthropic, Gemini, Ollama, autonomous reasoning agents, tool calling, RAG, and MCP.',
      snippet: `import { agent, tool, object, string, number, createApp } from 'jsango';

const refundOrder = tool({
  name: 'refundOrder',
  description: 'Process customer refund',
  schema: object({ orderId: string(), amount: number() }),
  requiresApproval: true,
  execute: async ({ orderId, amount }) => StripeService.refund(orderId, amount),
});

export const supportAgent = agent({
  name: 'SupportAgent',
  model: 'openai:gpt-4o',
  instructions: 'Help customers with orders and refunds.',
  tools: { refundOrder },
});

const app = createApp();
app.agent('/api/support', supportAgent);
app.wsAgent('/ws/support', supportAgent);`,
    },
  };

  // 3.1 Dynamic npm version loader
  async function fetchLiveVersion() {
    try {
      const res = await fetch('https://registry.npmjs.org/jsango/latest');
      if (res.ok) {
        const data = await res.json();
        if (data && data.version) {
          const vStr = `v${data.version}`;
          document.querySelectorAll('.jsango-version-badge').forEach((el) => {
            el.textContent = vStr;
          });
          const heroPill = document.getElementById('heroVersionText');
          if (heroPill) {
            heroPill.textContent = `JSango ${vStr} Production Release · Batteries-Included & AI Platform`;
          }
        }
      }
    } catch {
      // Fallback to static version if offline/network restricted
    }
  }
  fetchLiveVersion();

  archLayers.forEach((layer) => {
    layer.addEventListener('click', () => {
      const key = layer.getAttribute('data-layer');
      const data = layerData[key];
      if (!data) return;

      archLayers.forEach((l) => l.classList.remove('active'));
      layer.classList.add('active');

      if (layerTitle) layerTitle.textContent = data.title;
      if (layerDesc) layerDesc.textContent = data.desc;
      if (layerPkg) layerPkg.textContent = data.pkg;
      if (layerSnippet) layerSnippet.textContent = data.snippet;
    });
  });

  // 4. Package Directory Search & Filter
  const packageSearch = document.getElementById('packageSearch');
  const filterTags = document.querySelectorAll('.filter-tag');
  const packageCards = document.querySelectorAll('.pkg-card');

  let activeCategory = 'all';
  let searchTerm = '';

  function filterPackages() {
    packageCards.forEach((card) => {
      const name = (card.querySelector('.pkg-name')?.textContent || '').toLowerCase();
      const desc = (card.querySelector('.pkg-desc')?.textContent || '').toLowerCase();
      const cat = card.getAttribute('data-category') || '';

      const matchesSearch = name.includes(searchTerm) || desc.includes(searchTerm);
      const matchesCategory = activeCategory === 'all' || cat === activeCategory;

      if (matchesSearch && matchesCategory) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  if (packageSearch) {
    packageSearch.addEventListener('input', (e) => {
      searchTerm = e.target.value.toLowerCase().trim();
      filterPackages();
    });
  }

  filterTags.forEach((tag) => {
    tag.addEventListener('click', () => {
      filterTags.forEach((t) => t.classList.remove('active'));
      tag.classList.add('active');
      activeCategory = tag.getAttribute('data-filter') || 'all';
      filterPackages();
    });
  });

  // 5. Toast Notification & Copy to Clipboard
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');

  function showToast(message) {
    if (!toast) return;
    if (toastMessage) toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  const copyButtons = document.querySelectorAll('.copy-trigger');
  copyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Buttons inside a code box copy the rendered snippet; others carry data-copy.
      const codeBlock = btn.closest('.code-box')?.querySelector('pre');
      const textToCopy = btn.getAttribute('data-copy') || codeBlock?.innerText.trimEnd();
      if (!textToCopy) return;

      const done = () => {
        const label = btn.textContent.trim();
        if (label === 'Copy') {
          btn.textContent = 'Copied';
          setTimeout(() => (btn.textContent = 'Copy'), 1600);
        }
        showToast(textToCopy.includes('\n') ? 'Snippet copied to clipboard' : `Copied: ${textToCopy}`);
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(textToCopy).then(done).catch(() => showToast('Failed to copy to clipboard'));
      } else {
        showToast('Clipboard is not available in this browser');
      }
    });
  });
});
