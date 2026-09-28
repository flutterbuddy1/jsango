export interface ProjectInfo {
    readonly rootDir: string;
    readonly packageJsonPath?: string | undefined;
    readonly configFilePath?: string | undefined;
    readonly name?: string | undefined;
    readonly version?: string | undefined;
}
export declare class ProjectDiscovery {
    static findProjectRoot(startDir?: string): ProjectInfo | undefined;
    private static readProjectDetails;
    static assertSafePath(targetPath: string, rootDir: string): string;
}
//# sourceMappingURL=project.d.ts.map