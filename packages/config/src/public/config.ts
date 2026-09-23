export interface IConfigProvider {
  get<T = unknown>(key: string, defaultValue?: T): T;
  getString(key: string, defaultValue?: string): string;
  getNumber(key: string, defaultValue?: number): number;
  getBoolean(key: string, defaultValue?: boolean): boolean;
  has(key: string): boolean;
}
