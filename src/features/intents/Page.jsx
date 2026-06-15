import { useMemo, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader, StatusStrip } from '../../templates/components/PageHeader';
import { ResourceCrudSurface } from '../../templates/components/ResourceCrudSurface';
import { useResourceCrud } from '../../templates/hooks/useResourceCrud';
import { itemLabel } from '../../utils/resourceUtils.jsx';

function syncMessage(payload) {
  if (!payload) return 'Intent cache berhasil disinkronkan.';
  if (typeof payload === 'string') return payload;
  return payload.message || payload.status || payload.detail || 'Intent cache berhasil disinkronkan.';
}

export function IntentsPage({ data, apiStatus, loading, loadData, setApiStatus }) {
  const [selectedUsecaseId, setSelectedUsecaseId] = useState('');
  const [syncState, setSyncState] = useState({ busy: false, message: '' });
  const usecases = data.usecases || [];

  const filteredData = useMemo(() => {
    if (!selectedUsecaseId) return data;

    return {
      ...data,
      intents: (data.intents || []).filter((intent) => String(intent.usecase_id ?? intent.usecase?.id ?? '') === selectedUsecaseId),
    };
  }, [data, selectedUsecaseId]);

  const crud = useResourceCrud({ resource: 'intents', data: filteredData, loadData, setApiStatus });
  const statusText = syncState.busy ? 'Menyinkronkan intent cache ke AIWO engine...' : syncState.message || apiStatus;
  const statusWarning = statusText.includes('gagal') || statusText.includes('belum');

  async function syncIntents() {
    setSyncState({ busy: true, message: '' });
    try {
      const payload = await api.syncIntents();
      const message = syncMessage(payload);
      setSyncState({ busy: false, message });
      setApiStatus(message);
      await loadData();
    } catch (error) {
      const message = `Sync intent belum berhasil: ${error.message || 'request gagal'}.`;
      setSyncState({ busy: false, message });
      setApiStatus(message);
    }
  }

  return (
    <>
      <PageHeader
        config={crud.config}
        countLabel={crud.filteredRows.length + ' records'}
        onRefresh={loadData}
        actions={(
          <>
            <label className="topbar-filter" htmlFor="intent-usecase-filter">
              <span>Usecase</span>
              <select
                id="intent-usecase-filter"
                value={selectedUsecaseId}
                onChange={(event) => setSelectedUsecaseId(event.target.value)}
                disabled={loading || crud.busy || syncState.busy || !usecases.length}
              >
                <option value="">All usecases</option>
                {usecases.map((usecase) => (
                  <option key={usecase.id} value={String(usecase.id)}>{itemLabel('usecases', usecase, data)}</option>
                ))}
              </select>
            </label>
            <button className="secondary-button" type="button" onClick={syncIntents} disabled={loading || crud.busy || syncState.busy} title="Synchronize intents with AIWO engine cache">
              <UploadCloud size={17} />
              {syncState.busy ? 'Syncing...' : 'Sync Intents'}
            </button>
          </>
        )}
      />
      <StatusStrip warning={statusWarning}>{loading || crud.busy ? 'Memuat data...' : statusText}</StatusStrip>
      <ResourceCrudSurface resource="intents" data={filteredData} loading={loading} crud={crud} />
    </>
  );
}
