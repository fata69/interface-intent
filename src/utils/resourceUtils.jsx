import { modules } from '../config/resources';
import { actionTargetFields, actionTypeTarget, relationResourceByColumn } from '../config/resourceOptions';

export function emptyRecord(fields) {
  return fields.reduce((record, field) => {
    const value = field.type === 'json' ? '{}' : field.type === 'multiRelation' ? [] : '';
    return { ...record, [field.key]: value };
  }, {});
}

export function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

export function normalizeRecord(value) {
  if (value?.data && !Array.isArray(value.data)) return value.data;
  if (value?.item) return value.item;
  return value || {};
}

export function parameterSummary(value) {
  if (!value) return '';
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
    const keys = Object.keys(parsed);
    return keys.length ? `params: ${keys.slice(0, 3).join(', ')}` : '';
  } catch {
    return 'params: custom';
  }
}

export function itemLabel(resource, item, data) {
  if (!item) return '-';
  const id = item.id ?? item.uuid;

  if (resource === 'actions') {
    const target = getActionTarget(item, data);
    const params = parameterSummary(item.parameter_needed);
    return [`#${id}`, item.action_type || 'action', `-> ${target.label}`, params].filter(Boolean).join(' | ');
  }

  if (resource === 'agents') return `#${id} | ${item.agent_name || 'AI Agent'}${item.host ? ` | ${item.host}` : ''}`;
  if (resource === 'externalData') return `#${id} | ${item.protocol_request || 'external'}${item.host ? ` | ${item.host}` : ''}`;
  if (resource === 'semanticSearches') return `#${id} | ${item.collection_name || 'Semantic Search'}`;
  if (resource === 'utilities') return `#${id} | ${item.key || 'Utility'}`;
  if (resource === 'roles') return `#${id} | ${item.name || 'Role'}`;
  if (resource === 'usecases') return `#${id} | ${item.name || 'Usecase'}`;
  if (resource === 'users') return `#${id} | ${item.username || item.email || 'User'}`;

  return item.agent_name || item.collection_name || item.name || item.key || item.context || `#${id}`;
}

export function labelFor(resource, id, data) {
  const item = data[resource]?.find((entry) => String(entry.id ?? entry.uuid) === String(id));
  if (!item) return id || '-';
  return itemLabel(resource, item, data);
}

export function getActionTarget(action, data) {
  if (!action) return { type: '-', id: '', label: '-', resource: '', item: null };
  const key = actionTypeTarget[action.action_type] || actionTargetFields.find((field) => action[field]);
  const resource = relationResourceByColumn[key];
  const id = key ? action[key] : '';
  const item = resource ? data[resource]?.find((entry) => String(entry.id ?? entry.uuid) === String(id)) : null;
  return {
    type: action.action_type || '-',
    id,
    resource,
    item,
    label: resource ? labelFor(resource, id, data) : id || '-',
  };
}

function targetSummary(target) {
  const item = target.item || {};
  if (target.resource === 'externalData') {
    return {
      title: item.host || target.label,
      meta: [`#${target.id}`, item.protocol_request].filter(Boolean).join(' | '),
    };
  }
  if (target.resource === 'agents') {
    return {
      title: item.agent_name || target.label,
      meta: [`#${target.id}`, item.host].filter(Boolean).join(' | '),
    };
  }
  if (target.resource === 'semanticSearches') {
    return {
      title: item.collection_name || target.label,
      meta: `#${target.id}`,
    };
  }
  return { title: target.label, meta: target.id ? `#${target.id}` : '' };
}

export function validateJson(value) {
  if (!String(value || '').trim()) return '';
  try {
    JSON.parse(value);
    return '';
  } catch {
    return 'Format JSON tidak valid.';
  }
}

export function validateEmail(value) {
  const email = String(value || '').trim();
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Format email tidak valid. Gunakan format seperti nama@gmail.com.';
  }
  return '';
}

export function visibleFields(resource, fields, record) {
  if (resource !== 'actions') return fields;
  return fields.filter((field) => !field.actionType || field.actionType === record.action_type);
}

export function normalizeFormRecord(resource, record) {
  const next = { ...record };

  if (resource === 'users') {
    if (!next.role_id && next.role?.id) next.role_id = next.role.id;
    if (!Array.isArray(next.usecase_ids)) {
      if (Array.isArray(next.usecases)) {
        next.usecase_ids = next.usecases.map((usecase) => usecase.id).filter((id) => id != null);
      } else {
        next.usecase_ids = [];
      }
    }
    next.password = '';
  }

  if (resource === 'intents' && !next.usecase_id && next.usecase?.id) {
    next.usecase_id = next.usecase.id;
  }

  return next;
}

