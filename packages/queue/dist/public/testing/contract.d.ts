import type { IQueueDriver } from '../types.js';
export interface QueueDriverTestContext {
    driver: IQueueDriver;
    cleanup?: () => Promise<void> | void;
}
export declare function runQueueDriverContractTests(driverName: string, createDriver: () => Promise<QueueDriverTestContext> | QueueDriverTestContext): void;
//# sourceMappingURL=contract.d.ts.map