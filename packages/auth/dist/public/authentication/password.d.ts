export interface IPasswordHasher {
    hash(password: string): Promise<string>;
    verify(password: string, hash: string): Promise<boolean>;
    needsRehash(hash: string): boolean;
}
export interface ScryptOptions {
    readonly cost?: number | undefined;
    readonly blockSize?: number | undefined;
    readonly parallelization?: number | undefined;
    readonly keyLength?: number | undefined;
    readonly saltLength?: number | undefined;
}
export declare class ScryptPasswordHasher implements IPasswordHasher {
    readonly cost: number;
    readonly blockSize: number;
    readonly parallelization: number;
    readonly keyLength: number;
    readonly saltLength: number;
    constructor(options?: ScryptOptions);
    hash(password: string): Promise<string>;
    verify(password: string, hash: string): Promise<boolean>;
    needsRehash(hash: string): boolean;
}
//# sourceMappingURL=password.d.ts.map