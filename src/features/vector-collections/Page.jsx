import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Boxes, ChevronLeft, ChevronRight, Download, ExternalLink, Search, Trash2, X } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader, StatusStrip } from '../../templates/components/PageHeader';
import { routeByModule } from '../../config/resources';
import { VectorCollectionPanel } from './components/VectorCollectionPanel';
import { vectorCollectionFilesPage, vectorKnowledgeUploadPage } from './config';
import { downloadFile, openFilePreview, reserveFilePreviewTab } from './fileActions';
import { clearVectorIndexFailure, getVectorIndexFailure } from './indexStatus';
import { vectorCollectionFileLabel, vectorCollectionName, vectorCollectionSearchText, vectorCollectionTimeValue, vectorMetadataFiles } from './metadata';

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
});
const pageSizeOptions = [10, 25, 50];

function pageWindow(currentPage, totalPages) {
  const windowSize = 5;
  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(1, Math.min(currentPage - halfWindow, totalPages - windowSize + 1));
  const end = Math.min(totalPages, start + windowSize - 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown size={13} />;
  return direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
}

function formatCollectionTime(item) {
  const value = vectorCollectionTimeValue(item);
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return timeFormatter.format(date);
}

function compareValues(left, right) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

function unwrapDetailPayload(payload) {
  if (payload?.data && !Array.isArray(payload.data)) return payload.data;
  if (payload?.item) return payload.item;
  return payload || {};
}

function textFromDetailEntry(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry !== 'object') return '';
  return entry.text || entry.content || entry.pageContent || entry.document || entry.value || '';
}

function vectorDetailTextItems(item) {
  const sources = [item?.texts, item?.text, item?.vector_texts, item?.chunks, item?.vectors, item?.documents];
  if (Array.isArray(item?.data)) sources.push(item.data);

  const values = sources.flatMap((source) => {
    if (!source) return [];
    if (typeof source === 'string') return [source];
    if (Array.isArray(source)) return source.map(textFromDetailEntry);
    return [textFromDetailEntry(source)];
  });

  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 5);
}

function vectorDetailTextContent(item) {
  return vectorDetailTextItems(item).join('\n\n');
}

function safeTextFilename(item) {
  const name = vectorCollectionName(item).replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '');
  return `${name || 'collection-knowledge'}.txt`;
}

function textFallbackFile(item) {
  return {
    blob: new Blob([vectorDetailTextContent(item)], { type: 'text/plain;charset=utf-8' }),
    contentType: 'text/plain;charset=utf-8',
    filename: safeTextFilename(item),
  };
}

function collectionFileStatus(item) {
  const files = vectorMetadataFiles(item);
  if (files.length) return { label: 'File tersimpan', type: 'success', rank: 2 };
  if (item?.uuid) return { label: 'Metadata kosong', type: 'neutral', rank: 1 };
  return { label: 'Belum ada file', type: 'neutral', rank: 0 };
}

function mergeCollectionDetail(item, payload) {
  if (Array.isArray(payload)) return { ...item, data: payload };
  if (Array.isArray(payload?.data)) return { ...item, ...payload, data: payload.data };

  const detail = unwrapDetailPayload(payload);
  return { ...item, ...detail, uuid: detail.uuid || item.uuid };
}

export function VectorCollectionsPage() {
  return <Navigate to={routeByModule.vectorKnowledgeUpload} replace />;
}

export function VectorKnowledgeUploadPage({ data, apiStatus, loading, loadData }) {
  const statusWarning = apiStatus.includes('gagal') || apiStatus.includes('belum');
  const vectorCollections = data.vectorCollections || [];
  const semanticCollections = data.semanticSearches || [];
  const collectionCount = vectorCollections.length || semanticCollections.length || 0;

  return (
    <div className="vector-page">
      <PageHeader
        config={vectorKnowledgeUploadPage}
        eyebrow="Knowledge Upload"
        countLabel={`${collectionCount} collections`}
        onRefresh={loadData}
      />
      <StatusStrip warning={statusWarning}>{loading ? 'Memuat data collection...' : apiStatus}</StatusStrip>
      <VectorCollectionPanel semanticCollections={semanticCollections} vectorCollections={vectorCollections} loading={loading} onRefresh={loadData} />
    </div>
  );
}

