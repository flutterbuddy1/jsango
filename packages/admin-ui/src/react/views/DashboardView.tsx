import React, { useEffect, useState } from 'react';
import { useAdmin } from '../context/AdminContext.js';
import { Plus, ArrowRight } from 'lucide-react';
import { WidgetGrid, type WidgetMeta } from '../components/widgets/WidgetGrid.js';

const muted = 'var(--chakra-colors-fg-muted)';

/** Loads widget definitions from `endpoint` (the dashboard or a custom page). */
function useWidgets(endpoint: string) {
  const { fetchApi, showToast } = useAdmin();
  const [state, setState] = useState<{ widgets: WidgetMeta[]; page?: { label: string; description?: string } | undefined } | null>(null);
  useEffect(() => {
    let active = true;
    setState(null);
    fetchApi<{ widgets: WidgetMeta[]; page?: { label: string; description?: string } }>(endpoint)
      .then((res) => active && setState({ widgets: res.widgets ?? [], page: res.page }))
      .catch((err: Error) => {
        if (active) setState({ widgets: [] });
        showToast(err.message || 'Failed to load widgets', 'error');
      });
    return () => {
      active = false;
    };
  }, [endpoint, fetchApi, showToast]);
  return state;
}

export const DashboardView: React.FC = () => {
  const { resources, setRoute, setBreadcrumbs, config } = useAdmin();
  const board = useWidgets('/dashboard');

  useEffect(() => {
    setBreadcrumbs([{ label: 'Dashboard' }]);
  }, [setBreadcrumbs]);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 800 }}>Dashboard</h1>
        <div style={{ fontSize: '0.8125rem', color: muted, marginTop: 2 }}>{config.title}</div>
      </div>

      {board && board.widgets.length > 0 && <WidgetGrid basePath="/dashboard" widgets={board.widgets} />}

      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.875rem' }}>Models</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {resources.map((res) => (
          <div key={res.id} className="chakra-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setRoute(`#changelist/${res.id}`)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700 }}>{res.pluralLabel || res.label}</div>
              <span className="chakra-badge gray">{res.fields.length} fields</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: muted }}>{res.navigationGroup || 'Models'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.6rem', borderTop: '1px solid var(--chakra-colors-border-subtle)' }}>
              <button
                type="button"
                className="chakra-button ghost"
                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setRoute(`#changeform/${res.id}`);
                }}
              >
                <Plus style={{ width: 13, height: 13 }} /> Add
              </button>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', color: 'var(--chakra-colors-brand-fg)', fontWeight: 600 }}>
                Open <ArrowRight style={{ width: 12, height: 12 }} />
              </span>
            </div>
          </div>
        ))}
        {resources.length === 0 && <div style={{ fontSize: '0.8125rem', color: muted }}>No models registered. Pass them to app.admin({'{'} resources: [...] {'}'}).</div>}
      </div>
    </div>
  );
};

/** A custom page registered with `new AdminPage({ id, label, widgets })`. */
export const CustomPageView: React.FC<{ pageId: string }> = ({ pageId }) => {
  const { setBreadcrumbs } = useAdmin();
  const endpoint = `/pages/${encodeURIComponent(pageId)}`;
  const board = useWidgets(endpoint);

  useEffect(() => {
    setBreadcrumbs([{ label: board?.page?.label ?? 'Page' }]);
  }, [setBreadcrumbs, board?.page?.label]);

  if (!board) return <div style={{ color: muted, fontSize: '0.8125rem' }}>Loading…</div>;
  if (!board.page) return <div className="chakra-card">Page not found.</div>;
  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 800 }}>{board.page.label}</h1>
        {board.page.description && <div style={{ fontSize: '0.8125rem', color: muted, marginTop: 2 }}>{board.page.description}</div>}
      </div>
      {board.widgets.length > 0 ? <WidgetGrid basePath={endpoint} widgets={board.widgets} /> : <div className="chakra-card">This page has no widgets.</div>}
    </div>
  );
};
