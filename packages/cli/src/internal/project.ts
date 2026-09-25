import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ProjectInfo {
  readonly rootDir: string;
  readonly packageJsonPath?: string | undefined;
  readonly configFilePath?: string | undefined;
  readonly name?: string | undefined;
  readonly version?: string | undefined;
}

const CONFIG_FILENAMES = [
  'jsango.config.ts',
  'jsango.config.js',
  'jsango.config.ts',
  'jsango.config.js',
];

export class ProjectDiscovery {
  public static findProjectRoot(startDir: string = process.cwd()): ProjectInfo | undefined {
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
          const parsed = JSON.parse(content) as Record<string, unknown>;
          const deps = {
            ...(parsed['dependencies'] as Record<string, string> | undefined),
            ...(parsed['devDependencies'] as Record<string, string> | undefined),
          };

          const isFrameworkProject =
            parsed['jsango'] !== undefined ||
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
        } catch {
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

  private static readProjectDetails(rootDir: string, configFilePath: string): ProjectInfo {
    const pkgPath = path.join(rootDir, 'package.json');
    let name: string | undefined;
    let version: string | undefined;

    if (fs.existsSync(pkgPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
        name = typeof parsed['name'] === 'string' ? parsed['name'] : undefined;
        version = typeof parsed['version'] === 'string' ? parsed['version'] : undefined;
      } catch {
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

  public static assertSafePath(targetPath: string, rootDir: string): string {
    const resolvedTarget = path.resolve(rootDir, targetPath);
    const resolvedRoot = path.resolve(rootDir);

    if (!resolvedTarget.startsWith(resolvedRoot)) {
      throw new Error(
        `Path traversal detected: "${targetPath}" is outside project root "${rootDir}".`
      );
    }

    return resolvedTarget;
  }
}
