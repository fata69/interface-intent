import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, FileUp, Search, Send, X } from 'lucide-react';
import { api } from '../../../api/client';

const selectedCollectionStorageKey = 'intent-agent-vector-collection';
const maxTextCharacters = 50000;

function loadSelectedCollection() {
  try {
    return globalThis.sessionStorage?.getItem(selectedCollectionStorageKey) || '';
  } catch {
    return '';
  }
}

function saveSelectedCollection(collectionName) {
  try {
    if (collectionName) {
      globalThis.sessionStorage?.setItem(selectedCollectionStorageKey, collectionName);
    } else {
      globalThis.sessionStorage?.removeItem(selectedCollectionStorageKey);
    }
  } catch {
    // The picker remains usable even if browser storage is unavailable.
  }
}

async function readWebhookResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message || JSON.stringify(payload);
    throw new Error(message || response.statusText);
  }

  if (typeof payload === 'string') return payload || 'Request berhasil.';
  return payload?.message || payload?.status || JSON.stringify(payload, null, 2);
}

const modeMeta = {
  text: { title: 'Upload Text' },
  pdf: { title: 'Upload PDF' },
};

const uploadStepLabels = {
  file: 'File tersimpan',
  knowledge: 'Knowledge diproses untuk pencarian',
};

function getCollectionName(item) {
  return item?.name || item?.collection_name || '';
}

function createCollectionUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    bytes.forEach((_, index) => {
      bytes[index] = Math.floor(Math.random() * 256);
    });
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

