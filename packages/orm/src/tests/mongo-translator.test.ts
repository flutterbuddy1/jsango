import { describe, it, expect } from 'vitest';
import { MongoTranslator, likeToRegex } from '../internal/engine.js';
import { escapeLike } from '../public/query.js';

const t = new MongoTranslator({ primaryKey: 'id', objectIdColumns: new Set() });
const eq = (value: unknown) =>
  t.filter([], [{ type: 'comparison', column: 'email', operator: '=', value, boolean: 'AND' }]);

describe('MongoTranslator', () => {
  it('compares JSON objects from requests as values, not operators', () => {
    expect(eq({ $ne: null })).toEqual({ email: { $eq: { $ne: null } } });
    expect(eq('a@b.c')).toEqual({ email: 'a@b.c' });
  });

  it('rejects $-prefixed field names', () => {
    expect(() => t.field('$where')).toThrow('Invalid field name');
  });

  it('treats escaped % and _ literally and collapses wildcard runs', () => {
    expect(likeToRegex(`%${escapeLike('50%_off')}%`)).toBe('^.*50%_off.*$');
    expect(likeToRegex('%%%a%%b%')).toBe('^.*a.*b.*$');
  });
});
