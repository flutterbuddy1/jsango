export type DashboardWidgetType = 'metric' | 'table' | 'chart' | 'activity' | 'custom';

export interface DashboardWidgetConfig {
  readonly id: string;
  readonly type: DashboardWidgetType;
  readonly title: string;
  readonly width?: 'full' | 'half' | 'third' | 'quarter' | undefined;
  readonly permission?: string | undefined;
  readonly refreshIntervalSeconds?: number | undefined;
}

export abstract class DashboardWidget {
  public readonly id: string;
  public readonly type: DashboardWidgetType;
  public readonly title: string;
  public readonly width: 'full' | 'half' | 'third' | 'quarter';
  public readonly permission?: string | undefined;
  public readonly refreshIntervalSeconds?: number | undefined;

  constructor(config: DashboardWidgetConfig) {
    this.id = config.id;
    this.type = config.type;
    this.title = config.title;
    this.width = config.width ?? 'half';
    this.permission = config.permission;
    this.refreshIntervalSeconds = config.refreshIntervalSeconds;
  }

  public abstract getData(context?: unknown): Promise<unknown> | unknown;

  public toJSON(): { id: string; type: DashboardWidgetType; title: string; width: string } {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      width: this.width,
    };
  }
}

export class MetricWidget extends DashboardWidget {
  private readonly valueGetter: (
    ctx?: unknown
  ) =>
    | Promise<
        | string
        | number
        | { value: string | number; change?: number; trend?: 'up' | 'down' | 'neutral' }
      >
    | string
    | number
    | { value: string | number; change?: number; trend?: 'up' | 'down' | 'neutral' };

  constructor(
    config: DashboardWidgetConfig & {
      readonly getValue: (
        ctx?: unknown
      ) =>
        | Promise<
            | string
            | number
            | { value: string | number; change?: number; trend?: 'up' | 'down' | 'neutral' }
          >
        | string
        | number
        | { value: string | number; change?: number; trend?: 'up' | 'down' | 'neutral' };
    }
  ) {
    super({ ...config, type: 'metric' });
    this.valueGetter = config.getValue;
  }

  public override async getData(context?: unknown): Promise<unknown> {
    return this.valueGetter(context);
  }
}

export class TableWidget extends DashboardWidget {
  private readonly rowsGetter: (
    ctx?: unknown
  ) => Promise<{ headers: string[]; rows: unknown[][] }> | { headers: string[]; rows: unknown[][] };

  constructor(
    config: DashboardWidgetConfig & {
      readonly getTableData: (
        ctx?: unknown
      ) =>
        | Promise<{ headers: string[]; rows: unknown[][] }>
        | { headers: string[]; rows: unknown[][] };
    }
  ) {
    super({ ...config, type: 'table' });
    this.rowsGetter = config.getTableData;
  }

  public override async getData(context?: unknown): Promise<unknown> {
    return this.rowsGetter(context);
  }
}

export class ChartWidget extends DashboardWidget {
  private readonly chartDataGetter: (
    ctx?: unknown
  ) =>
    | Promise<{ labels: string[]; datasets: Array<{ label: string; data: number[] }> }>
    | { labels: string[]; datasets: Array<{ label: string; data: number[] }> };

  constructor(
    config: DashboardWidgetConfig & {
      readonly getChartData: (
        ctx?: unknown
      ) =>
        | Promise<{ labels: string[]; datasets: Array<{ label: string; data: number[] }> }>
        | { labels: string[]; datasets: Array<{ label: string; data: number[] }> };
    }
  ) {
    super({ ...config, type: 'chart' });
    this.chartDataGetter = config.getChartData;
  }

  public override async getData(context?: unknown): Promise<unknown> {
    return this.chartDataGetter(context);
  }
}

export class ActivityWidget extends DashboardWidget {
  private readonly activityGetter: (
    ctx?: unknown
  ) =>
    | Promise<
        Array<{ id: string; title: string; subtitle?: string; timestamp: number; icon?: string }>
      >
    | Array<{ id: string; title: string; subtitle?: string; timestamp: number; icon?: string }>;

  constructor(
    config: DashboardWidgetConfig & {
      readonly getActivity: (ctx?: unknown) =>
        | Promise<
            Array<{
              id: string;
              title: string;
              subtitle?: string;
              timestamp: number;
              icon?: string;
            }>
          >
        | Array<{ id: string; title: string; subtitle?: string; timestamp: number; icon?: string }>;
    }
  ) {
    super({ ...config, type: 'activity' });
    this.activityGetter = config.getActivity;
  }

  public override async getData(context?: unknown): Promise<unknown> {
    return this.activityGetter(context);
  }
}

export class AdminDashboard {
  private readonly widgets = new Map<string, DashboardWidget>();

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

  public async getDashboardData(context?: unknown): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    for (const [id, widget] of this.widgets) {
      try {
        result[id] = await widget.getData(context);
      } catch {
        result[id] = null;
      }
    }
    return result;
  }
}
