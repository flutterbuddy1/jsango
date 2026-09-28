export class NodeRuntimeAdapter {
    name = 'node';
    get version() {
        const globalObj = globalThis;
        return globalObj.process?.versions?.node ?? 'unknown';
    }
    getEnv(key) {
        const globalObj = globalThis;
        return globalObj.process?.env?.[key];
    }
    getAllEnv() {
        const globalObj = globalThis;
        return Object.freeze({ ...(globalObj.process?.env ?? {}) });
    }
    cwd() {
        const globalObj = globalThis;
        return globalObj.process?.cwd?.() ?? '.';
    }
    exit(code = 0) {
        const globalObj = globalThis;
        globalObj.process?.exit?.(code);
    }
}
//# sourceMappingURL=node-adapter.js.map