import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../../context/AdminContext.js';
import { Save, ArrowLeft, Trash2, Upload, Image as ImageIcon, FileText, Plus, Play, X, ExternalLink, } from 'lucide-react';
export const DynamicForm = ({ resource, recordId }) => {
    const { fetchApi, showToast, setRoute, setBreadcrumbs } = useAdmin();
    const [formData, setFormData] = useState({});
    const [inlineData, setInlineData] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    // Relation Options Cache: { [relatedResource]: Array<{ id, label }> }
    const [relationOptions, setRelationOptions] = useState({});
    const [relationLoading, setRelationLoading] = useState({});
    const isEditMode = Boolean(recordId);
    useEffect(() => {
        setBreadcrumbs([
            { label: resource.pluralLabel, href: `#changelist/${resource.id}` },
            { label: isEditMode ? `Edit ${resource.label} #${recordId}` : `Add ${resource.label}` },
        ]);
    }, [resource, recordId, isEditMode, setBreadcrumbs]);
    // Load Relation Options for foreign keys
    const loadRelationOptions = useCallback(async (relatedResId) => {
        if (relationOptions[relatedResId] || relationLoading[relatedResId])
            return;
        setRelationLoading((prev) => ({ ...prev, [relatedResId]: true }));
        try {
            const res = await fetchApi(`/resources/${relatedResId}?pageSize=50`);
            const dataObj = res?.data || res || {};
            const items = dataObj.items || dataObj.records || (Array.isArray(dataObj) ? dataObj : []);
            const mapped = items.map((it) => ({
                id: String(it.id ?? it._id ?? it.uuid),
                label: String(it.name || it.title || it.label || it.email || it.username || it.id),
            }));
            setRelationOptions((prev) => ({ ...prev, [relatedResId]: mapped }));
        }
        catch {
            // Fallback silently if related resource not mounted
        }
        finally {
            setRelationLoading((prev) => ({ ...prev, [relatedResId]: false }));
        }
    }, [fetchApi, relationOptions, relationLoading]);
    // Trigger relation loaders for all relation fields
    useEffect(() => {
        for (const f of resource.fields) {
            if (f.type === 'relation' && f.relatedResource) {
                loadRelationOptions(f.relatedResource);
            }
        }
    }, [resource.fields, loadRelationOptions]);
    // Load existing record if in Edit mode
    useEffect(() => {
        if (!isEditMode || !recordId) {
            // Set initial defaults
            const defaults = {};
            for (const f of resource.fields) {
                if (f.type === 'boolean')
                    defaults[f.name] = false;
                else if (f.type === 'number')
                    defaults[f.name] = 0;
                else
                    defaults[f.name] = '';
            }
            setFormData(defaults);
            return;
        }
        setLoading(true);
        fetchApi(`/resources/${resource.id}/${recordId}`)
            .then((res) => {
            const record = res?.data?.item ??
                res?.item ??
                res?.data?.record ??
                res?.record ??
                (res?.data && typeof res.data === 'object' && !('item' in res.data) ? res.data : res) ??
                {};
            setFormData(record);
            // Check if record has inline child lists
            if (resource.inlines && resource.inlines.length > 0) {
                const inlinesObj = {};
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
    const handleChange = (fieldName, value) => {
        setFormData((prev) => ({ ...prev, [fieldName]: value }));
        if (errors[fieldName]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[fieldName];
                return next;
            });
        }
    };
    // Handle File / Image Upload
    const handleFileUpload = (fieldName, e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const dataUri = String(evt.target?.result || '');
            handleChange(fieldName, dataUri);
            showToast(`File "${file.name}" attached`);
        };
        reader.readAsDataURL(file);
    };
    // Inline Row Management
    const handleAddInlineRow = (inlineName, inlineFields) => {
        const newRow = { _inlineId: 'row_' + Date.now() };
        for (const f of inlineFields) {
            newRow[f.name] = f.type === 'number' ? 0 : f.type === 'boolean' ? false : '';
        }
        setInlineData((prev) => ({
            ...prev,
            [inlineName]: [...(prev[inlineName] || []), newRow],
        }));
    };
    const handleUpdateInlineCell = (inlineName, rowIdx, fieldName, value) => {
        setInlineData((prev) => {
            const rows = [...(prev[inlineName] || [])];
            if (rows[rowIdx]) {
                rows[rowIdx] = { ...rows[rowIdx], [fieldName]: value };
            }
            return { ...prev, [inlineName]: rows };
        });
    };
    const handleDeleteInlineRow = (inlineName, rowIdx) => {
        setInlineData((prev) => {
            const rows = [...(prev[inlineName] || [])];
            rows.splice(rowIdx, 1);
            return { ...prev, [inlineName]: rows };
        });
    };
    const handleSubmit = async (e, continueEditing = false) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});
        try {
            // Clean up payload (exclude id if creating, convert numbers)
            const payload = {};
            for (const [k, v] of Object.entries(formData)) {
                if (!isEditMode && (k === 'id' && !v))
                    continue;
                const fieldDef = resource.fields.find((f) => f.name === k);
                if (fieldDef?.type === 'number' && v !== '' && v !== null && v !== undefined) {
                    payload[k] = Number(v);
                }
                else if (fieldDef?.type === 'boolean') {
                    payload[k] = Boolean(v);
                }
                else {
                    payload[k] = v;
                }
            }
            // Attach inline children if present
            for (const [inlineKey, inlineRows] of Object.entries(inlineData)) {
                payload[inlineKey] = inlineRows;
            }
            if (isEditMode) {
                await fetchApi(`/resources/${resource.id}/${recordId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                showToast(`${resource.label} updated successfully`);
            }
            else {
                const res = await fetchApi(`/resources/${resource.id}`, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                showToast(`${resource.label} created successfully`);
                const createdItem = res?.data?.item || res?.item || res?.data || res;
                const newId = createdItem?.id ?? createdItem?._id;
                if (continueEditing && newId) {
                    setRoute(`#changeform/${resource.id}/${newId}`);
                    return;
                }
            }
            if (!continueEditing) {
                setRoute(`#changelist/${resource.id}`);
            }
        }
        catch (err) {
            showToast(err.message || 'Error saving record', 'error');
        }
        finally {
            setSaving(false);
        }
    };
    const handleDelete = async () => {
        if (!recordId || !confirm(`Are you sure you want to delete this ${resource.label}?`))
            return;
        try {
            await fetchApi(`/resources/${resource.id}/${recordId}`, { method: 'DELETE' });
            showToast(`${resource.label} deleted successfully`);
            setRoute(`#changelist/${resource.id}`);
        }
        catch (err) {
            showToast(err.message, 'error');
        }
    };
    // Custom Action Execution in Form
    const handleExecuteAction = async (action) => {
        if (!recordId)
            return;
        if (action.requiresConfirmation) {
            const msg = action.confirmationMessage || `Execute action "${action.label}" on this ${resource.label}?`;
            if (!confirm(msg))
                return;
        }
        try {
            const res = await fetchApi(`/resources/${resource.id}/${recordId}/actions/${action.id}`, {
                method: 'POST',
            });
            const resultMsg = res?.data?.result || res?.result || `Action "${action.label}" executed successfully`;
            showToast(typeof resultMsg === 'string' ? resultMsg : `Action "${action.label}" executed successfully`);
        }
        catch (err) {
            showToast(err.message || `Failed to execute action ${action.label}`, 'error');
        }
    };
    const renderFieldInput = (field) => {
        const val = formData[field.name];
        if (field.readOnly && isEditMode) {
            return (_jsx("input", { type: "text", className: "chakra-input", value: String(val ?? (field.name === 'id' ? recordId : '') ?? ''), disabled: true, style: { background: 'var(--chakra-colors-bg-muted)', opacity: 0.8 } }));
        }
        // Relation Field (Searchable Picker)
        if (field.type === 'relation') {
            const relatedRes = field.relatedResource || 'users';
            const options = relationOptions[relatedRes] || [];
            const isLoadingRel = relationLoading[relatedRes];
            return (_jsxs("div", { style: { display: 'flex', gap: '0.5rem', alignItems: 'center' }, children: [_jsxs("select", { id: `field-${field.name}`, className: "chakra-input", value: String(val ?? ''), required: field.required, onChange: (e) => handleChange(field.name, e.target.value), children: [_jsx("option", { value: "", children: isLoadingRel ? 'Loading relations...' : `Select ${field.label}...` }), options.map((opt) => (_jsxs("option", { value: opt.id, children: [opt.label, " (", opt.id, ")"] }, opt.id)))] }), _jsx("a", { href: `#changelist/${relatedRes}`, target: "_blank", rel: "noreferrer", className: "chakra-button subtle", style: { padding: '0.45rem 0.6rem' }, title: `Open ${relatedRes} directory`, children: _jsx(ExternalLink, { style: { width: 14, height: 14 } }) })] }));
        }
        // File / Image Upload Field
        if (field.type === 'file' || field.type === 'image') {
            const isImage = field.type === 'image' || String(val).startsWith('data:image/');
            return (_jsx("div", { children: val ? (_jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.75rem',
                        background: 'var(--chakra-colors-bg-subtle)',
                        border: '1px solid var(--chakra-colors-border-subtle)',
                        borderRadius: 8,
                        marginBottom: '0.5rem',
                    }, children: [isImage ? (_jsx("img", { src: val, alt: field.label, style: { width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--chakra-colors-border-default)' } })) : (_jsx(FileText, { style: { width: 28, height: 28, color: 'var(--chakra-colors-brand-fg)' } })), _jsxs("div", { style: { flex: 1, fontSize: '0.8125rem' }, children: [_jsx("div", { style: { fontWeight: 600 }, children: "Attached File" }), _jsx("div", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)' }, children: isImage ? 'Image preview active' : 'File uploaded' })] }), _jsx("button", { type: "button", className: "chakra-button ghost", style: { color: '#ef4444' }, onClick: () => handleChange(field.name, ''), title: "Remove file", children: _jsx(X, { style: { width: 16, height: 16 } }) })] })) : (_jsxs("label", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        border: '1.5px dashed var(--chakra-colors-border-default)',
                        borderRadius: 8,
                        padding: '1.25rem',
                        cursor: 'pointer',
                        background: 'var(--chakra-colors-bg-subtle)',
                    }, children: [_jsx("input", { type: "file", accept: field.type === 'image' ? 'image/*' : '*', style: { display: 'none' }, onChange: (e) => handleFileUpload(field.name, e) }), field.type === 'image' ? (_jsx(ImageIcon, { style: { width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' } })) : (_jsx(Upload, { style: { width: 18, height: 18, color: 'var(--chakra-colors-brand-fg)' } })), _jsxs("span", { style: { fontSize: '0.8125rem', fontWeight: 600 }, children: ["Upload ", field.type === 'image' ? 'Image' : 'File'] })] })) }));
        }
        if (field.type === 'textarea') {
            return (_jsx("textarea", { id: `field-${field.name}`, className: "chakra-input", style: { minHeight: 110, resize: 'vertical', fontFamily: 'inherit' }, value: val ?? '', placeholder: `Enter ${field.label.toLowerCase()}...`, required: field.required, onChange: (e) => handleChange(field.name, e.target.value) }));
        }
        if (field.type === 'enum' || field.choices) {
            return (_jsxs("select", { id: `field-${field.name}`, className: "chakra-input", value: String(val ?? ''), required: field.required, onChange: (e) => handleChange(field.name, e.target.value), children: [_jsxs("option", { value: "", children: ["Select ", field.label, "..."] }), field.choices?.map((c) => (_jsx("option", { value: String(c.value), children: c.label }, String(c.value))))] }));
        }
        if (field.type === 'boolean') {
            return (_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: 4 }, children: [_jsx("input", { type: "checkbox", checked: Boolean(val), onChange: (e) => handleChange(field.name, e.target.checked), style: { width: 18, height: 18, accentColor: 'var(--chakra-colors-brand-solid)' } }), _jsx("span", { style: { fontSize: '0.875rem' }, children: "Enable / Active" })] }));
        }
        if (field.type === 'number') {
            return (_jsx("input", { id: `field-${field.name}`, type: "number", step: "any", className: "chakra-input", value: val ?? '', placeholder: "0", required: field.required, onChange: (e) => handleChange(field.name, e.target.value === '' ? '' : Number(e.target.value)) }));
        }
        if (field.type === 'json') {
            return (_jsx("textarea", { id: `field-${field.name}`, className: "chakra-input", style: { minHeight: 120, fontFamily: 'var(--chakra-fonts-mono)', fontSize: '0.8125rem' }, value: typeof val === 'object' ? JSON.stringify(val, null, 2) : val ?? '', placeholder: '{"key": "value"}', onChange: (e) => {
                    try {
                        const parsed = JSON.parse(e.target.value);
                        handleChange(field.name, parsed);
                    }
                    catch {
                        handleChange(field.name, e.target.value);
                    }
                } }));
        }
        return (_jsx("input", { id: `field-${field.name}`, type: "text", className: "chakra-input", value: val ?? '', placeholder: `Enter ${field.label.toLowerCase()}...`, required: field.required, onChange: (e) => handleChange(field.name, e.target.value) }));
    };
    if (loading) {
        return (_jsx("div", { style: { padding: '3rem', textAlign: 'center', color: 'var(--chakra-colors-fg-muted)' }, children: "Loading form..." }));
    }
    return (_jsxs("div", { style: { maxWidth: 880 }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [_jsxs("button", { type: "button", className: "chakra-button subtle", style: { padding: '0.35rem 0.6rem' }, onClick: () => setRoute(`#changelist/${resource.id}`), children: [_jsx(ArrowLeft, { style: { width: 14, height: 14 } }), " Back to ", resource.pluralLabel] }), _jsx("div", { children: _jsx("h1", { style: { fontSize: '1.375rem', fontWeight: 800 }, children: isEditMode ? `Change ${resource.label}` : `Add ${resource.label}` }) })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }, children: [isEditMode &&
                                resource.actions?.map((act) => (_jsxs("button", { type: "button", className: "chakra-button subtle", onClick: () => handleExecuteAction(act), children: [_jsx(Play, { style: { width: 13, height: 13 } }), " ", act.label] }, act.id))), isEditMode && (_jsxs("button", { type: "button", className: "chakra-button subtle", style: { color: '#ef4444' }, onClick: handleDelete, children: [_jsx(Trash2, { style: { width: 14, height: 14 } }), " Delete"] }))] })] }), _jsxs("form", { onSubmit: (e) => handleSubmit(e, false), children: [_jsx("div", { className: "chakra-card", style: { marginBottom: '1.25rem' }, children: _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '1.25rem' }, children: (resource.fields && resource.fields.length > 0
                                ? resource.fields
                                : Object.keys(formData).map((k) => ({
                                    name: k,
                                    label: k.charAt(0).toUpperCase() + k.slice(1),
                                    type: typeof formData[k] === 'number'
                                        ? 'number'
                                        : typeof formData[k] === 'boolean'
                                            ? 'boolean'
                                            : 'string',
                                    required: false,
                                    readOnly: k === 'id' || k === 'createdAt' || k === 'updatedAt',
                                }))).map((field) => (_jsxs("div", { className: "chakra-field", children: [_jsxs("label", { htmlFor: `field-${field.name}`, children: [field.label, field.required && _jsx("span", { style: { color: '#ef4444', marginLeft: 3 }, children: "*" })] }), renderFieldInput(field), field.helpText && (_jsx("div", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }, children: field.helpText })), errors[field.name] && (_jsx("div", { style: { fontSize: '0.75rem', color: '#ef4444', marginTop: 2 }, children: errors[field.name] }))] }, field.name))) }) }), resource.inlines?.map((inline) => {
                        const rows = inlineData[inline.name] || [];
                        return (_jsxs("div", { className: "chakra-card", style: { marginBottom: '1.25rem' }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        marginBottom: '1rem',
                                        borderBottom: '1px solid var(--chakra-colors-border-subtle)',
                                        paddingBottom: '0.75rem',
                                    }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700, fontSize: '1rem' }, children: inline.label }), _jsxs("div", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }, children: ["Manage related ", inline.label.toLowerCase(), " entries for this ", resource.label] })] }), _jsxs("button", { type: "button", className: "chakra-button subtle", style: { padding: '0.35rem 0.65rem', fontSize: '0.75rem' }, onClick: () => handleAddInlineRow(inline.name, inline.fields), children: [_jsx(Plus, { style: { width: 13, height: 13 } }), " Add Row"] })] }), rows.length === 0 ? (_jsxs("div", { style: { textAlign: 'center', padding: '1.5rem', color: 'var(--chakra-colors-fg-muted)', fontSize: '0.8125rem' }, children: ["No inline ", inline.label.toLowerCase(), " rows added. Click \"+ Add Row\" to insert items."] })) : (_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { className: "chakra-table", style: { fontSize: '0.8125rem' }, children: [_jsx("thead", { children: _jsxs("tr", { children: [inline.fields.map((f) => (_jsx("th", { children: f.label }, f.name))), _jsx("th", { style: { width: 50, textAlign: 'center' } })] }) }), _jsx("tbody", { children: rows.map((row, rIdx) => (_jsxs("tr", { children: [inline.fields.map((f) => (_jsx("td", { children: _jsx("input", { type: f.type === 'number' ? 'number' : 'text', className: "chakra-input", style: { padding: '0.35rem 0.5rem', fontSize: '0.8125rem' }, value: row[f.name] ?? '', placeholder: `Enter ${f.label.toLowerCase()}...`, onChange: (e) => handleUpdateInlineCell(inline.name, rIdx, f.name, f.type === 'number' ? Number(e.target.value) : e.target.value) }) }, f.name))), _jsx("td", { style: { textAlign: 'center' }, children: _jsx("button", { type: "button", className: "chakra-button ghost", style: { padding: 4, color: '#ef4444' }, onClick: () => handleDeleteInlineRow(inline.name, rIdx), title: "Remove row", children: _jsx(X, { style: { width: 14, height: 14 } }) }) })] }, row._inlineId || rIdx))) })] }) }))] }, inline.name));
                    }), _jsxs("div", { className: "chakra-card", style: {
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            background: 'var(--chakra-colors-bg-card)',
                        }, children: [_jsx("button", { type: "button", className: "chakra-button subtle", onClick: () => setRoute(`#changelist/${resource.id}`), children: "Cancel" }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem' }, children: [_jsx("button", { type: "button", className: "chakra-button subtle", disabled: saving, onClick: (e) => handleSubmit(e, true), children: "Save and continue editing" }), _jsxs("button", { type: "submit", className: "chakra-button solid", disabled: saving, children: [_jsx(Save, { style: { width: 14, height: 14 } }), " ", saving ? 'Saving...' : 'Save'] })] })] })] })] }));
};
//# sourceMappingURL=DynamicForm.js.map