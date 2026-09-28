/**
 * Validation error mapping utilities for @jsango/admin-ui
 */
import { AdminApiError } from '../../client/errors.js';
export function extractFieldErrors(error) {
    if (!error)
        return {};
    if (error instanceof AdminApiError && error.fieldErrors) {
        return error.fieldErrors;
    }
    if (typeof error === 'object' && error !== null) {
        const errObj = error;
        if (typeof errObj['fieldErrors'] === 'object' && errObj['fieldErrors'] !== null) {
            return errObj['fieldErrors'];
        }
    }
    return {};
}
export function extractGeneralErrorMessage(error) {
    if (!error)
        return '';
    if (error instanceof Error)
        return error.message;
    return String(error);
}
//# sourceMappingURL=validation-mapper.js.map