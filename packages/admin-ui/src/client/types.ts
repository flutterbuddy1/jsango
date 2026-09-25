import type { DashboardWidgetConfig } from '@jsango/admin-core';

export interface AdminApiClientOptions {
  readonly baseUrl?: string | undefined;
  readonly getAuthToken?: (() => string | null | Promise<string | null>) | undefined;
  readonly onUnauthorized?: (() => void) | undefined;
  readonly fetchFn?: typeof fetch | undefined;
}

export interface DashboardResponse {
  readonly widgets: readonly DashboardWidgetConfig[];
  readonly data: Record<string, unknown>;
}

export interface CustomPageSummary {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly navigationGroup?: string | undefined;
  readonly navigationIcon?: string | undefined;
  readonly navigationOrder?: number | undefined;
  readonly permission?: string | undefined;
}
