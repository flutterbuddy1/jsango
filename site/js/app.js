/**
 * JSango Landing Page - Interactive Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
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
      snippet: `import { createRuntimeAdapter } from '@jsango/runtime';

// High-performance Node.js runtime adapter
export const runtime = createRuntimeAdapter({
  platform: 'node',
  features: { http2: true, cluster: true }
});`,
    },
    core: {
      title: '2. Core Lifecycle & DI',
      pkg: '@jsango/core & @jsango/container',
      desc: 'Application lifecycle management, structured error hierarchy, and ultra-fast dependency injection with transient, singleton, and scoped lifetimes.',
      snippet: `import { Container, Injectable } from '@jsango/container';

@Injectable()
export class BillingService {
  processInvoice(id: string) { /* ... */ }
}`,
    },
    http: {
      title: '3. HTTP Abstraction',
      pkg: '@jsango/http',
      desc: 'Zero-allocation streaming request/response abstractions, cookie managers, header sanitization, and multipart streaming parsers.',
      snippet: `import { HttpRequest, HttpResponse } from '@jsango/http';

export function handle(req: HttpRequest, res: HttpResponse) {
  res.setHeader('X-Powered-By', 'JSango');
  return res.json({ status: 'ok' });
}`,
    },
    router: {
      title: '4. SegRadix Router',
      pkg: '@jsango/router',
      desc: 'Optimized Segment Radix Trie router delivering >7.7M lookups/sec with typed parameter constraints (:uuid, :int, :slug).',
      snippet: `import { SegRadixRouter } from '@jsango/router';

const router = new SegRadixRouter();
router.get('/api/users/:id:uuid', (ctx) => {
  return ctx.json({ id: ctx.params.id });
});`,
    },
    middleware: {
      title: '5. Middleware Pipeline',
      pkg: '@jsango/middleware',
      desc: 'Onion-style asynchronous middleware pipeline supporting rate limiting, CORS, CSRF, security headers, and telemetry tracing.',
      snippet: `import { Application } from '@jsango/middleware';

const app = new Application();
app.use(async (ctx, next) => {
  const start = performance.now();
  await next();
  ctx.response.setHeader('X-Runtime', \`\${performance.now() - start}ms\`);
});`,
    },
    orm: {
      title: '6. Declarative ORM & Migrations',
      pkg: '@jsango/orm & @jsango/migrations',
      desc: 'Batteries-included ORM with AST query compilation, batch eager loading (.with()), relationships, and auto-diffing migration runners.',
      snippet: `import { defineModel, fields } from '@jsango/orm';

export const User = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    id: fields.uuid({ primaryKey: true }),
    email: fields.string({ unique: true }),
  },
  relations: (rel) => ({
    orders: rel.hasMany('Order', { foreignKey: 'userId' }),
  })
});`,
    },
    admin: {
      title: '7. Auto Admin Console',
      pkg: '@jsango/admin-server & @jsango/admin-ui',
      desc: 'React SPA and orchestrator generating full CRUD, filters, search, TOTP 2FA, session control, audit trails, and data export.',
      snippet: `import { createAdminResource } from '@jsango/admin-core';

export const UserResource = createAdminResource(User, {
  label: 'User Accounts',
  searchFields: ['email', 'name'],
  listFields: ['id', 'email', 'createdAt'],
  export: { csv: true, excel: true },
});`,
    },
  };

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
      const textToCopy = btn.getAttribute('data-copy');
      if (textToCopy) {
        navigator.clipboard
          .writeText(textToCopy)
          .then(() => {
            showToast(`Copied to clipboard: ${textToCopy}`);
          })
          .catch(() => {
            showToast('Failed to copy to clipboard');
          });
      }
    });
  });
});
