import * as crypto from 'node:crypto';
/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqualString(a, b) {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
        // Perform dummy timing-safe comparison on identical buffer to equalize execution time
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}
//# sourceMappingURL=timing.js.map