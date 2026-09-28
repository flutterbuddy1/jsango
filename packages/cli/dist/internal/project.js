import * as fs from 'node:fs';
import * as path from 'node:path';
const CONFIG_FILENAMES = [
    'jsango.config.ts',
    'jsango.config.js',
    'jsango.config.ts',
    'jsango.config.js',
];
export class ProjectDiscovery {
    static findProjectRoot(startDir = process.cwd()) {
        let currentDir = path.resolve(startDir);
        const { root } = path.parse(currentDir);
        while (currentDir && currentDir !== root) {
            // 1. Check for dedicated config files
            for (const configName of CONFIG_FILENAMES) {
                const candidate = path.join(currentDir, configName);
                if (fs.existsSync(candidate)) {
                    return ProjectDiscovery.readProjectDetails(currentDir, candidate);
                }
            }
            // 2. Check for package.json
            const pkgPath = path.join(currentDir, 'package.json');
            if (fs.existsSync(pkgPath)) {
                try {
                    const content = fs.readFileSync(pkgPath, 'utf8');
                    const parsed = JSON.parse(content);
                    const deps = {
                        ...parsed['dependencies'],
                        ...parsed['devDependencies'],
                    };
                    const isFrameworkProject = parsed['jsango'] !== undefined ||
                        parsed['jsango'] !== undefined ||
                        Object.keys(deps).some((k) => k.startsWith('@jsango/') || k === 'jsango');
                    if (isFrameworkProject) {
                        return {
                            rootDir: currentDir,
                            packageJsonPath: pkgPath,
                            name: typeof parsed['name'] === 'string' ? parsed['name'] : undefined,
                            version: typeof parsed['version'] === 'string' ? parsed['version'] : undefined,
                        };
                    }
                }
                catch {
                    // ignore malformed JSON and keep searching parent
                }
            }
            const parent = path.dirname(currentDir);
            if (parent === currentDir) {
                break;
            }
            currentDir = parent;
        }
        return undefined;
    }
    static readProjectDetails(rootDir, configFilePath) {
        const pkgPath = path.join(rootDir, 'package.json');
        let name;
        let version;
        if (fs.existsSync(pkgPath)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                name = typeof parsed['name'] === 'string' ? parsed['name'] : undefined;
                version = typeof parsed['version'] === 'string' ? parsed['version'] : undefined;
            }
            catch {
                // ignore
            }
        }
        return {
            rootDir,
            packageJsonPath: fs.existsSync(pkgPath) ? pkgPath : undefined,
            configFilePath,
            name,
            version,
        };
    }
    static assertSafePath(targetPath, rootDir) {
        const resolvedTarget = path.resolve(rootDir, targetPath);
        const resolvedRoot = path.resolve(rootDir);
        if (!resolvedTarget.startsWith(resolvedRoot)) {
            throw new Error(`Path traversal detected: "${targetPath}" is outside project root "${rootDir}".`);
        }
        return resolvedTarget;
    }
}
//# sourceMappingURL=project.js.map