import { describe, it, expect } from 'vitest';
import {
  renderButton,
  renderBadge,
  renderInput,
  renderAlert,
  renderSkeleton,
  renderDiffViewer,
  computeObjectDiff,
  renderJsonViewer,
} from '../components/ui/index.js';
import {
  renderConfirmDialog,
  renderDeleteConfirmModal,
} from '../components/modals/confirm-dialog.js';
import {
  renderCommandPalette,
  buildDefaultCommands,
} from '../components/modals/command-palette.js';

describe('UI Primitives & Modals', () => {
  it('renders buttons with variants and icons', () => {
    const html = renderButton({ label: 'Save', variant: 'primary', icon: '💾' });
    expect(html).toContain('admin-btn-primary');
    expect(html).toContain('Save');
    expect(html).toContain('💾');
  });

  it('renders status badges', () => {
    const html = renderBadge({ label: 'Active', variant: 'success' });
    expect(html).toContain('admin-badge-success');
    expect(html).toContain('Active');
  });

  it('renders inputs and alerts', () => {
    const inputHtml = renderInput({
      name: 'email',
      value: 'test@example.com',
      error: 'Invalid email',
    });
    expect(inputHtml).toContain('test@example.com');
    expect(inputHtml).toContain('Invalid email');

    const alertHtml = renderAlert({ type: 'warning', title: 'Warning', message: 'High load' });
    expect(alertHtml).toContain('admin-alert-warning');
    expect(alertHtml).toContain('High load');

    const skeletonHtml = renderSkeleton({ type: 'card', count: 2 });
    expect(skeletonHtml).toContain('admin-skeleton-card');
  });

  it('computes object diffs and renders diff viewer', () => {
    const before = { name: 'Alice', role: 'user', age: 30 };
    const after = { name: 'Alice', role: 'admin', location: 'NYC' };

    const diffs = computeObjectDiff(before, after);
    expect(diffs).toEqual([
      { key: 'age', type: 'removed', oldValue: 30 },
      { key: 'location', type: 'added', newValue: 'NYC' },
      { key: 'name', type: 'unchanged', oldValue: 'Alice', newValue: 'Alice' },
      { key: 'role', type: 'modified', oldValue: 'user', newValue: 'admin' },
    ]);

    const html = renderDiffViewer(before, after);
    expect(html).toContain('role');
    expect(html).toContain('Modified');
    expect(html).toContain('location');
    expect(html).toContain('Added');
  });

  it('renders formatted JSON viewer', () => {
    const html = renderJsonViewer({ a: 1, b: 'two' });
    expect(html).toContain('"a": 1');
    expect(html).toContain('"b": "two"');
  });

  it('renders confirmation dialogs and delete modals', () => {
    const dialogHtml = renderConfirmDialog({
      title: 'Confirm Action',
      message: 'Proceed with mutation?',
      onConfirm: () => {},
    });
    expect(dialogHtml).toContain('Confirm Action');
    expect(dialogHtml).toContain('Proceed with mutation?');

    const deleteHtml = renderDeleteConfirmModal({
      resourceLabel: 'Product',
      recordId: 42,
      onConfirm: () => {},
    });
    expect(deleteHtml).toContain('Delete Product?');
    expect(deleteHtml).toContain('Product #42');
  });

  it('builds commands and renders command palette', () => {
    const commands = buildDefaultCommands({
      resources: [{ id: 'users', label: 'User', pluralLabel: 'Users' }],
      onNavigate: () => {},
      onSetTheme: () => {},
    });

    expect(commands.length).toBeGreaterThanOrEqual(4);
    const paletteHtml = renderCommandPalette(commands, 'users');
    expect(paletteHtml).toContain('Users');
    expect(paletteHtml).toContain('Resources');
  });
});
