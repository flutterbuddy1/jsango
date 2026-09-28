import type { IContainer } from '@jsango/container';
export interface TestContext {
    readonly container?: IContainer | undefined;
    reset(): Promise<void>;
}
export declare function createTestContext(container?: IContainer): TestContext;
//# sourceMappingURL=testing.d.ts.map