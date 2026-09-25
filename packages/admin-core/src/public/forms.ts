import type { AdminField } from './fields.js';

export interface AdminFormFieldConfig {
  readonly name: string;
  readonly label: string;
  readonly required?: boolean | undefined;
  readonly readonly?: boolean | undefined;
  readonly hidden?: boolean | undefined;
  readonly helpText?: string | undefined;
}

export class AdminFormField {
  public readonly name: string;
  public readonly label: string;
  public readonly required: boolean;
  public readonly readonly: boolean;
  public readonly hidden: boolean;
  public readonly helpText?: string | undefined;

  constructor(config: AdminFormFieldConfig) {
    this.name = config.name;
    this.label = config.label;
    this.required = config.required ?? false;
    this.readonly = config.readonly ?? false;
    this.hidden = config.hidden ?? false;
    this.helpText = config.helpText;
  }
}

export class AdminForm {
  public readonly fields: readonly AdminFormField[];

  constructor(fields: readonly AdminField[]) {
    this.fields = fields.map(
      (f) =>
        new AdminFormField({
          name: f.name,
          label: f.label,
          required: f.required,
          readonly: f.readonly,
          hidden: f.hidden,
          helpText: f.description,
        })
    );
  }
}
