export interface ValidationErrorItem {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
}

export interface ValidationSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly errors?: never;
}

export interface ValidationFailure {
  readonly success: false;
  readonly data?: never;
  readonly errors: readonly ValidationErrorItem[];
}

export type ValidationResult<T = unknown> = ValidationSuccess<T> | ValidationFailure;

export interface IValidator<T = unknown> {
  validate(input: unknown): Promise<ValidationResult<T>> | ValidationResult<T>;
}
