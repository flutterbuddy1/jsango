import { describe, it, expect } from 'vitest';
import type { IModel, IQueryBuilder } from './index.js';

describe('@jsango/orm', () => {
  it('should support typing mock Model and QueryBuilder contracts', async () => {
    interface UserAttributes {
      id?: number;
      name: string;
      email: string;
    }

    class MockUser implements IModel<UserAttributes> {
      constructor(private attrs: UserAttributes) {}

      get id() {
        return this.attrs.id;
      }
      getAttributes() {
        return this.attrs;
      }
      setAttribute<K extends keyof UserAttributes>(key: K, value: UserAttributes[K]) {
        this.attrs[key] = value;
      }
      async save(): Promise<this> {
        return this;
      }
      async delete(): Promise<void> {}
    }

    class MockQueryBuilder implements IQueryBuilder<UserAttributes> {
      where(_col: string, _val: unknown): this {
        return this;
      }
      limit(_n: number): this {
        return this;
      }
      offset(_n: number): this {
        return this;
      }
      async get(): Promise<UserAttributes[]> {
        return [{ id: 1, name: 'Alice', email: 'alice@example.com' }];
      }
      async first(): Promise<UserAttributes | null> {
        return { id: 1, name: 'Alice', email: 'alice@example.com' };
      }
    }

    const user = new MockUser({ name: 'Bob', email: 'bob@example.com' });
    user.setAttribute('name', 'Robert');
    expect(user.getAttributes().name).toBe('Robert');

    const qb = new MockQueryBuilder();
    const result = await qb.first();
    expect(result?.email).toBe('alice@example.com');
  });
});
