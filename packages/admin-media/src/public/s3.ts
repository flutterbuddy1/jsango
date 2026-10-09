import * as crypto from 'node:crypto';
import type { IMediaStorage } from './storage.js';
import { buildMediaKey, mimeFromName } from './storage.js';
import type { MediaFile, MediaUploadOptions, MediaDeleteOptions } from './types.js';

export interface S3MediaStorageOptions {
  readonly bucket: string;
  /** AWS region; use 'auto' for Cloudflare R2. Default 'us-east-1'. */
  readonly region?: string | undefined;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string | undefined;
  /**
   * S3-compatible endpoint (Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2...), e.g.
   * `https://<account>.r2.cloudflarestorage.com`. Uses path-style URLs. Default: AWS S3.
   */
  readonly endpoint?: string | undefined;
  /** Public base URL for files (bucket website / CDN). Without it, previews use signed URLs. */
  readonly publicUrl?: string | undefined;
  /**
   * Folder of the bucket the admin may use. Keys outside it can't be listed, read or deleted, so
   * sharing a bucket with private app files is safe. Default `uploads`.
   */
  readonly root?: string | undefined;
}

// Served inline; anything else (incl. SVG and HTML, which can run scripts) downloads.
const INLINE_TYPES = /^(image\/(png|jpeg|gif|webp|avif|x-icon)|video\/|audio\/|application\/pdf$)/;

const sha256 = (data: string) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key: crypto.BinaryLike, data: string) =>
  crypto.createHmac('sha256', key).update(data).digest();
const rfc3986 = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
const encodeKey = (key: string) => key.split('/').map(rfc3986).join('/');

/**
 * Stores files in Amazon S3 or any S3-compatible service. Every request uses a SigV4 presigned
 * URL and `fetch`, so no AWS SDK is needed.
 */
export class S3MediaStorage implements IMediaStorage {
  private readonly options: S3MediaStorageOptions;
  private readonly region: string;
  private readonly root: string;

  constructor(options: S3MediaStorageOptions) {
    this.options = options;
    this.region = options.region ?? 'us-east-1';
    this.root = (options.root ?? 'uploads').replace(/^\/+|\/+$/g, '');
  }

  /** SigV4 query-string presigned URL (exposed for tests). */
  public presign(
    method: string,
    key: string,
    expiresInSeconds = 3600,
    extraQuery: Record<string, string> = {},
    now = new Date()
  ): string {
    const { bucket, endpoint, accessKeyId, secretAccessKey, sessionToken } = this.options;
    const base = endpoint
      ? new URL(endpoint)
      : new URL(
          `https://${bucket}.s3${this.region === 'us-east-1' ? '' : `.${this.region}`}.amazonaws.com`
        );
    const pathname = (endpoint ? `/${bucket}/` : '/') + encodeKey(key);
    const amzDate = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
    const scope = `${amzDate.slice(0, 8)}/${this.region}/s3/aws4_request`;

    const query: Record<string, string> = {
      ...extraQuery,
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKeyId}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-SignedHeaders': 'host',
      ...(sessionToken ? { 'X-Amz-Security-Token': sessionToken } : {}),
    };
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${rfc3986(k)}=${rfc3986(query[k]!)}`)
      .join('&');
    const canonicalRequest = [
      method,
      pathname,
      canonicalQuery,
      `host:${base.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
    let signingKey = hmac(`AWS4${secretAccessKey}`, amzDate.slice(0, 8));
    for (const part of [this.region, 's3', 'aws4_request']) signingKey = hmac(signingKey, part);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return `${base.origin}${pathname}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }

  private async request(
    method: string,
    key: string,
    init: RequestInit = {},
    query: Record<string, string> = {}
  ) {
    const res = await fetch(this.presign(method, key, 300, query), { method, ...init });
    if (!res.ok && res.status !== 404) {
      throw new Error(`S3 ${method} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    return res;
  }

  /** Throws for keys outside `root`. */
  private inside(key: string): string {
    if (!key.startsWith(`${this.root}/`) || key.split('/').includes('..')) {
      throw new Error(`S3 key "${key}" is outside the "${this.root}" folder.`);
    }
    return key;
  }

  private publicUrlOf(key: string): string | undefined {
    return (
      this.options.publicUrl && `${this.options.publicUrl.replace(/\/$/, '')}/${encodeKey(key)}`
    );
  }

  private describe(key: string, size: number, mimeType = mimeFromName(key)): MediaFile {
    return {
      key,
      originalName: key
        .split('/')
        .pop()!
        .replace(/^[a-z0-9]+-/, ''),
      mimeType,
      size,
      url: this.publicUrlOf(key) ?? this.presign('GET', key),
    };
  }

  public async store(options: MediaUploadOptions): Promise<MediaFile> {
    const key = buildMediaKey(options.originalName, `${this.root}/${options.prefix ?? ''}`);
    await this.request('PUT', key, {
      body: options.content as Uint8Array<ArrayBuffer>,
      headers: {
        'content-type': options.mimeType,
        ...(INLINE_TYPES.test(options.mimeType) ? {} : { 'content-disposition': 'attachment' }),
      },
    });
    return this.describe(key, options.content.byteLength, options.mimeType);
  }

  public async get(key: string): Promise<MediaFile | undefined> {
    const res = await this.request('HEAD', this.inside(key));
    if (res.status === 404) return undefined;
    return this.describe(
      key,
      Number(res.headers.get('content-length') ?? 0),
      res.headers.get('content-type') ?? undefined
    );
  }

  public async delete(options: MediaDeleteOptions): Promise<void> {
    await this.request('DELETE', this.inside(options.key));
  }

  public async url(key: string, expiresInSeconds?: number): Promise<string> {
    this.inside(key);
    return this.publicUrlOf(key) ?? this.presign('GET', key, expiresInSeconds);
  }

  // ponytail: first 1000 objects only; follow ContinuationToken if buckets get bigger
  public async list(prefix = ''): Promise<MediaFile[]> {
    const res = await this.request(
      'GET',
      '',
      {},
      { 'list-type': '2', prefix: `${this.root}/${prefix.replace(/^\/+/, '')}` }
    );
    const xml = await res.text();
    return [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, c]) => {
      const key = decodeXml(/<Key>([\s\S]*?)<\/Key>/.exec(c!)?.[1] ?? '');
      return this.describe(key, Number(/<Size>(\d+)<\/Size>/.exec(c!)?.[1] ?? 0));
    });
  }
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
