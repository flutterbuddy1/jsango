import { describe } from 'vitest';
import { runQueueDriverContractTests } from '../public/testing/contract.js';
import { MemoryQueueDriver } from '../public/drivers/memory.js';

describe('Queue Driver Contract Tests', () => {
  runQueueDriverContractTests('MemoryQueueDriver', () => {
    const driver = new MemoryQueueDriver();
    return { driver };
  });
});
