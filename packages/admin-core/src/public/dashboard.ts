export type DashboardWidgetType = 'metric' | 'table' | 'chart' | 'activity' | 'custom';

export type DashboardWidgetWidth = 'full' | 'half' | 'third' | 'quarter';

export interface DashboardWidgetConfig {
  /** Defaults to a slug of the title. */
  readonly id?: string | undefined;
  readonly type?: DashboardWidgetType | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly width?: DashboardWidgetWidth | undefined;
  /** Only identities with this permission (or superusers) see the widget. */
  readonly permission?: string | undefined;
  /** The admin UI reloads the widget on this interval. */
  readonly refreshIntervalSeconds?: number | undefined;
  /**
   * Cache the widget's data on the server for this long. Use it for expensive queries (counts and
   * aggregates over millions of rows). The cache is shared by all viewers, so don't use it for
   * per-user data.
   */
  readonly cacheSeconds?: number | undefined;
}

/** Passed to every widget getter. */
export interface DashboardContext {
  readonly identity?: unknown;
}

type MaybePromise<T> = T | Promise<T>;

export type MetricValue =
  | string
  | number
  | {
      value: string | number;
      /** Percentage change shown next to the value, e.g. 12.5 or -3. */
      change?: number | undefined;
      trend?: 'up' | 'down' | 'neutral' | undefined;
      /** Small text under the value, e.g. "vs last week". */
      hint?: string | undefined;
    };

export interface TableData {
  headers: string[];
  rows: unknown[][];
}

export interface ChartData {
  labels: string[];
  datasets: Array<{ label: string; data: number[] }>;
}

export interface ActivityItem {
  id: string;
  title: string;
  subtitle?: string | undefined;
  timestamp: number;
  icon?: string | undefined;
}

interface PermissionAware {
  readonly isSuperuser?: boolean;
  hasPermission?(permission: string): boolean;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export abstract class DashboardWidget {
  public readonly id: string;
  public readonly type: DashboardWidgetType;
  public readonly title: string;
  public readonly description?: string | undefined;
  public readonly width: DashboardWidgetWidth;
  public readonly permission?: string | undefined;
  public readonly refreshIntervalSeconds?: number | undefined;
  public readonly cacheSeconds?: number | undefined;
  private cached: { at: number; data: Promise<unknown> } | undefined;

  constructor(config: DashboardWidgetConfig) {
    this.id = config.id ?? slug(config.title);
    this.type = config.type ?? 'custom';
    this.title = config.title;
    this.description = config.description;
    this.width = config.width ?? 'half';
    this.permission = config.permission;
    this.refreshIntervalSeconds = config.refreshIntervalSeconds;
    this.cacheSeconds = config.cacheSeconds;
  }

  public abstract getData(context?: DashboardContext): MaybePromise<unknown>;

  /** `getData()` honouring `cacheSeconds`; concurrent requests share one in-flight query. */
  public load(context?: DashboardContext): Promise<unknown> {
    const ttl = (this.cacheSeconds ?? 0) * 1000;
    if (ttl > 0 && this.cached && Date.now() - this.cached.at < ttl) return this.cached.data;
    const data = Promise.resolve().then(() => this.getData(context));
    if (ttl > 0) {
      this.cached = { at: Date.now(), data };
      data.catch(() => (this.cached = undefined)); // never cache failures
    }
    return data;
  }

  public isVisibleTo(identity: unknown): boolean {
    if (!this.permission) return true;
    const id = identity as PermissionAware | undefined;
    return Boolean(id?.isSuperuser || id?.hasPermission?.(this.permission));
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      description: this.description,
      width: this.width,
      refreshIntervalSeconds: this.refreshIntervalSeconds,
    };
  }
}

/** A single number (with optional change / trend). */
export class MetricWidget extends DashboardWidget {
  private readonly valueGetter: (ctx?: DashboardContext) => MaybePromise<MetricValue>;

  constructor(config: DashboardWidgetConfig & { readonly getValue: (ctx?: DashboardContext) => MaybePromise<MetricValue> }) {
    super({ ...config, type: 'metric', width: config.width ?? 'quarter' });
    this.valueGetter = config.getValue;
  }

  public override getData(context?: DashboardContext): MaybePromise<MetricValue> {
    return this.valueGetter(context);
  }
}

/** Rows and columns, e.g. "latest orders". */
export class TableWidget extends DashboardWidget {
  private readonly rowsGetter: (ctx?: DashboardContext) => MaybePromise<TableData>;

  constructor(config: DashboardWidgetConfig & { readonly getTableData: (ctx?: DashboardContext) => MaybePromise<TableData> }) {
    super({ ...config, type: 'table' });
    this.rowsGetter = config.getTableData;
  }

  public override getData(context?: DashboardContext): MaybePromise<TableData> {
    return this.rowsGetter(context);
  }
}

/** Line or bar chart with one or more series. */
export class ChartWidget extends DashboardWidget {
  public readonly chartType: 'line' | 'bar';
  private readonly chartDataGetter: (ctx?: DashboardContext) => MaybePromise<ChartData>;

  constructor(
    config: DashboardWidgetConfig & {
      readonly chartType?: 'line' | 'bar' | undefined;
      readonly getChartData: (ctx?: DashboardContext) => MaybePromise<ChartData>;
    }
  ) {
    super({ ...config, type: 'chart' });
    this.chartType = config.chartType ?? 'line';
    this.chartDataGetter = config.getChartData;
  }

  public override getData(context?: DashboardContext): MaybePromise<ChartData> {
    return this.chartDataGetter(context);
  }

  public override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), chartType: this.chartType };
  }
}

/** A feed of recent events. */
export class ActivityWidget extends DashboardWidget {
  private readonly activityGetter: (ctx?: DashboardContext) => MaybePromise<ActivityItem[]>;

  constructor(config: DashboardWidgetConfig & { readonly getActivity: (ctx?: DashboardContext) => MaybePromise<ActivityItem[]> }) {
    super({ ...config, type: 'activity' });
    this.activityGetter = config.getActivity;
  }

  public override getData(context?: DashboardContext): MaybePromise<ActivityItem[]> {
    return this.activityGetter(context);
  }
}

export class AdminDashboard {
  private readonly widgets = new Map<string, DashboardWidget>();

  public constructor(widgets: readonly DashboardWidget[] = []) {
    for (const w of widgets) this.registerWidget(w);
  }

  public registerWidget(widget: DashboardWidget): this {
    this.widgets.set(widget.id, widget);
    return this;
  }

  public getWidget(id: string): DashboardWidget | undefined {
    return this.widgets.get(id);
  }

  public getWidgets(): readonly DashboardWidget[] {
    return [...this.widgets.values()];
  }

  /** Widgets the identity may see (see `permission`). */
  public visibleTo(identity: unknown): readonly DashboardWidget[] {
    return this.getWidgets().filter((w) => w.isVisibleTo(identity));
  }

  /** Loads every visible widget in parallel; a failing widget yields `null`. */
  public async getDashboardData(context?: DashboardContext): Promise<Record<string, unknown>> {
    const widgets = this.visibleTo(context?.identity);
    const values = await Promise.all(widgets.map((w) => w.load(context).catch(() => null)));
    return Object.fromEntries(widgets.map((w, i) => [w.id, values[i]]));
  }
}
