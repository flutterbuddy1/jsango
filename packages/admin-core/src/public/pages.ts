import { AdminDashboard, type DashboardWidget } from './dashboard.js';

export interface AdminPageConfig {
  readonly id: string;
  /** Defaults to the id. */
  readonly path?: string | undefined;
  readonly label: string;
  readonly description?: string | undefined;
  readonly navigationGroup?: string | undefined;
  readonly navigationIcon?: string | undefined;
  readonly navigationOrder?: number | undefined;
  /** Only identities with this permission (or superusers) see the page. */
  readonly permission?: string | undefined;
  /** Widgets that make up the page: every page is a dashboard of its own. */
  readonly widgets?: readonly DashboardWidget[] | undefined;
}

/** A custom page in the admin sidebar, built from dashboard widgets. */
export class AdminPage {
  public readonly id: string;
  public readonly path: string;
  public readonly label: string;
  public readonly description?: string | undefined;
  public readonly navigationGroup?: string | undefined;
  public readonly navigationIcon?: string | undefined;
  public readonly navigationOrder?: number | undefined;
  public readonly permission?: string | undefined;
  public readonly dashboard: AdminDashboard;

  constructor(config: AdminPageConfig) {
    this.id = config.id;
    this.path = config.path ?? config.id;
    this.label = config.label;
    this.description = config.description;
    this.navigationGroup = config.navigationGroup;
    this.navigationIcon = config.navigationIcon;
    this.navigationOrder = config.navigationOrder;
    this.permission = config.permission;
    this.dashboard = new AdminDashboard(config.widgets);
  }

  public toJSON() {
    return {
      id: this.id,
      path: this.path,
      label: this.label,
      description: this.description,
      navigationGroup: this.navigationGroup,
      navigationIcon: this.navigationIcon,
      navigationOrder: this.navigationOrder,
      permission: this.permission,
    };
  }
}