export function VectorCollectionFilesPage({ data, apiStatus, loading, loadData }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('neutral');
  const [fileAction, setFileAction] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [sort, setSort] = useState({ column: 'collection', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const statusWarning = apiStatus.includes('gagal') || apiStatus.includes('belum');
  const vectorCollections = data.vectorCollections || [];

  const filteredCollections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return vectorCollections;
    return vectorCollections.filter((item) => vectorCollectionSearchText(item)
      .toLowerCase()
      .includes(needle));
  }, [query, vectorCollections]);

  const sortedCollections = useMemo(() => {
    return [...filteredCollections].sort((left, right) => {
      const valueByColumn = {
        collection: [vectorCollectionName(left), vectorCollectionName(right)],
        file: [vectorCollectionFileLabel(left) || vectorCollectionName(left), vectorCollectionFileLabel(right) || vectorCollectionName(right)],
        status: [collectionFileStatus(left).rank, collectionFileStatus(right).rank],
      };
      const [leftValue, rightValue] = valueByColumn[sort.column] || valueByColumn.collection;
      const result = compareValues(leftValue, rightValue);
      return sort.direction === 'asc' ? result : -result;
    });
  }, [filteredCollections, sort]);
  const totalPages = Math.max(1, Math.ceil(sortedCollections.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = sortedCollections.length ? (currentPage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, sortedCollections.length);
  const paginatedCollections = useMemo(() => sortedCollections.slice(startIndex, endIndex), [endIndex, sortedCollections, startIndex]);
  const paginationPages = pageWindow(currentPage, totalPages);
  const canPrevious = currentPage > 1;
  const canNext = currentPage < totalPages;

  function updateQuery(value) {
    setQuery(value);
    setPage(1);
  }

  function updatePageSize(value) {
    setPageSize(Number(value));
    setPage(1);
  }

  function goToPage(nextPage) {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  }

  function updateSort(column) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  }

  function SortHeader({ column, label }) {
    const active = sort.column === column;
    return (
      <button
        className={active ? 'sort-header active' : 'sort-header'}
        type="button"
        onClick={() => updateSort(column)}
        aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <SortIcon active={active} direction={sort.direction} />
      </button>
    );
  }

  async function openCollectionDetail(item) {
    if (!item?.uuid) {
      setSelectedFile(item);
      return;
    }

    setFileAction(`detail-${item.uuid}`);
    setStatusType('neutral');
    setStatus(`Memuat detail ${vectorCollectionName(item)}...`);

    try {
      const payload = await api.vectorCollectionDetail(item.uuid);
      setSelectedFile(mergeCollectionDetail(item, payload));
      setStatus('');
    } catch (error) {
      setSelectedFile(item);
      setStatusType('error');
      setStatus(`Detail belum berhasil dibuka, memakai data dari daftar: ${error.message || 'request gagal'}.`);
    } finally {
      setFileAction('');
    }
  }

  async function viewFile(item) {
    const hasTextFallback = Boolean(vectorDetailTextContent(item));
    if (!item?.uuid && !hasTextFallback) return;
    let previewWindow;

    try {
      previewWindow = reserveFilePreviewTab();
    } catch (error) {
      setStatusType('error');
      setStatus(error.message || 'Tab baru tidak bisa dibuka.');
      return;
    }

    setFileAction(`view-${item.uuid}`);
    setStatusType('neutral');
    setStatus('Membuka file di tab baru...');

    try {
      const file = item.uuid ? await api.vectorCollectionFile(item.uuid) : textFallbackFile(item);
      openFilePreview(file, previewWindow);
      setStatusType('success');
      setStatus(`File dibuka di tab baru: ${vectorCollectionName(item)}.`);
    } catch (error) {
      if (hasTextFallback) {
        openFilePreview(textFallbackFile(item), previewWindow);
        setStatusType('success');
        setStatus(`File asli belum tersedia dari endpoint download. Preview TXT dibuat dari isi knowledge: ${vectorCollectionName(item)}.`);
      } else {
        previewWindow?.close();
        setStatusType('error');
        setStatus(error.message || 'Gagal membuka file collection.');
      }
    } finally {
      setFileAction('');
    }
  }

  async function downloadSelectedFile(item) {
    const hasTextFallback = Boolean(vectorDetailTextContent(item));
    if (!item?.uuid && !hasTextFallback) return;
    setFileAction(`download-${item.uuid}`);
    setStatusType('neutral');
    setStatus('Menyiapkan download file...');

    try {
      const file = item.uuid ? await api.vectorCollectionFile(item.uuid) : textFallbackFile(item);
      downloadFile({ ...file, fallbackName: vectorCollectionFileLabel(item) || vectorCollectionName(item) || item.uuid });
      setStatusType('success');
      setStatus(`File didownload: ${vectorCollectionName(item)}.`);
    } catch (error) {
      if (hasTextFallback) {
        downloadFile(textFallbackFile(item));
        setStatusType('success');
        setStatus(`File asli belum tersedia dari endpoint download. TXT dibuat dari isi knowledge: ${vectorCollectionName(item)}.`);
      } else {
        setStatusType('error');
        setStatus(error.message || 'Gagal download file collection.');
      }
    } finally {
      setFileAction('');
    }
  }

  async function deleteSelectedCollection(item) {
    if (!item?.uuid) return;
    const name = vectorCollectionName(item);
    const confirmed = window.confirm(`Hapus knowledge collection ${name}? Semantic Search registry tetap ada, tapi file/vector collection native akan dihapus.`);
    if (!confirmed) return;

    setFileAction(`delete-${item.uuid}`);
    setStatusType('neutral');
    setStatus(`Menghapus knowledge collection ${name}...`);

    try {
      await api.deleteVectorCollection(item.uuid);
      clearVectorIndexFailure(name);
      setSelectedFile(null);
      setStatusType('success');
      setStatus(`Knowledge collection ${name} berhasil dihapus. Semantic Search registry tetap tersedia.`);
      await loadData?.();
    } catch (error) {
      setStatusType('error');
      setStatus(error.message || 'Gagal menghapus knowledge collection.');
    } finally {
      setFileAction('');
    }
  }

  return (
    <div className="vector-page">
      <PageHeader
        config={vectorCollectionFilesPage}
        eyebrow="Collection Knowledge"
        countLabel={`${vectorCollections.length} collections`}
        onRefresh={loadData}
      />
      <StatusStrip warning={statusWarning}>{loading ? 'Memuat collection knowledge...' : apiStatus}</StatusStrip>

      <section className="data-panel collection-files-panel">
        <div className="panel-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Cari collection atau isi knowledge" />
          </div>
        </div>

        <div className="table-wrap collection-files-table-wrap">
          <table className="resource-table resource-vector-collection-files">
            <thead>
              <tr>
                <th className="col-row-number">No</th>
                <th className="col-collection"><SortHeader column="collection" label="Collection" /></th>
                <th className="col-file"><SortHeader column="file" label="Isi Knowledge" /></th>
                <th className="col-status"><SortHeader column="status" label="Status" /></th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCollections.map((item, index) => {
                const name = vectorCollectionName(item);
                const files = vectorMetadataFiles(item);
                const fileLabel = vectorCollectionFileLabel(item);
                const indexFailure = getVectorIndexFailure(name);
                const fileStatus = collectionFileStatus(item);
                return (
                  <tr key={item.uuid || name} className="clickable-row" onClick={() => openCollectionDetail(item)}>
                    <td className="cell-row-number">{startIndex + index + 1}</td>
                    <td className="cell-collection"><strong title={name}>{name}</strong></td>
                    <td className="cell-file" title={files.map((entry) => entry.label).join(', ') || 'Metadata file dari API kosong'}>
                      <span>{files.length > 1 ? `${files.length} file tersimpan` : fileLabel || 'Metadata file kosong'}</span>
                      {indexFailure && <small className="index-warning">Indexing gagal</small>}
                    </td>
                    <td className="cell-status">
                      <span className={`status-pill ${indexFailure ? 'warning' : fileStatus.type}`}>{indexFailure ? 'Indexing gagal' : fileStatus.label}</span>
                    </td>
                    <td className="row-actions" onClick={(event) => event.stopPropagation()}>
                      <button className="secondary-button" type="button" onClick={() => openCollectionDetail(item)} disabled={loading || !item.uuid || Boolean(fileAction)}>{fileAction === `detail-${item.uuid}` ? 'Loading...' : 'Detail'}</button>
                    </td>
                  </tr>
                );
              })}
              {!sortedCollections.length && (
                <tr>
                  <td colSpan="5" className="empty-state">
                    <Boxes size={28} />
                    {vectorCollections.length ? 'Tidak ada data untuk filter ini.' : 'Belum ada knowledge collection tersimpan.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-pagination">
          <div className="pagination-meta">
            <label className="rows-per-page">
              <span>Rows per page</span>
              <select value={pageSize} onChange={(event) => updatePageSize(event.target.value)}>
                {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <span>Showing {sortedCollections.length ? startIndex + 1 : 0} to {endIndex} of {sortedCollections.length} records</span>
          </div>
          <div className="pagination-controls">
            <button className="pagination-button" type="button" onClick={() => goToPage(1)} disabled={!canPrevious}>First</button>
            <button className="pagination-button icon" type="button" onClick={() => goToPage(currentPage - 1)} disabled={!canPrevious} title="Previous page">
              <ChevronLeft size={16} />
            </button>
            {paginationPages.map((pageNumber) => (
              <button
                key={pageNumber}
                className={pageNumber === currentPage ? 'pagination-button active' : 'pagination-button'}
                type="button"
                onClick={() => goToPage(pageNumber)}
                aria-current={pageNumber === currentPage ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}
            <button className="pagination-button icon" type="button" onClick={() => goToPage(currentPage + 1)} disabled={!canNext} title="Next page">
              <ChevronRight size={16} />
            </button>
            <button className="pagination-button" type="button" onClick={() => goToPage(totalPages)} disabled={!canNext}>Last</button>
          </div>
        </div>

        <div className={`vector-status ${statusType}`}>{status || `${sortedCollections.length} collection knowledge ditampilkan.`}</div>
      </section>

      {selectedFile && (
        (() => {
          const selectedFiles = vectorMetadataFiles(selectedFile);
          const hasOriginalFile = selectedFiles.length > 0;
          const indexFailure = getVectorIndexFailure(vectorCollectionName(selectedFile));
          const detailTexts = vectorDetailTextItems(selectedFile);
          const hasTextFallback = detailTexts.length > 0;
          const useTextFallbackLabel = !hasOriginalFile && hasTextFallback;
          const canOpenKnowledge = Boolean(selectedFile.uuid || hasTextFallback);
          const uploadedLabel = formatCollectionTime(selectedFile);
          return (
        <aside className="drawer-backdrop">
          <section className="detail-drawer collection-file-drawer">
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Collection Knowledge</p>
                <h2>{vectorCollectionName(selectedFile)}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setSelectedFile(null)}><X size={18} /></button>
            </div>

            <dl className="detail-list">
              <div><dt>Collection</dt><dd>{vectorCollectionName(selectedFile)}</dd></div>
              <div><dt>Isi knowledge</dt><dd>{vectorCollectionFileLabel(selectedFile) || (hasTextFallback ? 'Text knowledge tersedia' : 'Metadata file kosong')}</dd></div>
              <div><dt>Status</dt><dd>{hasOriginalFile ? 'File asli tersimpan' : hasTextFallback ? 'Text chunks tersedia' : selectedFile.uuid ? 'Metadata kosong' : 'Belum tersimpan'}</dd></div>
              {uploadedLabel !== '-' && <div><dt>Uploaded</dt><dd>{uploadedLabel}</dd></div>}
              <div><dt>UUID</dt><dd>{selectedFile.uuid || '-'}</dd></div>
            </dl>

            {selectedFiles.length > 1 && (
              <div className="collection-file-metadata-list">
                {selectedFiles.map((entry) => (
                  <span key={entry.id}>{entry.label}</span>
                ))}
              </div>
            )}

            {detailTexts.length > 0 && (
              <div className="text-preview-section">
                <p>Preview isi knowledge</p>
                <div className="collection-file-metadata-list text-preview-list">
                  {detailTexts.map((entry, index) => (
                    <span key={`${selectedFile.uuid || vectorCollectionName(selectedFile)}-text-${index}`}>{entry}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="hint-box collection-file-hint">
              <ExternalLink size={16} />
              <span>{hasOriginalFile ? 'File asli hanya dibuka setelah tombol Open File ditekan.' : hasTextFallback ? 'File asli belum tersedia dari metadata. Open atau Download akan mencoba endpoint file, lalu fallback ke TXT dari isi knowledge.' : 'Metadata file belum tersedia dari API list/detail. Open atau Download tetap akan mencoba endpoint file berdasarkan UUID.'}</span>
            </div>

            {indexFailure && (
              <div className="hint-box collection-file-hint warning">
                <span>{indexFailure.message || 'Indexing terakhir gagal. Upload ulang supaya search sinkron dengan file terbaru.'}</span>
              </div>
            )}

            <div className="drawer-actions">
              <button type="button" className="secondary-button" onClick={() => setSelectedFile(null)}>Tutup</button>
              <button type="button" className="primary-button danger-button" onClick={() => deleteSelectedCollection(selectedFile)} disabled={Boolean(fileAction) || !selectedFile.uuid}>
                <Trash2 size={16} />
                {fileAction === `delete-${selectedFile.uuid}` ? 'Deleting...' : 'Delete'}
              </button>
              <button type="button" className="secondary-button" onClick={() => downloadSelectedFile(selectedFile)} disabled={Boolean(fileAction) || !canOpenKnowledge}>
                <Download size={16} />
                {fileAction === `download-${selectedFile.uuid}` ? 'Downloading...' : useTextFallbackLabel ? 'Download TXT' : 'Download'}
              </button>
              <button type="button" className="primary-button" onClick={() => viewFile(selectedFile)} disabled={Boolean(fileAction) || !canOpenKnowledge}>
                <ExternalLink size={16} />
                {fileAction === `view-${selectedFile.uuid}` ? 'Opening...' : useTextFallbackLabel ? 'Open TXT' : 'Open File'}
              </button>
            </div>
          </section>
        </aside>
          );
        })()
      )}
    </div>
  );
}
