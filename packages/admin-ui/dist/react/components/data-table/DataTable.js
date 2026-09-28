import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdmin } from '../../context/AdminContext.js';
import { Search, Filter, Plus, Trash2, Download, Upload, Edit2, ChevronLeft, ChevronRight, ArrowUpDown, RefreshCw, Play, FileSpreadsheet, X, CheckCircle2, } from 'lucide-react';
export const DataTable = ({ resource }) => {
    const { fetchApi, showToast, setRoute } = useAdmin();
    const [records, setRecords] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(true);
    // Table Query State
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(resource.listPerPage || 25);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState({});
    const [sortBy, setSortBy] = useState(null);
    const [sortDir, setSortDir] = useState('desc');
    const [selectedIds, setSelectedIds] = useState(new Set());
    // CSV Import Modal State
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [importRows, setImportRows] = useState([]);
    const [importFileName, setImportFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef(null);
    // Columns to display
    const columns = resource.listDisplay && resource.listDisplay.length > 0
        ? resource.listDisplay
        : resource.fields.map((f) => f.name).slice(0, 5);
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', page.toString());
            params.set('pageSize', pageSize.toString());
            if (searchQuery.trim()) {
                params.set('search', searchQuery.trim());
            }
            if (sortBy) {
                params.set('sort', sortBy);
                params.set('sortDirection', sortDir);
            }
            for (const [k, v] of Object.entries(activeFilters)) {
                if (v !== '' && v !== undefined && v !== null) {
                    params.set(`filter_${k}`, String(v));
                }
            }
            const res = await fetchApi(`/resources/${resource.id}?${params.toString()}`);
            const dataObj = res?.data || res || {};
            const items = dataObj.items || dataObj.records || (Array.isArray(dataObj) ? dataObj : []);
            const total = dataObj.total ?? dataObj.totalRecords ?? items.length;
            setRecords(items);
            setTotalRecords(total);
            setSelectedIds(new Set());
        }
        catch (err) {
            showToast(err.message || 'Failed to load records', 'error');
        }
        finally {
            setLoading(false);
        }
    }, [resource.id, page, pageSize, searchQuery, sortBy, sortDir, activeFilters, fetchApi, showToast]);
    useEffect(() => {
        loadData();
    }, [loadData]);
    // Handle Sort
    const handleSort = (col) => {
        if (sortBy === col) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        }
        else {
            setSortBy(col);
            setSortDir('asc');
        }
        setPage(1);
    };
    // Row Selection
    const toggleSelectAll = (checked) => {
        if (checked) {
            setSelectedIds(new Set(records.map((r, i) => r.id ?? r._id ?? r.uuid ?? i)));
        }
        else {
            setSelectedIds(new Set());
        }
    };
    const toggleSelectRow = (id, checked) => {
        const next = new Set(selectedIds);
        if (checked)
            next.add(id);
        else
            next.delete(id);
        setSelectedIds(next);
    };
    // Delete Record
    const handleDelete = async (id) => {
        if (!confirm(`Are you sure you want to delete ${resource.label} #${id}?`))
            return;
        try {
            await fetchApi(`/resources/${resource.id}/${id}`, { method: 'DELETE' });
            showToast(`${resource.label} #${id} deleted successfully`);
            loadData();
        }
        catch (err) {
            showToast(err.message, 'error');
        }
    };
    // Bulk Delete
    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected records?`))
            return;
        try {
            await Promise.all(Array.from(selectedIds).map((id) => fetchApi(`/resources/${resource.id}/${id}`, { method: 'DELETE' })));
            showToast(`${selectedIds.size} records deleted successfully`);
            loadData();
        }
        catch (err) {
            showToast(err.message, 'error');
        }
    };
    // Custom Row Action Execution
    const handleExecuteAction = async (action, rowId) => {
        if (action.requiresConfirmation) {
            const msg = action.confirmationMessage || `Execute action "${action.label}" on ${resource.label} #${rowId}?`;
            if (!confirm(msg))
                return;
        }
        try {
            const res = await fetchApi(`/resources/${resource.id}/${rowId}/actions/${action.id}`, {
                method: 'POST',
            });
            const resultMsg = res?.data?.result || res?.result || `Action "${action.label}" executed successfully`;
            showToast(typeof resultMsg === 'string' ? resultMsg : `Action "${action.label}" executed successfully`);
            loadData();
        }
        catch (err) {
            showToast(err.message || `Failed to execute action ${action.label}`, 'error');
        }
    };
    // Custom Bulk Action Execution
    const handleExecuteBulkAction = async (bulkAction) => {
        if (bulkAction.requiresConfirmation) {
            const msg = bulkAction.confirmationMessage || `Execute bulk action "${bulkAction.label}" on ${selectedIds.size} selected records?`;
            if (!confirm(msg))
                return;
        }
        try {
            const res = await fetchApi(`/resources/${resource.id}/bulk/${bulkAction.id}`, {
                method: 'POST',
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            const resultMsg = res?.data?.result || res?.result || `Bulk action "${bulkAction.label}" executed successfully`;
            showToast(typeof resultMsg === 'string' ? resultMsg : `Bulk action "${bulkAction.label}" executed successfully`);
            loadData();
        }
        catch (err) {
            showToast(err.message || `Failed to execute bulk action ${bulkAction.label}`, 'error');
        }
    };
    // Export CSV
    const handleExportCsv = () => {
        if (records.length === 0)
            return;
        const headers = columns.join(',');
        const rows = records.map((r) => columns.map((col) => `"${String(r[col] ?? '').replace(/"/g, '""')}"`).join(','));
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${resource.id}_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exported ${records.length} records to CSV`);
    };
    // Handle CSV File Upload
    const handleCsvFileSelected = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setImportFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = String(evt.target?.result || '');
            const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
            if (lines.length < 2) {
                showToast('CSV file must contain a header row and at least one data row', 'error');
                return;
            }
            const headers = lines[0]?.split(',').map((h) => h.replace(/^["']|["']$/g, '').trim()) || [];
            const parsedRows = [];
            for (let i = 1; i < lines.length; i++) {
                const currentLine = lines[i];
                if (!currentLine)
                    continue;
                const vals = currentLine.split(',').map((v) => v.replace(/^["']|["']$/g, '').trim());
                const rowObj = {};
                headers.forEach((h, hIdx) => {
                    rowObj[h] = vals[hIdx] ?? '';
                });
                parsedRows.push(rowObj);
            }
            setImportRows(parsedRows);
        };
        reader.readAsText(file);
    };
    // Process Batch Import
    const handleConfirmImport = async () => {
        if (importRows.length === 0)
            return;
        setImporting(true);
        let successCount = 0;
        try {
            for (const row of importRows) {
                try {
                    await fetchApi(`/resources/${resource.id}`, {
                        method: 'POST',
                        body: JSON.stringify(row),
                    });
                    successCount++;
                }
                catch { }
            }
            showToast(`Successfully imported ${successCount} of ${importRows.length} ${resource.pluralLabel}`);
            setImportModalOpen(false);
            setImportRows([]);
            setImportFileName('');
            loadData();
        }
        catch (err) {
            showToast(err.message || 'Import error', 'error');
        }
        finally {
            setImporting(false);
        }
    };
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    return (_jsxs("div", { children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.25rem',
                }, children: [_jsxs("div", { children: [_jsx("h1", { style: { fontSize: '1.5rem', fontWeight: 800 }, children: resource.pluralLabel || resource.label }), _jsxs("div", { style: { fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }, children: ["Manage and query ", resource.pluralLabel.toLowerCase(), " records from the database"] })] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }, children: [_jsxs("button", { type: "button", className: "chakra-button subtle", onClick: loadData, title: "Refresh Data", children: [_jsx(RefreshCw, { style: { width: 14, height: 14 } }), " Refresh"] }), _jsxs("button", { type: "button", className: "chakra-button subtle", onClick: () => setImportModalOpen(true), title: "Import CSV records", children: [_jsx(Upload, { style: { width: 14, height: 14 } }), " Import CSV"] }), _jsxs("button", { type: "button", className: "chakra-button subtle", onClick: handleExportCsv, children: [_jsx(Download, { style: { width: 14, height: 14 } }), " Export CSV"] }), _jsxs("button", { type: "button", className: "chakra-button solid", onClick: () => setRoute(`#changeform/${resource.id}`), children: [_jsx(Plus, { style: { width: 15, height: 15 } }), " Add ", resource.label] })] })] }), _jsxs("div", { className: "chakra-card", style: {
                    padding: '0.875rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 240 }, children: [_jsx(Search, { style: { width: 16, height: 16, color: 'var(--chakra-colors-fg-muted)' } }), _jsx("input", { type: "text", className: "chakra-input", style: { padding: '0.35rem 0.6rem', fontSize: '0.8125rem' }, placeholder: `Search ${resource.pluralLabel.toLowerCase()}...`, value: searchQuery, onChange: (e) => {
                                    setSearchQuery(e.target.value);
                                    setPage(1);
                                } })] }), resource.listFilter && resource.listFilter.length > 0 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }, children: [_jsx(Filter, { style: { width: 14, height: 14, color: 'var(--chakra-colors-fg-muted)' } }), resource.listFilter.map((fName) => {
                                const fieldDef = resource.fields.find((f) => f.name === fName);
                                if (!fieldDef || !fieldDef.choices)
                                    return null;
                                return (_jsxs("select", { className: "chakra-input", style: { padding: '0.35rem 0.6rem', fontSize: '0.8125rem', width: 'auto' }, value: activeFilters[fName] || '', onChange: (e) => {
                                        setActiveFilters((prev) => ({ ...prev, [fName]: e.target.value }));
                                        setPage(1);
                                    }, children: [_jsxs("option", { value: "", children: ["All ", fieldDef.label] }), fieldDef.choices.map((c) => (_jsx("option", { value: String(c.value), children: c.label }, String(c.value))))] }, fName));
                            })] }))] }), selectedIds.size > 0 && (_jsxs("div", { style: {
                    background: 'var(--chakra-colors-brand-subtle)',
                    border: '1px solid var(--chakra-colors-brand-solid)',
                    borderRadius: 8,
                    padding: '0.6rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                }, children: [_jsxs("span", { style: { fontSize: '0.8125rem', fontWeight: 600 }, children: [selectedIds.size, " of ", records.length, " records selected"] }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }, children: [resource.bulkActions?.map((bAction) => (_jsxs("button", { type: "button", className: "chakra-button subtle", onClick: () => handleExecuteBulkAction(bAction), children: [_jsx(Play, { style: { width: 13, height: 13 } }), " ", bAction.label] }, bAction.id))), _jsxs("button", { type: "button", className: "chakra-button subtle", style: { color: '#ef4444' }, onClick: handleBulkDelete, children: [_jsx(Trash2, { style: { width: 14, height: 14 } }), " Delete Selected"] })] })] })), _jsxs("div", { className: "chakra-card", style: { padding: 0, overflow: 'hidden' }, children: [_jsx("div", { style: { overflowX: 'auto' }, children: _jsxs("table", { className: "chakra-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { width: 40, textAlign: 'center' }, children: _jsx("input", { type: "checkbox", checked: records.length > 0 && selectedIds.size === records.length, onChange: (e) => toggleSelectAll(e.target.checked) }) }), columns.map((col) => {
                                                const fieldDef = resource.fields.find((f) => f.name === col);
                                                const label = fieldDef?.label || col;
                                                return (_jsx("th", { onClick: () => handleSort(col), style: { cursor: 'pointer', userSelect: 'none' }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.35rem' }, children: [_jsx("span", { children: label }), _jsx(ArrowUpDown, { style: { width: 12, height: 12, opacity: sortBy === col ? 1 : 0.4 } })] }) }, col));
                                            }), _jsx("th", { style: { textAlign: 'right', minWidth: 120 }, children: "Actions" })] }) }), _jsx("tbody", { children: loading ? (_jsx("tr", { children: _jsx("td", { colSpan: columns.length + 2, style: { textAlign: 'center', padding: '2.5rem' }, children: _jsx("div", { style: { color: 'var(--chakra-colors-fg-muted)', fontSize: '0.875rem' }, children: "Loading records..." }) }) })) : records.length === 0 ? (_jsx("tr", { children: _jsxs("td", { colSpan: columns.length + 2, style: { textAlign: 'center', padding: '3rem' }, children: [_jsxs("div", { style: { color: 'var(--chakra-colors-fg-muted)', fontSize: '0.9375rem', fontWeight: 600 }, children: ["No ", resource.pluralLabel.toLowerCase(), " found"] }), _jsxs("div", { style: { color: 'var(--chakra-colors-fg-muted)', fontSize: '0.75rem', marginTop: 4 }, children: ["Create a new record by clicking \"+ Add ", resource.label, "\""] })] }) })) : (records.map((row, rIdx) => {
                                        const firstCol = columns[0];
                                        const rowId = row.id ?? row._id ?? row.uuid ?? (firstCol ? row[firstCol] : undefined) ?? rIdx;
                                        return (_jsxs("tr", { children: [_jsx("td", { style: { textAlign: 'center' }, children: _jsx("input", { type: "checkbox", checked: selectedIds.has(rowId), onChange: (e) => toggleSelectRow(rowId, e.target.checked) }) }), columns.map((col, cIdx) => {
                                                    const val = row[col];
                                                    return (_jsx("td", { children: cIdx === 0 ? (_jsx("a", { href: `#changeform/${resource.id}/${rowId}`, style: {
                                                                color: 'var(--chakra-colors-brand-fg)',
                                                                fontWeight: 600,
                                                                textDecoration: 'none',
                                                            }, onClick: (e) => {
                                                                e.preventDefault();
                                                                setRoute(`#changeform/${resource.id}/${rowId}`);
                                                            }, children: String(val ?? '—') })) : typeof val === 'boolean' ? (_jsx("span", { className: `chakra-badge ${val ? 'teal' : 'gray'}`, children: val ? 'Yes' : 'No' })) : typeof val === 'object' && val !== null ? (_jsxs("code", { style: { fontSize: '0.75rem' }, children: [JSON.stringify(val).slice(0, 30), "..."] })) : (String(val ?? '—')) }, col));
                                                }), _jsx("td", { style: { textAlign: 'right' }, children: _jsxs("div", { style: { display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }, children: [resource.actions?.map((act) => (_jsx("button", { type: "button", className: "chakra-button ghost", style: { padding: '3px 6px', fontSize: '0.75rem' }, title: act.label, onClick: () => handleExecuteAction(act, rowId), children: _jsx(Play, { style: { width: 12, height: 12 } }) }, act.id))), _jsx("button", { type: "button", className: "chakra-button ghost", style: { padding: '4px 6px' }, title: "Edit", onClick: () => setRoute(`#changeform/${resource.id}/${rowId}`), children: _jsx(Edit2, { style: { width: 13, height: 13 } }) }), _jsx("button", { type: "button", className: "chakra-button ghost", style: { padding: '4px 6px', color: '#ef4444' }, title: "Delete", onClick: () => handleDelete(rowId), children: _jsx(Trash2, { style: { width: 13, height: 13 } }) })] }) })] }, String(rowId)));
                                    })) })] }) }), _jsxs("div", { style: {
                            padding: '0.75rem 1rem',
                            borderTop: '1px solid var(--chakra-colors-border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            fontSize: '0.8125rem',
                            color: 'var(--chakra-colors-fg-muted)',
                        }, children: [_jsxs("div", { children: ["Showing ", _jsx("strong", { children: records.length }), " of ", _jsx("strong", { children: totalRecords }), " ", resource.pluralLabel.toLowerCase()] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.75rem' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.35rem' }, children: [_jsx("span", { children: "Rows:" }), _jsxs("select", { className: "chakra-input", style: { padding: '0.2rem 0.5rem', fontSize: '0.75rem', width: 'auto' }, value: pageSize, onChange: (e) => {
                                                    setPageSize(Number(e.target.value));
                                                    setPage(1);
                                                }, children: [_jsx("option", { value: 10, children: "10" }), _jsx("option", { value: 25, children: "25" }), _jsx("option", { value: 50, children: "50" }), _jsx("option", { value: 100, children: "100" })] })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.25rem' }, children: [_jsx("button", { type: "button", className: "chakra-button subtle", style: { padding: '0.3rem 0.5rem' }, disabled: page <= 1, onClick: () => setPage(page - 1), children: _jsx(ChevronLeft, { style: { width: 14, height: 14 } }) }), _jsxs("span", { children: ["Page ", page, " of ", totalPages] }), _jsx("button", { type: "button", className: "chakra-button subtle", style: { padding: '0.3rem 0.5rem' }, disabled: page >= totalPages, onClick: () => setPage(page + 1), children: _jsx(ChevronRight, { style: { width: 14, height: 14 } }) })] })] })] })] }), isImportModalOpen && (_jsx("div", { className: "admin-modal-overlay", onClick: () => setImportModalOpen(false), children: _jsxs("div", { className: "chakra-card", style: { maxWidth: 640, width: '100%', position: 'relative' }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: '1rem',
                            }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.125rem' }, children: [_jsx(FileSpreadsheet, { style: { width: 20, height: 20, color: 'var(--chakra-colors-brand-fg)' } }), _jsxs("span", { children: ["Import ", resource.pluralLabel, " from CSV"] })] }), _jsx("button", { type: "button", className: "chakra-button ghost", style: { padding: 4 }, onClick: () => setImportModalOpen(false), children: _jsx(X, { style: { width: 16, height: 16 } }) })] }), _jsx("p", { style: { fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1.25rem' }, children: "Upload a comma-separated CSV file. Column headers in the CSV will automatically map to resource fields." }), _jsxs("div", { style: {
                                border: '2px dashed var(--chakra-colors-border-default)',
                                borderRadius: 8,
                                padding: '2rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                marginBottom: '1rem',
                                background: 'var(--chakra-colors-bg-subtle)',
                            }, onClick: () => fileInputRef.current?.click(), children: [_jsx("input", { ref: fileInputRef, type: "file", accept: ".csv", style: { display: 'none' }, onChange: handleCsvFileSelected }), _jsx(Upload, { style: { width: 32, height: 32, margin: '0 auto 0.5rem', color: 'var(--chakra-colors-brand-fg)' } }), _jsx("div", { style: { fontWeight: 600, fontSize: '0.875rem' }, children: importFileName ? importFileName : 'Click to select or drop a CSV file' }), _jsx("div", { style: { fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 4 }, children: "Supports standard comma-delimited .csv files" })] }), importRows.length > 0 && (_jsxs("div", { style: { marginBottom: '1.25rem' }, children: [_jsxs("div", { style: { fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(CheckCircle2, { style: { width: 15, height: 15, color: '#10b981' } }), _jsxs("span", { children: ["Parsed ", importRows.length, " rows (Previewing first 3):"] })] }), _jsx("div", { style: { maxHeight: 150, overflowX: 'auto', overflowY: 'auto', border: '1px solid var(--chakra-colors-border-subtle)', borderRadius: 6 }, children: _jsxs("table", { className: "chakra-table", style: { fontSize: '0.75rem' }, children: [_jsx("thead", { children: _jsx("tr", { children: Object.keys(importRows[0] || {}).map((k) => (_jsx("th", { style: { padding: '0.4rem 0.6rem' }, children: k }, k))) }) }), _jsx("tbody", { children: importRows.slice(0, 3).map((r, ri) => (_jsx("tr", { children: Object.values(r).map((v, vi) => (_jsx("td", { style: { padding: '0.4rem 0.6rem' }, children: String(v) }, vi))) }, ri))) })] }) })] })), _jsxs("div", { style: { display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }, children: [_jsx("button", { type: "button", className: "chakra-button subtle", onClick: () => {
                                        setImportModalOpen(false);
                                        setImportRows([]);
                                    }, children: "Cancel" }), _jsx("button", { type: "button", className: "chakra-button solid", disabled: importRows.length === 0 || importing, onClick: handleConfirmImport, children: importing ? 'Importing Records...' : `Import ${importRows.length} Records` })] })] }) }))] }));
};
//# sourceMappingURL=DataTable.js.map