export function preparePayload(resource, record, mode = 'create') {
  const payload = { ...record };

  if (resource === 'semanticSearches') {
    payload.collection_name = String(payload.collection_name || '').trim();
  }

  if (resource === 'actions') {
    const activeTarget = actionTypeTarget[payload.action_type];
    actionTargetFields.forEach((field) => {
      if (field !== activeTarget) payload[field] = null;
    });
  }

  Object.keys(payload).forEach((key) => {
    if (key.endsWith('_id')) {
      payload[key] = payload[key] === '' || payload[key] == null ? null : Number(payload[key]);
    }
  });

  if (resource === 'users') {
    payload.role_id = payload.role_id === '' || payload.role_id == null ? null : Number(payload.role_id);
    payload.usecase_ids = Array.isArray(payload.usecase_ids)
      ? payload.usecase_ids.map(Number).filter((value) => Number.isFinite(value))
      : [];
    if (mode === 'edit' && !String(payload.password || '').trim()) delete payload.password;
    delete payload.role;
    delete payload.usecases;
  }

  delete payload.created_at;
  delete payload.updated_at;

  return payload;
}

function normalizeCollectionName(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateRecord(resource, record, mode = 'create', context = {}) {
  const errors = [];
  const config = modules[resource];

  for (const field of visibleFields(resource, config.fields, record)) {
    if (field.required && !String(record[field.key] ?? '').trim()) {
      errors.push(`${field.label} wajib diisi.`);
    }
    if (field.createRequired && mode === 'create' && !String(record[field.key] ?? '').trim()) {
      errors.push(`${field.label} wajib diisi.`);
    }
    if (field.type === 'json') {
      const jsonError = validateJson(record[field.key]);
      if (jsonError) errors.push(`${field.label}: ${jsonError}`);
    }
    if (field.type === 'email') {
      const emailError = validateEmail(record[field.key]);
      if (emailError) errors.push(`${field.label}: ${emailError}`);
    }
  }

  if (resource === 'actions') {
    const activeTarget = actionTypeTarget[record.action_type];
    if (!activeTarget) errors.push('Action Type wajib dipilih.');
    if (activeTarget && !String(record[activeTarget] || '').trim()) errors.push('Target action wajib dipilih.');
  }

  if (resource === 'semanticSearches') {
    const collectionName = normalizeCollectionName(record.collection_name);
    const duplicate = (context.rows || []).find((row) => (
      normalizeCollectionName(row.collection_name) === collectionName
      && String(row.id) !== String(context.currentId ?? record.id ?? '')
    ));
    if (collectionName && duplicate) errors.push('Collection name sudah dipakai. Gunakan nama lain.');
  }

  return errors;
}

export function renderValue(resource, row, column, data) {
  if (column === 'target') {
    const target = getActionTarget(row, data);
    const summary = targetSummary(target);
    return (
      <div className="target-cell">
        <span className="target-type">{target.type}</span>
        <div className="target-content">
          <strong title={summary.title}>{summary.title}</strong>
          {summary.meta && <small title={summary.meta}>{summary.meta}</small>}
        </div>
      </div>
    );
  }

  if (column === 'action_summary') {
    const action = (data.actions || []).find((entry) => String(entry.id) === String(row.action_id));
    if (!action) return <span className="muted-cell">{row.action_id || '-'}</span>;
    const target = getActionTarget(action, data);
    const summary = targetSummary(target);
    const params = parameterSummary(action.parameter_needed);
    return (
      <div className="action-summary-cell">
        <span className="target-type">{action.action_type || 'action'}</span>
        <div className="target-content">
          <strong title={summary.title}>{summary.title}</strong>
          <small title={[`#${action.id}`, summary.meta, params].filter(Boolean).join(' | ')}>{[`#${action.id}`, summary.meta, params].filter(Boolean).join(' | ')}</small>
        </div>
      </div>
    );
  }

  if (column === 'action_type' || column === 'protocol_request') {
    return <span className="badge">{row[column] || '-'}</span>;
  }

  if (column === 'parameter_needed' || column === 'header' || column === 'default_param' || column === 'metadata' || column === 'cmetadata') {
    return <code className="json-preview">{String(row[column] || '{}')}</code>;
  }

  if (relationResourceByColumn[column]) {
    return labelFor(relationResourceByColumn[column], row[column], data);
  }

  if (column === 'usecase_ids') {
    const ids = Array.isArray(row.usecase_ids)
      ? row.usecase_ids
      : Array.isArray(row.usecases)
        ? row.usecases.map((usecase) => usecase.id)
        : [];
    if (!ids.length) return <span className="muted-cell">-</span>;
    return ids.map((id) => labelFor('usecases', id, data)).join(', ');
  }

  return String(row[column] ?? '-');
}
