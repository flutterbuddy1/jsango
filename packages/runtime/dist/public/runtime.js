export function detectRuntime() {
    // Safe runtime detection without direct global references that throw in strict environments
    const globalObj = globalThis;
    if (typeof globalObj.Bun !== 'undefined') {
        return 'bun';
    }
    if (typeof globalObj.process !== 'undefined' &&
        typeof globalObj.process.versions?.node === 'string') {
        return 'node';
    }
    return 'unknown';
}
//# sourceMappingURL=runtime.js.map