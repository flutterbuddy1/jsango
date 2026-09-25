/**
 * Formatting utilities for @jsango/admin-ui
 */

export function formatDate(
  value: string | number | Date | null | undefined,
  locale = 'en-US'
): string {
  if (!value) return '—';
  try {
    const d = typeof value === 'object' ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return String(value);
  }
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  locale = 'en-US'
): string {
  if (!value) return '—';
  try {
    const d = typeof value === 'object' ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  } catch {
    return String(value);
  }
}

export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  try {
    const d = typeof value === 'object' ? value : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(d);
  } catch {
    return String(value);
  }
}

export function formatNumber(value: number | null | undefined, locale = 'en-US'): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCurrency(
  value: number | null | undefined,
  currency = 'USD',
  locale = 'en-US'
): string {
  if (value === null || value === undefined || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, locale = 'en-US'): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  const sizeValue = parseFloat((bytes / Math.pow(k, safeI)).toFixed(1));
  return `${sizeValue} ${sizes[safeI]}`;
}

export function truncateText(text: string | null | undefined, maxLength = 50): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function formatRecordTitle(
  record: Record<string, unknown> | null | undefined,
  primaryKey = 'id'
): string {
  if (!record) return 'Record';
  const candidates = ['title', 'name', 'label', 'username', 'email', 'slug', 'identifier'];
  for (const c of candidates) {
    const val = record[c];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  const pkVal = record[primaryKey];
  if (pkVal !== undefined && pkVal !== null) {
    return `#${pkVal}`;
  }
  return 'Record';
}
