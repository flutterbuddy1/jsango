import { describe } from 'vitest';
import { runCacheDriverContractTests } from '../public/testing/contract.js';
import { MemoryCacheDriver } from '../public/drivers/memory.js';

describe('Cache Driver Contract Tests', () => {
  runCacheDriverContractTests('MemoryCacheDriver', () => {
    const driver = new MemoryCacheDriver({ pruneIntervalMs: 0 });
    return { driver };
  });
});
