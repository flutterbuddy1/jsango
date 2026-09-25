import type { AdminFilterConfig, AdminFilterType } from './types.js';

export class AdminFilter {
  public readonly name: string;
  public readonly type: AdminFilterType;
  public readonly field: string;
  public readonly label: string;
  public readonly choices?:
    readonly { readonly label: string; readonly value: string | number }[] | undefined;

  constructor(config: AdminFilterConfig) {
    this.name = config.name;
    this.type = config.type;
    this.field = config.field;
    this.label = config.label ?? config.name;
    this.choices = config.choices;
  }

  public toJSON(): AdminFilterConfig {
    return {
      name: this.name,
      type: this.type,
      field: this.field,
      label: this.label,
      choices: this.choices,
    };
  }
}
