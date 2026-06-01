import { useEffect, useMemo, useState } from 'react';
import { Database, FileUp, RefreshCw, Send } from 'lucide-react';
import { api } from '../../../api/client';

async function readWebhookResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message || JSON.stringify(payload);
    throw new Error(message || response.statusText);
  }

  if (typeof payload === 'string') return payload || 'Request berhasil.';
  return payload?.message || payload?.status || JSON.stringify(payload, null, 2);
}

function normalizeCollectionName(value) {
  return value.trim().replace(/\s+/g, '_').toLowerCase();
}

const modeMeta = {
  text: { title: 'Upload Text', method: 'POST', detail: 'JSON knowledge text' },
  pdf: { title: 'Upload PDF', method: 'POST', detail: 'multipart PDF file' },
  sync: { title: 'Sync Intent Data', method: 'PUT', detail: 'insert Intent + Action data' },
};

export function VectorCollectionPanel({ collections, loading, loadData }) {
  const [collectionName, setCollectionName] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [activeMode, setActiveMode] = useState('text');
  const [status, setStatus] = useState('Pilih Semantic Search collection sebelum mengirim request n8n.');
  const [statusType, setStatusType] = useState('neutral');
  const [loadingAction, setLoadingAction] = useState('');

  const collectionOptions = useMemo(
    () => [...new Set(collections.map((item) => item.collection_name).filter(Boolean))].sort(),
    [collections],
  );
  const activeMeta = modeMeta[activeMode];

  useEffect(() => {
    if (!collectionName && collectionOptions[0]) setCollectionName(collectionOptions[0]);
  }, [collectionName, collectionOptions]);

  function setError(message) {
    setStatusType('error');
    setStatus(message);
  }

  function ensureCollection() {
    if (!collectionName) {
      setError('Collection wajib dipilih atau target baru wajib diisi dulu.');
      return false;
    }
    return true;
  }

  async function runRequest(action, request) {
    if (!ensureCollection()) return;
    setLoadingAction(action);
    setStatusType('neutral');
    setStatus('Mengirim request ke n8n...');
    try {
      const message = await request();
      setStatusType('success');
      setStatus(message);
    } catch (error) {
      setError(error.message || 'Request n8n gagal.');
    } finally {
      setLoadingAction('');
    }
  }

  async function registerCollection(event) {
    event.preventDefault();
    const name = normalizeCollectionName(newCollection);
    if (!name) {
      setError('Nama collection wajib diisi.');
      return;
    }

    if (collectionOptions.includes(name)) {
      setCollectionName(name);
      setNewCollection('');
      setStatusType('neutral');
      setStatus(`Semantic Search collection ${name} sudah ada dan dipilih.`);
      return;
    }

    setLoadingAction('collection');
    setStatusType('neutral');
    setStatus(`Mendaftarkan ${name} ke tabel semantic_search...`);
    try {
      await api.create('semanticSearches', { collection_name: name });
      await loadData();
      setCollectionName(name);
      setNewCollection('');
      setStatusType('success');
      setStatus(`${name} terdaftar di semantic_search. Upload text/PDF atau sync akan membuat/mengisi n8n_vector_collections dengan nama yang sama.`);
    } catch (error) {
      setError(error.message || 'Gagal mendaftarkan collection ke Semantic Search.');
    } finally {
      setLoadingAction('');
    }
  }

  function syncIntent() {
    runRequest('sync', async () => {
      const response = await fetch('/vector-webhook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_name: collectionName }),
      });
      return readWebhookResponse(response);
    });
  }

  function submitText(event) {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText) {
      setError('Text wajib diisi.');
      return;
    }

    runRequest('text', async () => {
      const response = await fetch('/vector-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', text: cleanText, collection_name: collectionName }),
      });
      return readWebhookResponse(response);
    });
  }

  function submitPdf(event) {
    event.preventDefault();
    if (!file) {
      setError('PDF wajib dipilih.');
      return;
    }

    runRequest('pdf', async () => {
      const formData = new FormData();
      formData.append('type', 'pdf');
      formData.append('collection_name', collectionName);
      formData.append('file', file);

      const response = await fetch('/vector-webhook', { method: 'POST', body: formData });
      return readWebhookResponse(response);
    });
  }

  const busy = loading || loadingAction !== '';

  return (
    <section className="vector-console">
      <div className="vector-console-bar">
        <label className="vector-field collection-picker">
          <span>Semantic Search Collection</span>
          <select value={collectionName} onChange={(event) => setCollectionName(event.target.value)} disabled={busy}>
            <option value="">Select collection</option>
            {collectionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <small>Data dari /api/semantic-searches/. Nilai ini dipakai sebagai target n8n by name.</small>
        </label>

        <form className="vector-inline-create" onSubmit={registerCollection}>
          <label className="vector-field">
            <span>Register Semantic Search</span>
            <input
              value={newCollection}
              onChange={(event) => setNewCollection(event.target.value)}
              placeholder="peraturan_hr"
              disabled={busy}
            />
            <small>Membuat row semantic_search; PGVector dibuat/diisi n8n saat upload/sync.</small>
          </label>
          <button className="secondary-button" type="submit" disabled={busy}>
            <Database size={16} />
              {loadingAction === 'collection' ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>

      <div className="vector-console-main">
        <div className="vector-operation-head">
          <div className="vector-tabs" role="tablist" aria-label="Vector collection operation">
            <button className={activeMode === 'text' ? 'active' : ''} type="button" onClick={() => setActiveMode('text')}>Text</button>
            <button className={activeMode === 'pdf' ? 'active' : ''} type="button" onClick={() => setActiveMode('pdf')}>PDF</button>
            <button className={activeMode === 'sync' ? 'active' : ''} type="button" onClick={() => setActiveMode('sync')}>Sync Data</button>
          </div>
          <div className="vector-method">
            <span>{activeMeta.method}</span>
            <small>{activeMeta.detail}</small>
          </div>
        </div>

        {activeMode === 'text' && (
          <form className="vector-form" onSubmit={submitText}>
            <div className="vector-form-heading">
              <h2>{activeMeta.title}</h2>
              <p>Kirim knowledge text ke n8n vector collection <strong>{collectionName || 'terpilih'}</strong>.</p>
            </div>
            <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Tulis knowledge yang akan dimasukkan ke collection" rows={6} disabled={busy} />
            <button className="primary-button" type="submit" disabled={busy}>
              <Send size={16} />
              {loadingAction === 'text' ? 'Sending...' : 'Upload Text'}
            </button>
          </form>
        )}

        {activeMode === 'pdf' && (
          <form className="vector-form compact" onSubmit={submitPdf}>
            <div className="vector-form-heading">
              <h2>{activeMeta.title}</h2>
              <p>Upload PDF ke n8n vector collection <strong>{collectionName || 'terpilih'}</strong>.</p>
            </div>
            <input type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} disabled={busy} />
            <button className="primary-button" type="submit" disabled={busy}>
              <FileUp size={16} />
              {loadingAction === 'pdf' ? 'Uploading...' : 'Upload PDF'}
            </button>
          </form>
        )}

        {activeMode === 'sync' && (
          <div className="vector-form compact">
            <div className="vector-form-heading">
              <h2>{activeMeta.title}</h2>
              <p>Insert data Intent + Action backend ke <strong>{collectionName || 'collection terpilih'}</strong>. Jalankan hanya saat collection perlu disinkronkan ulang.</p>
            </div>
            <button className="secondary-button" type="button" onClick={syncIntent} disabled={busy}>
              <RefreshCw size={16} />
              {loadingAction === 'sync' ? 'Syncing...' : 'Sync to Collection'}
            </button>
          </div>
        )}
      </div>

      <div className={`vector-status ${statusType}`}>{status}</div>
    </section>
  );
}
