import { useMemo, useState } from 'react';
import { api } from '../../api/client';
import { modules } from '../../config/resources';
import { actionTargetFields } from '../../config/resourceOptions';
import {
  emptyRecord,
  getActionTarget,
  labelFor,
  normalizeRecord,
  parameterSummary,
  preparePayload,
  validateRecord,
  visibleFields,
} from '../../utils/resourceUtils.jsx';

const pageSizeOptions = [10, 25, 50];

function pageWindow(currentPage, totalPages) {
  const windowSize = 5;
  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(1, Math.min(currentPage - halfWindow, totalPages - windowSize + 1));
  const end = Math.min(totalPages, start + windowSize - 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function sortValue(resource, row, column, data) {
  if (column === 'target') return getActionTarget(row, data).label;
  if (column === 'action_summary') {
    const action = data.actions?.find((entry) => String(entry.id) === String(row.action_id));
    if (!action) return row.action_id ?? '';
    const target = getActionTarget(action, data);
    return [action.action_type, target.label, parameterSummary(action.parameter_needed)].filter(Boolean).join(' ');
  }
  if (column.endsWith('_id')) {
    const relationMap = {
      action_id: 'actions',
      semantic_search_id: 'semanticSearches',
      external_data_id: 'externalData',
      ai_agent_id: 'agents',
      utility_id: 'utilities',
    };
    const relationResource = relationMap[column];
    return relationResource ? labelFor(relationResource, row[column], data) : row[column];
  }
  return row[column];
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const aNumber = Number(a);
  const bNumber = Number(b);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && String(a).trim() !== '' && String(b).trim() !== '') {
    return aNumber - bNumber;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function useResourceCrud({ resource, data, loadData, setApiStatus }) {
  const config = modules[resource];
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ column: config.columns.includes('id') ? 'id' : config.columns[0], direction: 'asc' });

  const capabilities = {
    canRead: api.can(resource, 'read'),
    canCreate: api.can(resource, 'create'),
    canUpdate: api.can(resource, 'update'),
    canRemove: api.can(resource, 'remove'),
  };
  const rows = data[resource] || [];

  const filteredRows = useMemo(() => {
    const needle = query.toLowerCase();
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(needle));
  }, [query, rows]);

  const sortedRows = useMemo(() => {
    if (!sort.column) return filteredRows;
    return [...filteredRows].sort((left, right) => {
      const result = compareValues(sortValue(resource, left, sort.column, data), sortValue(resource, right, sort.column, data));
      return sort.direction === 'asc' ? result : -result;
    });
  }, [data, filteredRows, resource, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRows.slice(startIndex, startIndex + pageSize);
  }, [currentPage, sortedRows, pageSize]);

  function updateQuery(value) {
    setQuery(value);
    setPage(1);
  }

  function goToPage(nextPage) {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
  }

  function updatePageSize(value) {
    setPageSize(Number(value));
    setPage(1);
  }

  function updateSort(column) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  }

  function updateFormField(field, value) {
    setForm((current) => {
      const next = { ...current, [field.key]: value };
      if (resource === 'actions' && field.key === 'action_type') {
        actionTargetFields.forEach((targetField) => {
          next[targetField] = '';
        });
      }
      if (resource === 'actions' && actionTargetFields.includes(field.key)) {
        actionTargetFields.forEach((targetField) => {
          if (targetField !== field.key) next[targetField] = '';
        });
      }
      return next;
    });
  }

  function formatJsonField(field) {
    setForm((current) => {
      try {
        return { ...current, [field.key]: JSON.stringify(JSON.parse(current[field.key] || '{}'), null, 2) };
      } catch {
        return current;
      }
    });
  }

  function openCreate() {
    if (!capabilities.canCreate) return;
    setModal({ mode: 'create', resource });
    setForm(emptyRecord(config.fields));
    setErrors([]);
  }

  async function getDetailOrRow(row) {
    if (!api.can(resource, 'detail')) return row;
    try {
      return normalizeRecord(await api.detail(resource, row.id));
    } catch {
      setApiStatus(`Endpoint detail ${config.singular} gagal, memakai data dari list.`);
      return row;
    }
  }

  async function openEdit(row) {
    if (!capabilities.canUpdate) return;
    setErrors([]);
    setBusy(true);
    try {
      const detail = await getDetailOrRow(row);
      setModal({ mode: 'edit', resource, id: row.id });
      setForm({ ...emptyRecord(config.fields), ...row, ...detail });
    } catch (error) {
      setErrors([`Gagal membuka form edit: ${error.message || 'request gagal'}.`]);
    } finally {
      setBusy(false);
    }
  }

  async function openDrawer(row) {
    setErrors([]);
    setBusy(true);
    try {
      const detail = await getDetailOrRow(row);
      setDrawer({ resource, row: { ...row, ...detail } });
    } catch (error) {
      setDrawer({ resource, row });
    } finally {
      setBusy(false);
    }
  }

  async function saveForm(event) {
    event.preventDefault();
    const nextErrors = validateRecord(resource, form);
    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }

    const payload = preparePayload(resource, form);
    setBusy(true);
    try {
      if (modal.mode === 'create') await api.create(resource, payload);
      if (modal.mode === 'edit') await api.update(resource, modal.id, payload);
      setApiStatus('Perubahan berhasil dikirim ke API.');
      await loadData();
    } catch (error) {
      setErrors([`Gagal menyimpan ke API: ${error.message || 'request gagal'}.`]);
      setApiStatus('Perubahan tidak disimpan karena API gagal merespons.');
      return;
    } finally {
      setBusy(false);
    }
    setModal(null);
  }

  function deleteRow(row) {
    if (!capabilities.canRemove) return;
    setErrors([]);
    setConfirmation({
      row,
      title: `Delete ${config.singular}`,
      message: `Hapus ${config.singular} #${row.id}? Data yang sudah dihapus tidak bisa dikembalikan dari dashboard ini.`,
      confirmLabel: 'Delete',
      busy: false,
    });
  }

  async function confirmDelete() {
    if (!confirmation?.row) return;
    setConfirmation((current) => ({ ...current, busy: true }));
    try {
      await api.remove(resource, confirmation.row.id);
      await loadData();
      setApiStatus('Data berhasil dihapus dari API.');
      setConfirmation(null);
    } catch (error) {
      setErrors([`Gagal menghapus dari API: ${error.message || 'request gagal'}.`]);
      setApiStatus('Data tidak dihapus karena API gagal merespons.');
      setConfirmation(null);
    }
  }

  const visibleFormFields = modal ? visibleFields(modal.resource, modules[modal.resource].fields, form) : [];

  return {
    busy,
    capabilities,
    config,
    confirmation,
    drawer,
    errors,
    filteredRows,
    form,
    modal,
    paginatedRows,
    pagination: {
      page: currentPage,
      pageSize,
      pageSizeOptions,
      pages: pageWindow(currentPage, totalPages),
      totalPages,
      totalRows: filteredRows.length,
      start: filteredRows.length ? (currentPage - 1) * pageSize + 1 : 0,
      end: Math.min(currentPage * pageSize, filteredRows.length),
      canPrevious: currentPage > 1,
      canNext: currentPage < totalPages,
      firstPage: () => goToPage(1),
      lastPage: () => goToPage(totalPages),
      goToPage,
      nextPage: () => goToPage(currentPage + 1),
      previousPage: () => goToPage(currentPage - 1),
      setPageSize: updatePageSize,
    },
    query,
    sort,
    deleteRow,
    confirmDelete,
    formatJsonField,
    openCreate,
    openDrawer,
    openEdit,
    saveForm,
    setDrawer,
    setModal,
    setConfirmation,
    setQuery: updateQuery,
    setSort: updateSort,
    updateFormField,
    visibleFormFields,
  };
}
