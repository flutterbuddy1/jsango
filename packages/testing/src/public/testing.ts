import type { IContainer } from '@jsango/container';

export interface TestContext {
  readonly container?: IContainer | undefined;
  reset(): Promise<void>;
}

export function createTestContext(container?: IContainer): TestContext {
  return {
    container,
    async reset(): Promise<void> {},
  };
}
