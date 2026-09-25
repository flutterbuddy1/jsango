export interface AdminPageConfig {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly navigationGroup?: string | undefined;
  readonly navigationIcon?: string | undefined;
  readonly navigationOrder?: number | undefined;
  readonly permission?: string | undefined;
}

export class AdminPage {
  public readonly id: string;
  public readonly path: string;
  public readonly label: string;
  public readonly navigationGroup?: string | undefined;
  public readonly navigationIcon?: string | undefined;
  public readonly navigationOrder?: number | undefined;
  public readonly permission?: string | undefined;

  constructor(config: AdminPageConfig) {
    this.id = config.id;
    this.path = config.path;
    this.label = config.label;
    this.navigationGroup = config.navigationGroup;
    this.navigationIcon = config.navigationIcon;
    this.navigationOrder = config.navigationOrder;
    this.permission = config.permission;
  }

  public toJSON(): AdminPageConfig {
    return {
      id: this.id,
      path: this.path,
      label: this.label,
      navigationGroup: this.navigationGroup,
      navigationIcon: this.navigationIcon,
      navigationOrder: this.navigationOrder,
      permission: this.permission,
    };
  }
}
