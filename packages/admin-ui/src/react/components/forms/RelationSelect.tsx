import React, { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { useAdmin, AdminResource, AdminResourceField } from '../../context/AdminContext.js';
import { Drawer } from '../layout/Drawer.js';
import { DynamicForm } from './DynamicForm.js';

interface Option {
  id: string | number;
  label: string;
}

const LABEL_KEYS = ['name', 'title', 'label', 'displayName', 'username', 'email', 'slug', 'code'];

function toOption(resource: AdminResource, item: Record<string, any>): Option {
  const pk = resource.primaryKey || 'id';
  const id = item[pk] ?? item.id ?? item._id;
  const key =
    LABEL_KEYS.find((k) => item[k]) ??
    resource.listDisplay?.find((k) => k !== pk && typeof item[k] === 'string' && item[k]);
  return { id, label: key ? `${item[key]} (#${id})` : `${resource.label} #${id}` };
}

export interface RelationSelectProps {
  field: AdminResourceField;
  value: unknown;
  onChange: (value: string | number | null) => void;
}

/** Foreign key picker: searchable options, plus add / edit of the related record in a side drawer. */
export const RelationSelect: React.FC<RelationSelectProps> = ({ field, value, onChange }) => {
  const { fetchApi, resources } = useAdmin();
  const related = resources.find((r) => r.id === field.relatedResource);
  const relatedId = related?.id;

  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState<Option | null>(null);
  const [loading, setLoading] = useState(Boolean(field.relatedResource));
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [drawer, setDrawer] = useState<'new' | 'edit' | null>(null);

  // Options load once per related resource (and per search term) - not on every render.
  useEffect(() => {
    if (!related) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(
      () => {
        const q = search ? `&search=${encodeURIComponent(search)}` : '';
        fetchApi<any>(`/resources/${relatedId}?pageSize=100${q}`)
          .then((res) => {
            if (cancelled) return;
            const items: any[] = res?.items ?? [];
            setOptions(items.map((it) => toOption(related, it)));
            setHasMore(Boolean(res?.hasMore) || (res?.total ?? 0) > items.length);
          })
          .catch(() => !cancelled && setOptions([]))
          .finally(() => !cancelled && setLoading(false));
      },
      search ? 250 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Keyed on the id: `related` is a new object after every resources refresh.
  }, [relatedId, search, fetchApi]);

  const isEmpty = value === null || value === undefined || value === '';
  const inOptions = options.some((o) => String(o.id) === String(value));

  // The current value may be outside the first page of options: load it by id.
  useEffect(() => {
    if (!related || loading || isEmpty || inOptions || String(selected?.id) === String(value))
      return;
    let cancelled = false;
    fetchApi<any>(`/resources/${relatedId}/${encodeURIComponent(String(value))}`)
      .then((res) => !cancelled && setSelected(toOption(related, res?.item ?? res)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [relatedId, value, inOptions, loading, fetchApi]);

  if (!related) {
    return (
      <div>
        <input
          id={`field-${field.name}`}
          className="chakra-input"
          value={isEmpty ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
        />
        <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 4 }}>
          Related resource {field.relatedResource ? `"${field.relatedResource}" ` : ''}is not
          registered in the admin; enter the id.
        </div>
      </div>
    );
  }

  const all =
    selected && !inOptions && String(selected.id) === String(value)
      ? [selected, ...options]
      : options;

  const handleSaved = (item: Record<string, any>) => {
    const opt = toOption(related, item);
    setOptions((prev) => [opt, ...prev.filter((o) => String(o.id) !== String(opt.id))]);
    setSelected(opt);
    onChange(opt.id);
    setDrawer(null);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {(hasMore || search) && (
          <input
            type="search"
            className="chakra-input"
            style={{ flex: '1 1 140px', maxWidth: 200 }}
            placeholder={`Search ${related.pluralLabel.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={`Search ${related.pluralLabel}`}
          />
        )}
        <select
          id={`field-${field.name}`}
          className="chakra-input"
          style={{ flex: '2 1 200px' }}
          value={isEmpty ? '' : String(value)}
          required={field.required}
          onChange={(e) => {
            const opt = all.find((o) => String(o.id) === e.target.value);
            onChange(opt ? opt.id : null);
          }}
        >
          <option value="">
            {loading ? 'Loading...' : `Select ${related.label.toLowerCase()}...`}
          </option>
          {all.map((opt) => (
            <option key={String(opt.id)} value={String(opt.id)}>
              {opt.label}
            </option>
          ))}
        </select>
        {!isEmpty && (
          <button
            type="button"
            className="chakra-button subtle"
            style={{ padding: '0.45rem 0.6rem' }}
            onClick={() => setDrawer('edit')}
            title={`Edit selected ${related.label.toLowerCase()}`}
            aria-label={`Edit selected ${related.label}`}
          >
            <Pencil style={{ width: 14, height: 14 }} />
          </button>
        )}
        <button
          type="button"
          className="chakra-button subtle"
          style={{ padding: '0.45rem 0.6rem' }}
          onClick={() => setDrawer('new')}
          title={`Add new ${related.label.toLowerCase()}`}
        >
          <Plus style={{ width: 14, height: 14 }} /> New
        </button>
      </div>

      {drawer && (
        <Drawer
          title={drawer === 'new' ? `Add ${related.label}` : `Change ${related.label}`}
          onClose={() => setDrawer(null)}
        >
          <DynamicForm
            resource={related}
            recordId={drawer === 'edit' ? String(value) : null}
            embedded
            onSaved={handleSaved}
            onCancel={() => setDrawer(null)}
          />
        </Drawer>
      )}
    </>
  );
};
