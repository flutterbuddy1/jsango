export type ModelAttributes = Record<string, unknown>;

export interface IModel<T extends ModelAttributes = ModelAttributes> {
  readonly id?: unknown;
  getAttributes(): Readonly<T>;
  setAttribute<K extends keyof T>(key: K, value: T[K]): void;
  save(): Promise<this>;
  delete(): Promise<void>;
}

export interface IQueryBuilder<T extends ModelAttributes = ModelAttributes> {
  where(column: string, value: unknown): this;
  where(column: string, operator: string, value: unknown): this;
  limit(n: number): this;
  offset(n: number): this;
  get(): Promise<T[]>;
  first(): Promise<T | null>;
}
