import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAdmin, AdminResource, AdminCustomAction, AdminBulkAction } from '../../context/AdminContext.js';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Download,
  Upload,
  Edit2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  Play,
  FileSpreadsheet,
  X,
  CheckCircle2,
} from 'lucide-react';

export interface DataTableProps {
  resource: AdminResource;
}

export const DataTable: React.FC<DataTableProps> = ({ resource }) => {
  const { fetchApi, showToast, setRoute } = useAdmin();

  const [records, setRecords] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  // Table Query State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(resource.listPerPage || 25);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<any>>(new Set());

  // CSV Import Modal State
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<Array<Record<string, any>>>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Columns to display
  const columns =
    resource.listDisplay && resource.listDisplay.length > 0
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

      const res = await fetchApi<any>(`/resources/${resource.id}?${params.toString()}`);
      const dataObj = res?.data || res || {};
      const items = dataObj.items || dataObj.records || (Array.isArray(dataObj) ? dataObj : []);
      const total = dataObj.total ?? dataObj.totalRecords ?? items.length;

      setRecords(items);
      setTotalRecords(total);
      setSelectedIds(new Set());
    } catch (err: any) {
      showToast(err.message || 'Failed to load records', 'error');
    } finally {
      setLoading(false);
    }
  }, [resource.id, page, pageSize, searchQuery, sortBy, sortDir, activeFilters, fetchApi, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Sort
  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  // Row Selection
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(records.map((r, i) => r.id ?? r._id ?? r.uuid ?? i)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (id: any, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  // Delete Record
  const handleDelete = async (id: any) => {
    if (!confirm(`Are you sure you want to delete ${resource.label} #${id}?`)) return;
    try {
      await fetchApi(`/resources/${resource.id}/${id}`, { method: 'DELETE' });
      showToast(`${resource.label} #${id} deleted successfully`);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected records?`)) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetchApi(`/resources/${resource.id}/${id}`, { method: 'DELETE' })
        )
      );
      showToast(`${selectedIds.size} records deleted successfully`);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Custom Row Action Execution
  const handleExecuteAction = async (action: AdminCustomAction, rowId: any) => {
    if (action.requiresConfirmation) {
      const msg = action.confirmationMessage || `Execute action "${action.label}" on ${resource.label} #${rowId}?`;
      if (!confirm(msg)) return;
    }
    try {
      const res = await fetchApi<any>(`/resources/${resource.id}/${rowId}/actions/${action.id}`, {
        method: 'POST',
      });
      const resultMsg = res?.data?.result || res?.result || `Action "${action.label}" executed successfully`;
      showToast(typeof resultMsg === 'string' ? resultMsg : `Action "${action.label}" executed successfully`);
      loadData();
    } catch (err: any) {
      showToast(err.message || `Failed to execute action ${action.label}`, 'error');
    }
  };

  // Custom Bulk Action Execution
  const handleExecuteBulkAction = async (bulkAction: AdminBulkAction) => {
    if (bulkAction.requiresConfirmation) {
      const msg = bulkAction.confirmationMessage || `Execute bulk action "${bulkAction.label}" on ${selectedIds.size} selected records?`;
      if (!confirm(msg)) return;
    }
    try {
      const res = await fetchApi<any>(`/resources/${resource.id}/bulk/${bulkAction.id}`, {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const resultMsg = res?.data?.result || res?.result || `Bulk action "${bulkAction.label}" executed successfully`;
      showToast(typeof resultMsg === 'string' ? resultMsg : `Bulk action "${bulkAction.label}" executed successfully`);
      loadData();
    } catch (err: any) {
      showToast(err.message || `Failed to execute bulk action ${bulkAction.label}`, 'error');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (records.length === 0) return;
    const headers = columns.join(',');
    const rows = records.map((r) =>
      columns.map((col) => `"${String(r[col] ?? '').replace(/"/g, '""')}"`).join(',')
    );
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
  const handleCsvFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
      const parsedRows: Array<Record<string, any>> = [];

      for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i];
        if (!currentLine) continue;
        const vals = currentLine.split(',').map((v) => v.replace(/^["']|["']$/g, '').trim());
        const rowObj: Record<string, any> = {};
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
    if (importRows.length === 0) return;
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
        } catch {}
      }
      showToast(`Successfully imported ${successCount} of ${importRows.length} ${resource.pluralLabel}`);
      setImportModalOpen(false);
      setImportRows([]);
      setImportFileName('');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Import error', 'error');
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <div>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {resource.pluralLabel || resource.label}
          </h1>
          <div style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 2 }}>
            Manage and query {resource.pluralLabel.toLowerCase()} records from the database
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="chakra-button subtle"
            onClick={loadData}
            title="Refresh Data"
          >
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
          <button
            type="button"
            className="chakra-button subtle"
            onClick={() => setImportModalOpen(true)}
            title="Import CSV records"
          >
            <Upload style={{ width: 14, height: 14 }} /> Import CSV
          </button>
          <button type="button" className="chakra-button subtle" onClick={handleExportCsv}>
            <Download style={{ width: 14, height: 14 }} /> Export CSV
          </button>
          <button
            type="button"
            className="chakra-button solid"
            onClick={() => setRoute(`#changeform/${resource.id}`)}
          >
            <Plus style={{ width: 15, height: 15 }} /> Add {resource.label}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="chakra-card"
        style={{
          padding: '0.875rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Search Field */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 240 }}>
          <Search style={{ width: 16, height: 16, color: 'var(--chakra-colors-fg-muted)' }} />
          <input
            type="text"
            className="chakra-input"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem' }}
            placeholder={`Search ${resource.pluralLabel.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Filter dropdowns if configured */}
        {resource.listFilter && resource.listFilter.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Filter style={{ width: 14, height: 14, color: 'var(--chakra-colors-fg-muted)' }} />
            {resource.listFilter.map((fName) => {
              const fieldDef = resource.fields.find((f) => f.name === fName);
              if (!fieldDef || !fieldDef.choices) return null;
              return (
                <select
                  key={fName}
                  className="chakra-input"
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem', width: 'auto' }}
                  value={activeFilters[fName] || ''}
                  onChange={(e) => {
                    setActiveFilters((prev) => ({ ...prev, [fName]: e.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">All {fieldDef.label}</option>
                  {fieldDef.choices.map((c) => (
                    <option key={String(c.value)} value={String(c.value)}>
                      {c.label}
                    </option>
                  ))}
                </select>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Action Bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
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
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            {selectedIds.size} of {records.length} records selected
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {resource.bulkActions?.map((bAction) => (
              <button
                key={bAction.id}
                type="button"
                className="chakra-button subtle"
                onClick={() => handleExecuteBulkAction(bAction)}
              >
                <Play style={{ width: 13, height: 13 }} /> {bAction.label}
              </button>
            ))}
            <button
              type="button"
              className="chakra-button subtle"
              style={{ color: '#ef4444' }}
              onClick={handleBulkDelete}
            >
              <Trash2 style={{ width: 14, height: 14 }} /> Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="chakra-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="chakra-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={records.length > 0 && selectedIds.size === records.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                {columns.map((col) => {
                  const fieldDef = resource.fields.find((f) => f.name === col);
                  const label = fieldDef?.label || col;
                  return (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{label}</span>
                        <ArrowUpDown style={{ width: 12, height: 12, opacity: sortBy === col ? 1 : 0.4 }} />
                      </div>
                    </th>
                  );
                })}
                <th style={{ textAlign: 'right', minWidth: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 2} style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div style={{ color: 'var(--chakra-colors-fg-muted)', fontSize: '0.875rem' }}>
                      Loading records...
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ color: 'var(--chakra-colors-fg-muted)', fontSize: '0.9375rem', fontWeight: 600 }}>
                      No {resource.pluralLabel.toLowerCase()} found
                    </div>
                    <div style={{ color: 'var(--chakra-colors-fg-muted)', fontSize: '0.75rem', marginTop: 4 }}>
                      Create a new record by clicking "+ Add {resource.label}"
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((row, rIdx) => {
                  const firstCol = columns[0];
                  const rowId = row.id ?? row._id ?? row.uuid ?? (firstCol ? row[firstCol] : undefined) ?? rIdx;
                  return (
                    <tr key={String(rowId)}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(rowId)}
                          onChange={(e) => toggleSelectRow(rowId, e.target.checked)}
                        />
                      </td>
                      {columns.map((col, cIdx) => {
                        const val = row[col];
                        return (
                          <td key={col}>
                            {cIdx === 0 ? (
                              <a
                                href={`#changeform/${resource.id}/${rowId}`}
                                style={{
                                  color: 'var(--chakra-colors-brand-fg)',
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setRoute(`#changeform/${resource.id}/${rowId}`);
                                }}
                              >
                                {String(val ?? '—')}
                              </a>
                            ) : typeof val === 'boolean' ? (
                              <span className={`chakra-badge ${val ? 'teal' : 'gray'}`}>
                                {val ? 'Yes' : 'No'}
                              </span>
                            ) : typeof val === 'object' && val !== null ? (
                              <code style={{ fontSize: '0.75rem' }}>{JSON.stringify(val).slice(0, 30)}...</code>
                            ) : (
                              String(val ?? '—')
                            )}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                          {/* Custom Row Actions */}
                          {resource.actions?.map((act) => (
                            <button
                              key={act.id}
                              type="button"
                              className="chakra-button ghost"
                              style={{ padding: '3px 6px', fontSize: '0.75rem' }}
                              title={act.label}
                              onClick={() => handleExecuteAction(act, rowId)}
                            >
                              <Play style={{ width: 12, height: 12 }} />
                            </button>
                          ))}
                          <button
                            type="button"
                            className="chakra-button ghost"
                            style={{ padding: '4px 6px' }}
                            title="Edit"
                            onClick={() => setRoute(`#changeform/${resource.id}/${rowId}`)}
                          >
                            <Edit2 style={{ width: 13, height: 13 }} />
                          </button>
                          <button
                            type="button"
                            className="chakra-button ghost"
                            style={{ padding: '4px 6px', color: '#ef4444' }}
                            title="Delete"
                            onClick={() => handleDelete(rowId)}
                          >
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--chakra-colors-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.8125rem',
            color: 'var(--chakra-colors-fg-muted)',
          }}
        >
          <div>
            Showing <strong>{records.length}</strong> of <strong>{totalRecords}</strong> {resource.pluralLabel.toLowerCase()}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Rows:</span>
              <select
                className="chakra-input"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                className="chakra-button subtle"
                style={{ padding: '0.3rem 0.5rem' }}
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="chakra-button subtle"
                style={{ padding: '0.3rem 0.5rem' }}
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Import Modal Dialog */}
      {isImportModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div
            className="chakra-card"
            style={{ maxWidth: 640, width: '100%', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.125rem' }}>
                <FileSpreadsheet style={{ width: 20, height: 20, color: 'var(--chakra-colors-brand-fg)' }} />
                <span>Import {resource.pluralLabel} from CSV</span>
              </div>
              <button
                type="button"
                className="chakra-button ghost"
                style={{ padding: 4 }}
                onClick={() => setImportModalOpen(false)}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--chakra-colors-fg-muted)', marginBottom: '1.25rem' }}>
              Upload a comma-separated CSV file. Column headers in the CSV will automatically map to resource fields.
            </p>

            {/* Upload Drag/Select Zone */}
            <div
              style={{
                border: '2px dashed var(--chakra-colors-border-default)',
                borderRadius: 8,
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '1rem',
                background: 'var(--chakra-colors-bg-subtle)',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleCsvFileSelected}
              />
              <Upload style={{ width: 32, height: 32, margin: '0 auto 0.5rem', color: 'var(--chakra-colors-brand-fg)' }} />
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {importFileName ? importFileName : 'Click to select or drop a CSV file'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--chakra-colors-fg-muted)', marginTop: 4 }}>
                Supports standard comma-delimited .csv files
              </div>
            </div>

            {/* Preview Table if rows parsed */}
            {importRows.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 style={{ width: 15, height: 15, color: '#10b981' }} />
                  <span>Parsed {importRows.length} rows (Previewing first 3):</span>
                </div>
                <div style={{ maxHeight: 150, overflowX: 'auto', overflowY: 'auto', border: '1px solid var(--chakra-colors-border-subtle)', borderRadius: 6 }}>
                  <table className="chakra-table" style={{ fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        {Object.keys(importRows[0] || {}).map((k) => (
                          <th key={k} style={{ padding: '0.4rem 0.6rem' }}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 3).map((r, ri) => (
                        <tr key={ri}>
                          {Object.values(r).map((v: any, vi) => (
                            <td key={vi} style={{ padding: '0.4rem 0.6rem' }}>{String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="chakra-button subtle"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportRows([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="chakra-button solid"
                disabled={importRows.length === 0 || importing}
                onClick={handleConfirmImport}
              >
                {importing ? 'Importing Records...' : `Import ${importRows.length} Records`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
