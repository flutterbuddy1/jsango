export interface AdminColumnConfig {
  readonly name: string;
  readonly label: string;
  readonly sortable?: boolean | undefined;
  readonly align?: 'left' | 'center' | 'right' | undefined;
  readonly width?: string | number | undefined;
  readonly hidden?: boolean | undefined;
}

export class AdminColumn {
  public readonly name: string;
  public readonly label: string;
  public readonly sortable: boolean;
  public readonly align: 'left' | 'center' | 'right';
  public readonly width?: string | number | undefined;
  public readonly hidden: boolean;

  constructor(config: AdminColumnConfig) {
    this.name = config.name;
    this.label = config.label;
    this.sortable = config.sortable ?? true;
    this.align = config.align ?? 'left';
    this.width = config.width;
    this.hidden = config.hidden ?? false;
  }
}

export class AdminTable {
  public readonly columns: readonly AdminColumn[];

  constructor(columns: readonly AdminColumnConfig[]) {
    this.columns = columns.map((col) => new AdminColumn(col));
  }
}
