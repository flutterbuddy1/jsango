import { describe, it, expect } from 'vitest';
import { createConfigProvider } from './index.js';

describe('@django-js/config', () => {
  it('should read config values with type safety', () => {
    const config = createConfigProvider({
      PORT: '8080',
      ENABLE_FEATURE: 'true',
      MAX_RETRIES: 5,
    });

    expect(config.getNumber('PORT')).toBe(8080);
    expect(config.getBoolean('ENABLE_FEATURE')).toBe(true);
    expect(config.getNumber('MAX_RETRIES')).toBe(5);
    expect(config.getString('MISSING', 'fallback')).toBe('fallback');
  });

  it('should correctly evaluate has()', () => {
    const config = createConfigProvider({ KEY: 'value' });
    expect(config.has('KEY')).toBe(true);
    expect(config.has('NOT_EXIST')).toBe(false);
  });
});
