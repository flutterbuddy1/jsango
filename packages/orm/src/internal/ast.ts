export type ConditionType = 'comparison' | 'in' | 'null';

export interface WhereConditionNode {
  readonly type: ConditionType;
  readonly column: string;
  readonly operator: string;
  readonly value?: unknown;
  readonly values?: readonly unknown[] | undefined;
  readonly boolean: 'AND' | 'OR';
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

export interface SelectAst {
  readonly table: string;
  /** Implicit conditions (e.g. soft-delete) ANDed with the parenthesized user conditions. */
  readonly scope?: readonly WhereConditionNode[] | undefined;
  readonly columns: readonly string[];
  readonly where: readonly WhereConditionNode[];
  readonly orderBy: readonly OrderByNode[];
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
  readonly joins?: readonly JoinNode[] | undefined;
}

export interface InsertAst {
  readonly table: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly unknown[])[];
  /** Columns to return (`['*']` for all); only emitted when the dialect supports RETURNING. */
  readonly returning?: readonly string[] | undefined;
}

export interface UpdateAst {
  readonly table: string;
  /** Implicit conditions (e.g. soft-delete) ANDed with the parenthesized user conditions. */
  readonly scope?: readonly WhereConditionNode[] | undefined;
  readonly values: Readonly<Record<string, unknown>>;
  readonly where: readonly WhereConditionNode[];
}

export interface DeleteAst {
  readonly table: string;
  /** Implicit conditions (e.g. soft-delete) ANDed with the parenthesized user conditions. */
  readonly scope?: readonly WhereConditionNode[] | undefined;
  readonly where: readonly WhereConditionNode[];
}

export interface CountAst {
  readonly table: string;
  /** Implicit conditions (e.g. soft-delete) ANDed with the parenthesized user conditions. */
  readonly scope?: readonly WhereConditionNode[] | undefined;
  readonly column?: string | undefined;
  readonly where: readonly WhereConditionNode[];
}

export interface ExistsAst {
  readonly table: string;
  /** Implicit conditions (e.g. soft-delete) ANDed with the parenthesized user conditions. */
  readonly scope?: readonly WhereConditionNode[] | undefined;
  readonly where: readonly WhereConditionNode[];
}
