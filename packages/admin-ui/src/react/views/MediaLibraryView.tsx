import React, { useEffect, useState } from 'react';
import { Upload, Trash2, Copy, ExternalLink, FileText, HardDrive, RefreshCw } from 'lucide-react';
import { useAdmin } from '../context/AdminContext.js';
import { Drawer } from '../components/layout/Drawer.js';

export interface MediaFile {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

type FetchApi = ReturnType<typeof useAdmin>['fetchApi'];

/** Uploads a file to a media disk (the first one when `disk` is omitted); undefined if none exist. */
export async function uploadMedia(
  fetchApi: FetchApi,
  file: File,
  disk?: string
): Promise<MediaFile | undefined> {
  const target =
    disk ?? (await fetchApi<{ disks?: { name: string }[] }>('/media')).disks?.[0]?.name;
  if (!target) return undefined;
  const res = await fetchApi<{ file: MediaFile }>(`/media/${encodeURIComponent(target)}`, {
    method: 'POST',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-file-name': encodeURIComponent(file.name),
    },
  });
  return res.file;
}

export const isImageUrl = (url: unknown, mime = '') =>
  mime.startsWith('image/') ||
  (typeof url === 'string' &&
    (url.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|svg|avif|ico)(\?|$)/i.test(url)));

const formatSize = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;

