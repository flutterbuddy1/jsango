import type { ICacheDriver } from '../types.js';
export interface DriverTestContext {
    driver: ICacheDriver;
    cleanup?: () => Promise<void> | void;
}
/**
 * Universal driver contract test suite.
 * All ICacheDriver implementations must pass these tests.
 */
export declare function runCacheDriverContractTests(driverName: string, createDriver: () => Promise<DriverTestContext> | DriverTestContext): void;
//# sourceMappingURL=contract.d.ts.map