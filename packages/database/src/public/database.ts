export interface QueryResult<T = unknown> {
  readonly rows: T[];
  readonly rowCount: number;
}

export interface ITransaction {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface IDatabaseConnection {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
  beginTransaction(): Promise<ITransaction>;
  close(): Promise<void>;
}

export interface IDatabaseDriver {
  readonly name: string;
  connect(): Promise<IDatabaseConnection>;
  disconnect(): Promise<void>;
}
