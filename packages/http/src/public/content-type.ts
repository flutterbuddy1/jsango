export const ContentType = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  MULTIPART_FORM_DATA: 'multipart/form-data',
  OCTET_STREAM: 'application/octet-stream',
} as const;

export interface ParsedContentType {
  readonly mediaType: string;
  readonly charset?: string | undefined;
  readonly boundary?: string | undefined;
}

export function parseContentType(header: string | null | undefined): ParsedContentType {
  if (!header || typeof header !== 'string') {
    return { mediaType: '' };
  }

  const parts = header.split(';');
  const mediaType = parts[0]?.trim().toLowerCase() ?? '';

  let charset: string | undefined;
  let boundary: string | undefined;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]?.trim();
    if (!part) continue;
    const equalIdx = part.indexOf('=');
    if (equalIdx === -1) continue;

    const key = part.slice(0, equalIdx).trim().toLowerCase();
    let val = part.slice(equalIdx + 1).trim();

    if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
      val = val.slice(1, -1);
    }

    if (key === 'charset') {
      charset = val.toLowerCase();
    } else if (key === 'boundary') {
      boundary = val;
    }
  }

  return { mediaType, charset, boundary };
}
