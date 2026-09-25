import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatBytes,
  truncateText,
  formatRecordTitle,
} from '../formatters/index.js';

describe('Formatters', () => {
  it('formats dates and datetimes reliably', () => {
    const d = new Date('2026-09-25T12:00:00Z');
    expect(formatDate(d)).toContain('Sep 25, 2026');
    expect(formatDateTime(d)).toContain('Sep 25, 2026');
    expect(formatDate(null)).toBe('—');
  });

  it('formats relative time', () => {
    expect(formatRelativeTime(Date.now() - 2000)).toBe('just now');
    expect(formatRelativeTime(Date.now() - 30_000)).toBe('30s ago');
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe('5m ago');
    expect(formatRelativeTime(Date.now() - 2 * 3600_000)).toBe('2h ago');
    expect(formatRelativeTime(null)).toBe('—');
  });

  it('formats numbers, currencies, percentages, and bytes', () => {
    expect(formatNumber(1250000)).toBe('1,250,000');
    expect(formatCurrency(49.99)).toBe('$49.99');
    expect(formatPercent(0.125)).toBe('12.5%');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('truncates text and derives record titles', () => {
    expect(truncateText('Hello World this is a very long sentence that exceeds limit', 20)).toBe(
      'Hello World this is ...'
    );
    expect(truncateText('Short', 20)).toBe('Short');

    expect(formatRecordTitle({ title: 'My Document', id: 1 })).toBe('My Document');
    expect(formatRecordTitle({ username: 'john_doe', id: 2 })).toBe('john_doe');
    expect(formatRecordTitle({ id: 99 })).toBe('#99');
    expect(formatRecordTitle(null)).toBe('Record');
  });
});
