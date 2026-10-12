import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { audioCell, linkCell, detailsCell } from '@jsango/admin-core';
import { Cell } from '../react/components/widgets/WidgetGrid.js';

const render = (value: unknown) => renderToStaticMarkup(createElement(Cell, { value }));

describe('admin table cells', () => {
  it('renders audio players, links and expandable text', () => {
    expect(render(audioCell('/media/ai-calls/c1.wav'))).toBe(
      '<audio controls="" preload="none" src="/media/ai-calls/c1.wav" style="height:32px;max-width:260px"></audio>'
    );
    expect(render(linkCell('https://example.com/x', 'Open'))).toBe(
      '<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">Open</a>'
    );
    const details = render(detailsCell('Transcript', 'User: hi\nAgent: hello <b>'));
    expect(details).toContain('<summary style="cursor:pointer">Transcript</summary>');
    expect(details).toContain('User: hi\nAgent: hello &lt;b&gt;'); // text, never HTML
    expect(render(null)).toBe('—');
    expect(render(42)).toBe('42');
  });

  it('never turns a script URL into a link or player', () => {
    for (const url of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,x',
      '//evil.com/x',
    ]) {
      expect(render(linkCell(url, 'x'))).toBe('x');
      expect(render(audioCell(url))).toBe('—');
    }
  });
});
