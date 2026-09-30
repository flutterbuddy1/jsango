export type ConditionType = 'comparison' | 'in' | 'null' | 'between' | 'group' | 'raw';

export interface WhereConditionNode {
  readonly type: ConditionType;
  /** Column name; empty for 'group' and 'raw' nodes. */
  readonly column: string;
  /**
   * 'comparison': =, !=, <>, >, >=, <, <=, LIKE, NOT LIKE, ILIKE, NOT ILIKE
   * 'in': IN / NOT IN; 'null': IS NULL / IS NOT NULL; 'between': BETWEEN / NOT BETWEEN
   * 'group': AND (or NOT for a negated group); 'raw': RAW
   */
  readonly operator: string;
  readonly value?: unknown;
  /** Values for 'in' and the [low, high] pair for 'between'. */
  readonly values?: readonly unknown[] | undefined;
  readonly boolean: 'AND' | 'OR';
  /** Nested conditions of a 'group' node (rendered in parentheses). */
  readonly children?: readonly WhereConditionNode[] | undefined;
  /** SQL fragment of a 'raw' node (SQL databases). */
  readonly sql?: string | undefined;
  /** Bound parameters of a 'raw' SQL fragment. */
  readonly params?: readonly unknown[] | undefined;
  /** Native filter document of a 'raw' node (MongoDB). */
  readonly filter?: Readonly<Record<string, unknown>> | undefined;
}

export interface OrderByNode {
  readonly column: string;
  readonly direction: 'ASC' | 'DESC';
}

export interface JoinNode {
  readonly table: string;
  readonly type: 'INNER' | 'LEFT' | 'RIGHT';
  readonly on: {
    readonly leftColumn: string;
    readonly rightColumn: string;
  };
}

interface Scoped {
  /** Implicit conditions (e.g. soft-delete) ANDed with the parenthesized user conditions. */
  readonly scope?: readonly WhereConditionNode[] | undefined;
}

export interface SelectAst extends Scoped {
  readonly table: string;
  readonly columns: readonly string[];
  readonly where: readonly WhereConditionNode[];
  readonly orderBy: readonly OrderByNode[];
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
  readonly joins?: readonly JoinNode[] | undefined;
  readonly distinct?: boolean | undefined;
  /** Row locking for the current transaction (PostgreSQL / MySQL; ignored elsewhere). */
  readonly lock?: 'update' | 'share' | undefined;
}

export interface InsertAst {
  readonly table: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly unknown[])[];
  /** Columns to return (`['*']` for all); only emitted when the dialect supports RETURNING. */
  readonly returning?: readonly string[] | undefined;
}

export interface UpdateAst extends Scoped {
  readonly table: string;
  readonly values: Readonly<Record<string, unknown>>;
  /** Atomic `column = column + n` updates. */
  readonly increments?: Readonly<Record<string, number>> | undefined;
  readonly where: readonly WhereConditionNode[];
}

export interface DeleteAst extends Scoped {
  readonly table: string;
  readonly where: readonly WhereConditionNode[];
}

export interface CountAst extends Scoped {
  readonly table: string;
  readonly column?: string | undefined;
  readonly where: readonly WhereConditionNode[];
}

export interface ExistsAst extends Scoped {
  readonly table: string;
  readonly where: readonly WhereConditionNode[];
}

export type AggregateFunction = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface AggregateAst extends Scoped {
  readonly table: string;
  readonly fn: AggregateFunction;
  readonly column: string;
  readonly where: readonly WhereConditionNode[];
}

export interface GroupAggregate {
  readonly fn: AggregateFunction;
  /** Column to aggregate; omit for count(*). */
  readonly column?: string | undefined;
}

export interface HavingNode {
  readonly alias: string;
  readonly operator: '=' | '!=' | '>' | '>=' | '<' | '<=';
  readonly value: number;
}

export interface GroupAst extends Scoped {
  readonly table: string;
  readonly groupBy: readonly string[];
  readonly aggregates: Readonly<Record<string, GroupAggregate>>;
  readonly where: readonly WhereConditionNode[];
  readonly having?: readonly HavingNode[] | undefined;
  readonly orderBy?: readonly OrderByNode[] | undefined;
  readonly limit?: number | undefined;
}