export interface MediaLibraryProps {
  /** Picker mode: clicking a file selects it instead of opening the preview. */
  onSelect?: (file: MediaFile) => void;
  /** Only show files whose MIME type starts with this, e.g. 'image/'. */
  accept?: string | undefined;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ onSelect, accept }) => {
  const { fetchApi, showToast } = useAdmin();
  const [disks, setDisks] = useState<string[] | null>(null);
  const [disk, setDisk] = useState('');
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<MediaFile | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    fetchApi<{ disks?: { name: string }[] }>('/media')
      .then((res) => {
        const names = (res.disks ?? []).map((d) => d.name);
        setDisks(names);
        setDisk((d) => d || names[0] || '');
      })
      .catch(() => setDisks([]));
  }, [fetchApi]);

  useEffect(() => {
    if (!disk) return;
    let cancelled = false;
    setLoading(true);
    fetchApi<{ files?: MediaFile[] }>(`/media/${encodeURIComponent(disk)}`)
      .then((res) => !cancelled && setFiles(res.files ?? []))
      .catch((err) => !cancelled && showToast(err.message || 'Failed to load media', 'error'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [disk, reload, fetchApi, showToast]);

  const handleUpload = async (list: FileList | null) => {
    // Copy now: the input's FileList is cleared right after this call.
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    setUploading((n) => n + picked.length);
    for (const file of picked) {
      try {
        const stored = await uploadMedia(fetchApi, file, disk);
        if (stored) setFiles((prev) => [stored, ...prev]);
      } catch (err: any) {
        showToast(`${file.name}: ${err.message || 'upload failed'}`, 'error');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const handleDelete = async (file: MediaFile) => {
    if (!confirm(`Delete "${file.originalName}"? This cannot be undone.`)) return;
    try {
      await fetchApi(`/media/${encodeURIComponent(disk)}?key=${encodeURIComponent(file.key)}`, {
        method: 'DELETE',
      });
      setFiles((prev) => prev.filter((f) => f.key !== file.key));
      setPreview(null);
      showToast('File deleted');
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  const copyUrl = (file: MediaFile) => {
    const url = new URL(file.url, window.location.href).href;
    navigator.clipboard?.writeText(url).then(
      () => showToast('URL copied'),
      () => showToast(url, 'info')
    );
  };

  if (disks === null) {
    return (
      <div style={{ padding: '2rem', color: 'var(--chakra-colors-fg-muted)' }}>
        Loading media...
      </div>
    );
  }

  if (disks.length === 0) {
    return (
      <div className="chakra-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <HardDrive style={{ width: 28, height: 28, color: 'var(--chakra-colors-fg-muted)' }} />
        <h3 style={{ marginTop: 8 }}>No media storage configured</h3>
        <p style={{ color: 'var(--chakra-colors-fg-muted)', fontSize: '0.8125rem', marginTop: 4 }}>
          Pass <code>media: {'{ local: new LocalDiskMediaStorage() }'}</code> to{' '}
          <code>app.admin()</code>.
        </p>
      </div>
    );
  }

  const visible = files
    .filter((f) => !accept || f.mimeType.startsWith(accept))
    .filter((f) => !query || f.originalName.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (a.key.split('/').pop()! < b.key.split('/').pop()! ? 1 : -1));

  return (
    <div>
      <div className="media-toolbar">
        {disks.length > 1 && (
          <div className="media-disk-tabs" role="tablist" aria-label="Storage disks">
            {disks.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === disk}
                className={`chakra-button ${d === disk ? 'solid' : 'subtle'}`}
                onClick={() => setDisk(d)}
              >
                <HardDrive style={{ width: 13, height: 13 }} /> {d}
              </button>
            ))}
          </div>
        )}
        <input
          type="search"
          className="chakra-input"
          style={{ flex: '1 1 180px', maxWidth: 280 }}
          placeholder="Search files..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search files"
        />
        <button
          type="button"
          className="chakra-button subtle"
          onClick={() => setReload((n) => n + 1)}
          aria-label="Refresh"
          title="Refresh"
        >
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
        <label className="chakra-button solid" style={{ cursor: 'pointer' }}>
          <Upload style={{ width: 14, height: 14 }} />
          {uploading ? `Uploading ${uploading}...` : 'Upload'}
          <input
            type="file"
            multiple
            accept={accept ? `${accept}*` : undefined}
            style={{ display: 'none' }}
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <div
        className={`media-dropzone ${dragOver ? 'active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleUpload(e.dataTransfer.files);
        }}
      >
        {loading ? (
          <div className="media-empty">Loading files...</div>
        ) : visible.length === 0 ? (
          <div className="media-empty">
            {query
              ? 'No files match your search.'
              : 'No files yet. Drop files here or click Upload.'}
          </div>
        ) : (
          <div className="media-grid">
            {visible.map((f) => (
              <button
                key={f.key}
                type="button"
                className="media-card"
                onClick={() => (onSelect ? onSelect(f) : setPreview(f))}
                title={f.originalName}
              >
                <div className="media-thumb">
                  {isImageUrl(f.url, f.mimeType) ? (
                    <img src={f.url} alt={f.originalName} loading="lazy" />
                  ) : (
                    <>
                      <FileText style={{ width: 28, height: 28 }} />
                      <span>{f.originalName.split('.').pop()?.toUpperCase()}</span>
                    </>
                  )}
                </div>
                <div className="media-name">{f.originalName}</div>
                <div className="media-meta">{formatSize(f.size)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <Drawer title={preview.originalName} onClose={() => setPreview(null)} width={640}>
          <div className="media-preview">
            {isImageUrl(preview.url, preview.mimeType) ? (
              <img src={preview.url} alt={preview.originalName} />
            ) : preview.mimeType.startsWith('video/') ? (
              <video src={preview.url} controls />
            ) : preview.mimeType.startsWith('audio/') ? (
              <audio src={preview.url} controls />
            ) : (
              <FileText style={{ width: 48, height: 48, color: 'var(--chakra-colors-fg-muted)' }} />
            )}
          </div>
          <dl className="media-details">
            <dt>Key</dt>
            <dd>{preview.key}</dd>
            <dt>Type</dt>
            <dd>{preview.mimeType}</dd>
            <dt>Size</dt>
            <dd>{formatSize(preview.size)}</dd>
            <dt>Disk</dt>
            <dd>{disk}</dd>
          </dl>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button type="button" className="chakra-button subtle" onClick={() => copyUrl(preview)}>
              <Copy style={{ width: 14, height: 14 }} /> Copy URL
            </button>
            <a className="chakra-button subtle" href={preview.url} target="_blank" rel="noreferrer">
              <ExternalLink style={{ width: 14, height: 14 }} /> Open
            </a>
            <button
              type="button"
              className="chakra-button subtle"
              style={{ color: '#ef4444', marginLeft: 'auto' }}
              onClick={() => handleDelete(preview)}
            >
              <Trash2 style={{ width: 14, height: 14 }} /> Delete
            </button>
          </div>
        </Drawer>
      )}
    </div>
  );
};

export const MediaLibraryView: React.FC = () => {
  const { setBreadcrumbs } = useAdmin();
  useEffect(() => setBreadcrumbs([{ label: 'Media' }]), [setBreadcrumbs]);
  return (
    <div>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '1rem' }}>Media Library</h1>
      <MediaLibrary />
    </div>
  );
};
