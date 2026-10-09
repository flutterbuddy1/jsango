import React, { useState, useEffect } from 'react';
import { useAdmin, AdminResource, AdminResourceField, AdminCustomAction } from '../../context/AdminContext.js';
import {
  Save,
  ArrowLeft,
  Trash2,
  Upload,
  Image as ImageIcon,
  FileText,
  Plus,
  Play,
  X,
  FolderOpen,
} from 'lucide-react';
import { RelationSelect } from './RelationSelect.js';
import { Drawer } from '../layout/Drawer.js';
import { MediaLibrary, uploadMedia, isImageUrl } from '../../views/MediaLibraryView.js';

export interface DynamicFormProps {
  resource: AdminResource;
  recordId?: string | null;
  /** Rendered inside a drawer (e.g. "add related record"): no routing, breadcrumbs or delete. */
  embedded?: boolean;
  /** Called with the saved record instead of navigating (embedded mode). */
  onSaved?: (item: Record<string, any>) => void;
  onCancel?: () => void;
}

/** Virtual hasOne / hasMany / manyToMany fields have no column to edit. */
const isVirtualRelation = (f: AdminResourceField) =>
  f.type === 'relation' && Boolean(f.relationType) && f.relationType !== 'belongsTo';

export const DynamicForm: React.FC<DynamicFormProps> = ({
  resource,
  recordId,
  embedded = false,
  onSaved,
  onCancel,
}) => {
  const { fetchApi, showToast, setRoute, setBreadcrumbs } = useAdmin();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [inlineData, setInlineData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(Boolean(recordId));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [mediaPicker, setMediaPicker] = useState<AdminResourceField | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const isEditMode = Boolean(recordId);

  useEffect(() => {
    if (embedded) return;
    setBreadcrumbs([
      { label: resource.pluralLabel, href: `#changelist/${resource.id}` },
      { label: isEditMode ? `Edit ${resource.label} #${recordId}` : `Add ${resource.label}` },
    ]);
  }, [resource, recordId, isEditMode, embedded, setBreadcrumbs]);

  // Load existing record if in Edit mode
  useEffect(() => {
    if (!isEditMode || !recordId) {
      // Set initial defaults
      const defaults: Record<string, any> = {};
      for (const f of resource.fields) {
        if (f.readOnly || isVirtualRelation(f)) continue;
        if (f.type === 'boolean') defaults[f.name] = false;
        else if (f.type === 'relation') defaults[f.name] = null;
        else if (f.type === 'number') defaults[f.name] = 0;
        else defaults[f.name] = '';
      }
      setFormData(defaults);
      return;
    }

    setLoading(true);
    fetchApi<any>(`/resources/${resource.id}/${recordId}`)
      .then((res) => {
        const record =
          res?.data?.item ??
          res?.item ??
          res?.data?.record ??
          res?.record ??
          (res?.data && typeof res.data === 'object' && !('item' in res.data) ? res.data : res) ??
          {};
        setFormData(record);

        // Check if record has inline child lists
        if (resource.inlines && resource.inlines.length > 0) {
          const inlinesObj: Record<string, any[]> = {};
          for (const inline of resource.inlines) {
            inlinesObj[inline.name] = Array.isArray(record[inline.name]) ? record[inline.name] : [];
          }
          setInlineData(inlinesObj);
        }
      })
      .catch((err) => {
        showToast(err.message || 'Failed to load record', 'error');
      })
      .finally(() => setLoading(false));
  }, [resource.id, recordId, isEditMode, resource.inlines, fetchApi, showToast]);

  const handleChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    if (errors[fieldName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  // Handle File / Image Upload: stored on the first media disk, inlined as a data URI without one.
  const handleFileUpload = async (fieldName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(fieldName);
    try {
      const stored = await uploadMedia(fetchApi, file).catch((err) => {
        if (/HTTP 404/.test(err.message)) return undefined; // no media API
        throw err;
      });
      if (stored) {
        handleChange(fieldName, stored.url);
        showToast(`File "${file.name}" uploaded`);
        return;
      }
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
      return;
    } finally {
      setUploadingField(null);
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUri = String(evt.target?.result || '');
      handleChange(fieldName, dataUri);
      showToast(`File "${file.name}" attached`);
    };
    reader.readAsDataURL(file);
  };

  // Inline Row Management
  const handleAddInlineRow = (inlineName: string, inlineFields: AdminResourceField[]) => {
    const newRow: Record<string, any> = { _inlineId: 'row_' + Date.now() };
    for (const f of inlineFields) {
      newRow[f.name] = f.type === 'number' ? 0 : f.type === 'boolean' ? false : '';
    }
    setInlineData((prev) => ({
      ...prev,
      [inlineName]: [...(prev[inlineName] || []), newRow],
    }));
  };

  const handleUpdateInlineCell = (inlineName: string, rowIdx: number, fieldName: string, value: any) => {
    setInlineData((prev) => {
      const rows = [...(prev[inlineName] || [])];
      if (rows[rowIdx]) {
        rows[rowIdx] = { ...rows[rowIdx], [fieldName]: value };
      }
      return { ...prev, [inlineName]: rows };
    });
  };

  const handleDeleteInlineRow = (inlineName: string, rowIdx: number) => {
    setInlineData((prev) => {
      const rows = [...(prev[inlineName] || [])];
      rows.splice(rowIdx, 1);
      return { ...prev, [inlineName]: rows };
    });
  };

  const handleSubmit = async (e: React.FormEvent, continueEditing = false) => {
    e.preventDefault();
    // A form in a drawer is portaled but React still bubbles its events to the parent form.
    e.stopPropagation();
    setSaving(true);
    setErrors({});

    try {
      // Clean up payload (exclude id if creating, convert numbers)
      const payload: Record<string, any> = {};
      for (const [k, v] of Object.entries(formData)) {
        if (!isEditMode && (k === 'id' && !v)) continue;
        const fieldDef = resource.fields.find((f) => f.name === k);
        if (fieldDef && isVirtualRelation(fieldDef)) continue;
        if (fieldDef?.type === 'relation') {
          payload[k] = v === '' || v === undefined ? null : v;
        } else if (fieldDef?.type === 'number' && v !== '' && v !== null && v !== undefined) {
          payload[k] = Number(v);
        } else if (fieldDef?.type === 'boolean') {
          payload[k] = Boolean(v);
        } else {
          payload[k] = v;
        }
      }

      // Attach inline children if present
      for (const [inlineKey, inlineRows] of Object.entries(inlineData)) {
        payload[inlineKey] = inlineRows;
      }

      if (isEditMode) {
        const res = await fetchApi<any>(`/resources/${resource.id}/${recordId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast(`${resource.label} updated successfully`);
        if (onSaved) {
          onSaved(res?.item ?? { ...formData, ...payload });
          return;
        }
      } else {
        const res = await fetchApi<any>(`/resources/${resource.id}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(`${resource.label} created successfully`);
        const createdItem = res?.data?.item || res?.item || res?.data || res;
        if (onSaved) {
          onSaved(createdItem);
          return;
        }
        const newId = createdItem?.id ?? createdItem?._id;
        if (continueEditing && newId) {
          setRoute(`#changeform/${resource.id}/${newId}`);
          return;
        }
      }

      if (!continueEditing) {
        setRoute(`#changelist/${resource.id}`);
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving record', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!recordId || !confirm(`Are you sure you want to delete this ${resource.label}?`)) return;
    try {
      await fetchApi(`/resources/${resource.id}/${recordId}`, { method: 'DELETE' });
      showToast(`${resource.label} deleted successfully`);
      setRoute(`#changelist/${resource.id}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Custom Action Execution in Form
  const handleExecuteAction = async (action: AdminCustomAction) => {
    if (!recordId) return;
    if (action.requiresConfirmation) {
      const msg = action.confirmationMessage || `Execute action "${action.label}" on this ${resource.label}?`;
      if (!confirm(msg)) return;
    }
    try {
      const res = await fetchApi<any>(`/resources/${resource.id}/${recordId}/actions/${action.id}`, {
        method: 'POST',
      });
      const resultMsg = res?.data?.result || res?.result || `Action "${action.label}" executed successfully`;
      showToast(typeof resultMsg === 'string' ? resultMsg : `Action "${action.label}" executed successfully`);
    } catch (err: any) {
      showToast(err.message || `Failed to execute action ${action.label}`, 'error');
    }
  };

  const renderFieldInput = (field: AdminResourceField) => {
    const val = formData[field.name];

    if (field.readOnly && isEditMode) {
      return (
        <input
          type="text"
          className="chakra-input"
          value={String(val ?? (field.name === 'id' ? recordId : '') ?? '')}
          disabled
          style={{ background: 'var(--chakra-colors-bg-muted)', opacity: 0.8 }}
        />
      );
    }

    // Relation Field (Searchable Picker with add / edit drawer)
    if (field.type === 'relation') {
      return (
        <RelationSelect field={field} value={val} onChange={(v) => handleChange(field.name, v)} />
      );
    }

    // File / Image Upload Field
    if (field.type === 'file' || field.type === 'image') {
      const isImage = field.type === 'image' || isImageUrl(val);
      return (
        <div>
          {val ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.75rem',
                background: 'var(--chakra-colors-bg-subtle)',
                border: '1px solid var(--chakra-colors-border-subtle)',
                borderRadius: 8,
                marginBottom: '0.5rem',
              }}
            >
              {isImage ? (
                <img
                  src={val}
                  alt={field.label}
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--chakra-colors-border-default)' }}
                />
              ) : (
                <FileText style={{ width: 28, height: 28, color: 'var(--chakra-colors-brand-fg)' }} />
              )}
              <div style={{ flex: 1, fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 600 }}>Attached File</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', wordBreak: 'break-all' }}>
                  {String(val).startsWith('data:') ? 'Embedded file' : String(val)}
                </div>
              </div>
              <button
                type="button"
                className="chakra-button ghost"
                style={{ color: '#ef4444' }}
                onClick={() => handleChange(field.name, '')}
                title="Remove file"
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label
              style={{
                flex: '1 1 200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                border: '1.5px dashed var(--chakra-colors-border-default)',
                borderRadius: 8,
                padding: '1.25rem',
                cursor: 'pointer',
                background: 'var(--chakra-colors-bg-subtle)',
              }}
            >
              <input
                type="file"
                accept={field.type === 'image' ? 'image/*' : '*'}
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(field.name, e)}
              />
              {field.type === 'image' ? (
                <ImageIcon style={{ width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' }} />
              ) : (
                <Upload style={{ width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' }} />
              )}
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                {uploadingField === field.name
                  ? 'Uploading...'
                  : `Upload ${field.type === 'image' ? 'Image' : 'File'}`}
              </span>
            </label>
            <button
              type="button"
              className="chakra-button subtle"
              onClick={() => setMediaPicker(field)}
              title="Choose from the media library"
            >
              <FolderOpen style={{ width: 15, height: 15 }} /> Library
            </button>
            </div>
          )}
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          id={`field-${field.name}`}
          className="chakra-input"
          style={{ minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }}
          value={val ?? ''}
          placeholder={`Enter ${field.label.toLowerCase()}...`}
          required={field.required}
          onChange={(e) => handleChange(field.name, e.target.value)}
        />
      );
    }

    if (field.type === 'enum' || field.choices) {
      return (
        <select
          id={`field-${field.name}`}
          className="chakra-input"
          value={String(val ?? '')}
          required={field.required}
          onChange={(e) => handleChange(field.name, e.target.value)}
        >
          <option value="">Select {field.label}...</option>
          {field.choices?.map((c) => (
            <option key={String(c.value)} value={String(c.value)}>
              {c.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'boolean') {
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: 4 }}>
          <input
            type="checkbox"
            checked={Boolean(val)}
            onChange={(e) => handleChange(field.name, e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--chakra-colors-brand-solid)' }}
          />
          <span style={{ fontSize: '0.875rem' }}>Enable / Active</span>
        </label>
      );
    }

    if (field.type === 'number') {
      return (
        <input
          id={`field-${field.name}`}
          type="number"
          step="any"
          className="chakra-input"
          value={val ?? ''}
          placeholder="0"
          required={field.required}
          onChange={(e) => handleChange(field.name, e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    }

    if (field.type === 'json') {
      return (
        <textarea
          id={`field-${field.name}`}
          className="chakra-input"
          style={{ minHeight: 120, fontFamily: 'var(--chakra-fonts-mono)', fontSize: '0.8125rem' }}
          value={typeof val === 'object' ? JSON.stringify(val, null, 2) : val ?? ''}
          placeholder='{"key": "value"}'
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              handleChange(field.name, parsed);
            } catch {
              handleChange(field.name, e.target.value);
            }
          }}
        />
      );
    }

    return (
      <input
        id={`field-${field.name}`}
        type="text"
        className="chakra-input"
        value={val ?? ''}
        placeholder={`Enter ${field.label.toLowerCase()}...`}
        required={field.required}
        onChange={(e) => handleChange(field.name, e.target.value)}
      />
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--chakra-colors-fg-muted)' }}>
        Loading form...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: embedded ? undefined : 880 }}>
      {/* Top Header Navigation */}
      {!embedded && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="chakra-button subtle"
            style={{ padding: '0.35rem 0.6rem' }}
            onClick={() => setRoute(`#changelist/${resource.id}`)}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> Back to {resource.pluralLabel}
          </button>
          <div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 800 }}>
              {isEditMode ? `Change ${resource.label}` : `Add ${resource.label}`}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Custom Row Actions in Form */}
          {isEditMode &&
            resource.actions?.map((act) => (
              <button
                key={act.id}
                type="button"
                className="chakra-button subtle"
                onClick={() => handleExecuteAction(act)}
              >
                <Play style={{ width: 13, height: 13 }} /> {act.label}
              </button>
            ))}

          {isEditMode && (
            <button
              type="button"
              className="chakra-button subtle"
              style={{ color: '#ef4444' }}
              onClick={handleDelete}
            >
              <Trash2 style={{ width: 14, height: 14 }} /> Delete
            </button>
          )}
        </div>
      </div>
      )}

      {/* Main Form */}
      <form onSubmit={(e) => handleSubmit(e, false)}>
        <div className="chakra-card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {(resource.fields && resource.fields.length > 0
              ? resource.fields
              : Object.keys(formData).map(
                  (k): AdminResourceField => ({
                    name: k,
                    label: k.charAt(0).toUpperCase() + k.slice(1),
                    type:
                      typeof formData[k] === 'number'
                        ? 'number'
                        : typeof formData[k] === 'boolean'
                        ? 'boolean'
                        : 'string',
                    required: false,
                    readOnly: k === 'id' || k === 'createdAt' || k === 'updatedAt',
                  })
                )
            )
              .filter((field) => !isVirtualRelation(field) && !(field.readOnly && !isEditMode))
              .map((field) => (
              <div key={field.name} className="chakra-field">
                <label htmlFor={`field-${field.name}`}>
                  {field.label}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                </label>
                {renderFieldInput(field)}
                {field.helpText && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
                    {field.helpText}
                  </div>
                )}
                {errors[field.name] && (
                  <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 2 }}>
                    {errors[field.name]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tabular Inline Child Relations */}
        {resource.inlines?.map((inline) => {
          const rows = inlineData[inline.name] || [];
          return (
            <div key={inline.name} className="chakra-card" style={{ marginBottom: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  borderBottom: '1px solid var(--chakra-colors-border-subtle)',
                  paddingBottom: '0.75rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{inline.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
                    Manage related {inline.label.toLowerCase()} entries for this {resource.label}
                  </div>
                </div>

                <button
                  type="button"
                  className="chakra-button subtle"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                  onClick={() => handleAddInlineRow(inline.name, inline.fields)}
                >
                  <Plus style={{ width: 13, height: 13 }} /> Add Row
                </button>
              </div>

              {rows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--chakra-colors-fg-muted)', fontSize: '0.8125rem' }}>
                  No inline {inline.label.toLowerCase()} rows added. Click &quot;+ Add Row&quot; to insert items.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="chakra-table" style={{ fontSize: '0.8125rem' }}>
                    <thead>
                      <tr>
                        {inline.fields.map((f) => (
                          <th key={f.name}>{f.label}</th>
                        ))}
                        <th style={{ width: 50, textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rIdx) => (
                        <tr key={row._inlineId || rIdx}>
                          {inline.fields.map((f) => (
                            <td key={f.name}>
                              <input
                                type={f.type === 'number' ? 'number' : 'text'}
                                className="chakra-input"
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.8125rem' }}
                                value={row[f.name] ?? ''}
                                placeholder={`Enter ${f.label.toLowerCase()}...`}
                                onChange={(e) =>
                                  handleUpdateInlineCell(
                                    inline.name,
                                    rIdx,
                                    f.name,
                                    f.type === 'number' ? Number(e.target.value) : e.target.value
                                  )
                                }
                              />
                            </td>
                          ))}
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="chakra-button ghost"
                              style={{ padding: 4, color: '#ef4444' }}
                              onClick={() => handleDeleteInlineRow(inline.name, rIdx)}
                              title="Remove row"
                            >
                              <X style={{ width: 14, height: 14 }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Action Buttons Bar */}
        <div
          className="chakra-card"
          style={{
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            background: 'var(--chakra-colors-bg-card)',
          }}
        >
          <button
            type="button"
            className="chakra-button subtle"
            onClick={() => (onCancel ? onCancel() : setRoute(`#changelist/${resource.id}`))}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!embedded && (
              <button
                type="button"
                className="chakra-button subtle"
                disabled={saving}
                onClick={(e) => handleSubmit(e, true)}
              >
                Save and continue editing
              </button>
            )}
            <button type="submit" className="chakra-button solid" disabled={saving}>
              <Save style={{ width: 14, height: 14 }} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>

      {mediaPicker && (
        <Drawer title={`Choose ${mediaPicker.label}`} onClose={() => setMediaPicker(null)} width={760}>
          <MediaLibrary
            accept={mediaPicker.type === 'image' ? 'image/' : undefined}
            onSelect={(file) => {
              handleChange(mediaPicker.name, file.url);
              setMediaPicker(null);
            }}
          />
        </Drawer>
      )}
    </div>
  );
};
