export declare const ContentType: {
    readonly JSON: "application/json";
    readonly TEXT: "text/plain";
    readonly HTML: "text/html";
    readonly FORM_URLENCODED: "application/x-www-form-urlencoded";
    readonly MULTIPART_FORM_DATA: "multipart/form-data";
    readonly OCTET_STREAM: "application/octet-stream";
};
export interface ParsedContentType {
    readonly mediaType: string;
    readonly charset?: string | undefined;
    readonly boundary?: string | undefined;
}
export declare function parseContentType(header: string | null | undefined): ParsedContentType;
//# sourceMappingURL=content-type.d.ts.map