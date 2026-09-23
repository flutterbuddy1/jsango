import { describe, it, expect } from 'vitest';
import { HttpQuery } from './public/query.js';

describe('HttpQuery', () => {
  it('should parse single query parameters', () => {
    const query = new HttpQuery('search=vitest&page=2');
    expect(query.get('search')).toBe('vitest');
    expect(query.get('page')).toBe('2');
    expect(query.has('search')).toBe(true);
    expect(query.has('missing')).toBe(false);
  });

  it('should handle repeated parameters without dropping values', () => {
    const query = new HttpQuery('tag=typescript&tag=django&tag=web');
    expect(query.get('tag')).toBe('typescript');
    expect(query.getAll('tag')).toEqual(['typescript', 'django', 'web']);
  });

  it('should handle URL-encoded characters properly', () => {
    const query = new HttpQuery('filter=hello%20world&special=%26%3D');
    expect(query.get('filter')).toBe('hello world');
    expect(query.get('special')).toBe('&=');
  });

  it('should support append, set, and delete operations', () => {
    const query = new HttpQuery();
    query.set('sort', 'asc');
    expect(query.get('sort')).toBe('asc');

    query.append('sort', 'desc');
    expect(query.getAll('sort')).toEqual(['asc', 'desc']);

    query.delete('sort');
    expect(query.has('sort')).toBe(false);
  });

  it('should convert to structured record and string', () => {
    const query = new HttpQuery({
      single: 'one',
      multi: ['a', 'b'],
    });

    const record = query.toRecord();
    expect(record['single']).toBe('one');
    expect(record['multi']).toEqual(['a', 'b']);

    const queryStr = query.toString();
    expect(queryStr).toContain('single=one');
    expect(queryStr).toContain('multi=a');
    expect(queryStr).toContain('multi=b');
  });
});