export function VectorCollectionPanel({ semanticCollections = [], vectorCollections = [], loading, onRefresh }) {
  const [collectionName, setCollectionName] = useState(loadSelectedCollection);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [collectionQuery, setCollectionQuery] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeMode, setActiveMode] = useState('text');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('neutral');
  const [uploadSteps, setUploadSteps] = useState([]);
  const [loadingAction, setLoadingAction] = useState('');
  const fileInputRef = useRef(null);

  const collectionOptions = useMemo(() => {
    const semanticNames = semanticCollections.map(getCollectionName).filter(Boolean);
    return [...new Set(semanticNames)].sort();
  }, [semanticCollections]);
  const filteredCollectionOptions = useMemo(() => {
    const query = collectionQuery.trim().toLowerCase();
    if (!query) return collectionOptions;
    return collectionOptions.filter((option) => option.toLowerCase().includes(query));
  }, [collectionOptions, collectionQuery]);
  const activeMeta = modeMeta[activeMode];
  const hasCollections = collectionOptions.length > 0;

  useEffect(() => {
    if (!hasCollections) {
      if (collectionName) setCollectionName('');
      return;
    }
    if (collectionName && collectionOptions.includes(collectionName)) return;

    const savedCollection = loadSelectedCollection();
    if (savedCollection && collectionOptions.includes(savedCollection)) {
      setCollectionName(savedCollection);
      return;
    }

    setCollectionName(collectionOptions[0]);
  }, [collectionName, collectionOptions, hasCollections]);

  useEffect(() => {
    saveSelectedCollection(collectionName);
  }, [collectionName]);

  function setError(message) {
    setStatusType('error');
    setStatus(message);
  }

  function resetStatus() {
    setStatusType('neutral');
    setStatus('');
    setUploadSteps([]);
  }

  function setUploadStepState(fileState, knowledgeState) {
    setUploadSteps([
      { key: 'file', label: uploadStepLabels.file, state: fileState },
      { key: 'knowledge', label: uploadStepLabels.knowledge, state: knowledgeState },
    ]);
  }

  function selectCollection(option) {
    setCollectionName(option);
    setCollectionQuery('');
    setPickerOpen(false);
    resetStatus();
  }

  function switchMode(mode) {
    setActiveMode(mode);
    resetStatus();
  }

  function updateText(value) {
    setText(value);
    if (status) resetStatus();
  }

  function clearText() {
    setText('');
    resetStatus();
  }

  function ensureCollection() {
    if (!collectionName) {
      setError('Collection wajib dipilih. Buat collection baru dari halaman Semantic Search.');
      return false;
    }
    return true;
  }

  function findApiCollection(name) {
    return vectorCollections.find((item) => getCollectionName(item) === name);
  }

  function createTextFile(cleanText) {
    const safeName = collectionName.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'knowledge';
    return new File([cleanText], `${safeName}.txt`, { type: 'text/plain' });
  }

  async function ensureApiCollection() {
    const existing = findApiCollection(collectionName);
    if (existing?.uuid) return existing;

    const payload = {
      uuid: createCollectionUuid(),
      name: collectionName,
      cmetadata: '{}',
    };
    const created = await api.createVectorCollection(payload);
    return created?.data || created || payload;
  }

  async function uploadOriginalFileToApi(fileToUpload) {
    const apiCollection = await ensureApiCollection();
    const uuid = apiCollection?.uuid;
    if (!uuid) throw new Error('Data collection belum lengkap.');
    await api.uploadVectorCollectionFile(uuid, fileToUpload);
    await onRefresh?.();
    return uuid;
  }

  async function runUpload(action, fileToUpload, indexKnowledge) {
    if (!ensureCollection()) return;
    setLoadingAction(action);
    setStatusType('neutral');
    setStatus('Menyimpan file...');
    setUploadStepState('active', 'waiting');

    let fileSaved = false;
    try {
      await uploadOriginalFileToApi(fileToUpload);
      fileSaved = true;
      setUploadStepState('done', 'active');
      setStatus('File tersimpan. Knowledge sedang diproses...');

      const result = await indexKnowledge();
      setUploadStepState('done', 'done');
      setStatusType('success');
      setStatus(result || `Knowledge siap dipakai di ${collectionName}.`);
    } catch (error) {
      setUploadStepState(fileSaved ? 'done' : 'error', fileSaved ? 'error' : 'waiting');
      setError(fileSaved
        ? `File tersimpan, tapi knowledge belum berhasil diproses: ${error.message || 'akses gagal'}.`
        : `File belum berhasil disimpan: ${error.message || 'akses gagal'}.`);
    } finally {
      setLoadingAction('');
    }
  }

  function submitText(event) {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText) {
      setError('Text wajib diisi.');
      return;
    }

    if (cleanText.length > maxTextCharacters) {
      setError('Text maksimal 50.000 karakter.');
      return;
    }

    runUpload('text', createTextFile(cleanText), async () => {
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

    runUpload('pdf', file, async () => {
      const formData = new FormData();
      formData.append('type', 'pdf');
      formData.append('collection_name', collectionName);
      formData.append('file', file);

      const response = await fetch('/vector-webhook', { method: 'POST', body: formData });
      return readWebhookResponse(response);
    });
  }

  function selectPdfFile(selectedFile) {
    if (!selectedFile) return;
    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    const maxSize = 10 * 1024 * 1024;

    if (!isPdf) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError('File harus PDF.');
      return;
    }

    if (selectedFile.size > maxSize) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError('Ukuran PDF maksimal 10 MB.');
      return;
    }

    setFile(selectedFile);
    setStatusType('neutral');
    setUploadSteps([]);
    setStatus(`PDF siap diupload: ${selectedFile.name}.`);
  }

  function clearPdfFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    resetStatus();
  }

  function handlePdfDrop(event) {
    event.preventDefault();
    setDragActive(false);
    if (uploadDisabled) return;
    selectPdfFile(event.dataTransfer.files?.[0]);
  }

  const busy = loading || loadingAction !== '';
  const uploadDisabled = busy || !hasCollections;
  const hasText = text.trim().length > 0;
  const textTooLong = text.length > maxTextCharacters;
  const pdfFooterText = file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : 'Belum ada file dipilih.';
  const idleStatus = !collectionName
    ? 'Pilih collection sebelum upload.'
    : activeMode === 'text'
      ? (textTooLong ? 'Text melebihi batas karakter.' : hasText ? 'Siap upload.' : 'Isi text untuk upload.')
      : (file ? 'Siap upload.' : 'Pilih atau drop PDF untuk upload.');
  const statusMessage = status || idleStatus;

  return (
    <section className="vector-console">
      <div className="vector-console-bar">
        <div
          className="vector-field collection-picker"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setPickerOpen(false);
          }}
        >
          <span>Collection</span>
          <button
            className="collection-picker-button"
            type="button"
            onClick={() => setPickerOpen((current) => !current)}
            disabled={busy || !hasCollections}
            aria-expanded={pickerOpen}
          >
            <span>{collectionName || 'Select collection'}</span>
            <ChevronDown size={16} />
          </button>
          {pickerOpen && (
            <div className="collection-picker-menu">
              <div className="collection-picker-search">
                <Search size={16} />
                <input
                  autoFocus
                  value={collectionQuery}
                  onChange={(event) => setCollectionQuery(event.target.value)}
                  placeholder="Search collection"
                />
              </div>
              <div className="collection-picker-options">
                {filteredCollectionOptions.map((option) => (
                  <button
                    key={option}
                    className={option === collectionName ? 'collection-option active' : 'collection-option'}
                    type="button"
                    onClick={() => selectCollection(option)}
                  >
                    <span>{option}</span>
                    {option === collectionName && <Check size={16} />}
                  </button>
                ))}
                {!filteredCollectionOptions.length && <div className="collection-option-empty">Collection tidak ditemukan.</div>}
              </div>
            </div>
          )}
        </div>
        {hasCollections && (
          <div className="vector-tabs" role="tablist" aria-label="Vector collection operation">
            <button className={activeMode === 'text' ? 'active' : ''} type="button" onClick={() => switchMode('text')}>Text</button>
            <button className={activeMode === 'pdf' ? 'active pdf-tab' : 'pdf-tab'} type="button" onClick={() => switchMode('pdf')}>PDF</button>
          </div>
        )}
      </div>

      <div className="vector-console-main">
        {!hasCollections ? (
          <div className="vector-empty-state">
            <strong>Belum ada collection.</strong>
            <Link className="secondary-button" to="/semantic-search">Buka Semantic Search</Link>
          </div>
        ) : (
          <>
            {activeMode === 'text' && (
              <form className="vector-form" onSubmit={submitText}>
                <div className="vector-form-heading">
                  <h2>{activeMeta.title}</h2>
                </div>
                <div className={textTooLong ? 'vector-limit-note error' : 'vector-limit-note'}>Maksimal 50.000 karakter.</div>
                <textarea value={text} onChange={(event) => updateText(event.target.value)} placeholder="Tulis knowledge yang akan dimasukkan ke collection" rows={6} disabled={uploadDisabled} />
                <div className="vector-form-footer">
                  <span className={textTooLong ? 'character-counter error' : 'character-counter'}>{text.length.toLocaleString('id-ID')} / 50.000 karakter</span>
                  <div className="vector-form-actions">
                    <button className="secondary-button" type="button" onClick={clearText} disabled={uploadDisabled || !text}>Clear</button>
                    <button className="primary-button" type="submit" disabled={uploadDisabled || !text.trim() || textTooLong}>
                      <Send size={16} />
                      {loadingAction === 'text' ? 'Sending...' : 'Upload Text'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {activeMode === 'pdf' && (
              <form className="vector-form compact" onSubmit={submitPdf}>
                <div className="vector-form-heading">
                  <h2>{activeMeta.title}</h2>
                </div>
                <div className="vector-limit-note">Maksimal 10 MB dan 50 halaman.</div>
                <div
                  className={dragActive ? 'pdf-dropzone active' : 'pdf-dropzone'}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (!uploadDisabled) setDragActive(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                  }}
                  onDrop={handlePdfDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => selectPdfFile(event.target.files?.[0])}
                    disabled={uploadDisabled}
                  />
                  <FileUp size={22} />
                  <div>
                    <strong>{file ? file.name : 'Drag & drop PDF di sini'}</strong>
                    <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'atau pilih file dari folder'}</span>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadDisabled}>Pilih PDF</button>
                  {file && (
                    <button className="ghost-button" type="button" onClick={clearPdfFile} title="Hapus file">
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="vector-form-footer">
                  <span className="character-counter">{pdfFooterText}</span>
                  <div className="vector-form-actions">
                    <button className="primary-button pdf-upload-button" type="submit" disabled={uploadDisabled || !file}>
                      <FileUp size={16} />
                      {loadingAction === 'pdf' ? 'Uploading...' : 'Upload PDF'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      <div className={`vector-status ${statusType}`}>
        <span>{statusMessage}</span>
        {uploadSteps.length > 0 && (
          <div className="vector-status-steps">
            {uploadSteps.map((step) => (
              <span className={`vector-status-step ${step.state}`} key={step.key}>{step.label}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
