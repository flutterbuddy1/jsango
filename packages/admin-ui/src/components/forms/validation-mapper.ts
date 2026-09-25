/**
 * Validation error mapping utilities for @jsango/admin-ui
 */

import { AdminApiError } from '../../client/errors.js';

export function extractFieldErrors(error: unknown): Record<string, string> {
  if (!error) return {};

  if (error instanceof AdminApiError && error.fieldErrors) {
    return error.fieldErrors;
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj['fieldErrors'] === 'object' && errObj['fieldErrors'] !== null) {
      return errObj['fieldErrors'] as Record<string, string>;
    }
  }

  return {};
}

export function extractGeneralErrorMessage(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  return String(error);
}
