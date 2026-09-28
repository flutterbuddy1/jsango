export interface CookieOptions {
    readonly maxAge?: number;
    readonly expires?: Date;
    readonly domain?: string;
    readonly path?: string;
    readonly secure?: boolean;
    readonly httpOnly?: boolean;
    readonly sameSite?: 'Strict' | 'Lax' | 'None';
    readonly partitioned?: boolean;
}
export interface SetCookieEntry {
    readonly name: string;
    readonly value: string;
    readonly options: CookieOptions;
}
export declare function parseCookies(cookieHeader: string | null | undefined): Readonly<Record<string, string>>;
export declare function serializeCookie(name: string, value: string, options?: CookieOptions): string;
//# sourceMappingURL=cookies.d.ts.map