const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

let authTokenProvider = () => '';
let unauthorizedHandler = () => {};

export const endpoints = {
  agents: { path: '/api/ai-agents/', read: true, detail: true, create: true, update: true, remove: true },
  actions: { path: '/api/actions/', read: true, detail: true, create: true, update: true, remove: true },
  intents: { path: '/api/intents/', read: true, detail: true, create: true, update: true, remove: true },
  externalData: { path: '/api/external-data/', read: true, detail: true, create: true, update: true, remove: true },
  semanticSearches: { path: '/api/semantic-searches/', read: true, detail: true, create: true, update: true, remove: true },
  utilities: { path: '/api/utilities', read: true, detail: false, create: true, update: false, remove: false },
  mappings: { path: '/api/ai-agent-utilities/', read: false, detail: false, create: true, update: false, remove: false },
  vectorCollections: { path: '/api/vector-collections', read: true, detail: true, create: true, update: false, remove: true },
  roles: { path: '/api/roles/', read: true, detail: false, create: true, update: false, remove: false },
  usecases: { path: '/api/usecases/', read: true, detail: true, create: true, update: true, remove: true },
  users: { path: '/api/users/', read: true, detail: true, create: true, update: true, remove: true },
};

export function configureAuth({ getToken, onUnauthorized } = {}) {
  authTokenProvider = typeof getToken === 'function' ? getToken : () => '';
  unauthorizedHandler = typeof onUnauthorized === 'function' ? onUnauthorized : () => {};
}

function getEndpoint(resource, action) {
  const endpoint = endpoints[resource];
  if (!endpoint?.path || !endpoint[action]) {
    throw new Error(`Fitur ${action} untuk ${resource} belum tersedia.`);
  }
  return endpoint.path;
}

function withId(path, id) {
  return `${path}${path.endsWith('/') ? '' : '/'}${id}`;
}

async function responseError(response) {
  const fallback = response.statusText || 'Request gagal';
  const text = await response.text().catch(() => fallback);
  if (!text) return fallback;
  const reusableActionConstraintMessage = 'Database masih membatasi satu Action untuk satu Intent. Hapus constraint intent_action_id_key agar satu Action bisa dipakai beberapa Intent.';

  if (text.includes('intent_action_id_key')) {
    return reusableActionConstraintMessage;
  }

  try {
    const payload = JSON.parse(text);
    const message = payload.error || payload.message || fallback;
    if (message.includes('intent_action_id_key')) {
      return reusableActionConstraintMessage;
    }
    return message;
  } catch {
    return text;
  }
}

async function request(path, options = {}) {
  const token = authTokenProvider();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const message = await responseError(response);
    if (response.status === 401) unauthorizedHandler();
    throw new Error(message || response.statusText);
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

async function requestContent(path, options = {}) {
  const token = authTokenProvider();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const message = await responseError(response);
    if (response.status === 401) unauthorizedHandler();
    throw new Error(message || response.statusText);
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json().catch(() => null);
  return response.text().catch(() => null);
}

function filenameFromDisposition(disposition) {
  if (!disposition) return '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || '';
}

async function requestFile(path, options = {}) {
  const token = authTokenProvider();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const message = await responseError(response);
    if (response.status === 401) unauthorizedHandler();
    throw new Error(message || response.statusText);
  }

  const blob = await response.blob();
  return {
    blob,
    contentType: response.headers.get('content-type') || blob.type || 'application/octet-stream',
    filename: filenameFromDisposition(response.headers.get('content-disposition')),
  };
}

async function requestFormData(path, formData, options = {}) {
  const token = authTokenProvider();
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    ...options,
  });

  if (!response.ok) {
    const message = await responseError(response);
    if (response.status === 401) unauthorizedHandler();
    throw new Error(message || response.statusText);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json().catch(() => null);
  return response.text().catch(() => null);
}

export const api = {
  can: (resource, action) => Boolean(endpoints[resource]?.path && endpoints[resource]?.[action]),
  list: (resource) => request(getEndpoint(resource, 'read')),
  detail: (resource, id) => request(withId(getEndpoint(resource, 'detail'), id)),
  create: (resource, payload) => request(getEndpoint(resource, 'create'), {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  update: (resource, id, payload) => request(withId(getEndpoint(resource, 'update'), id), {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  remove: (resource, id) => request(withId(getEndpoint(resource, 'remove'), id), { method: 'DELETE' }),
  login: (payload) => request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  me: () => request('/api/auth/me'),
  syncIntents: () => requestContent('/intent-sync', {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  sendAiChat: (payload) => requestContent('/chat-webhook', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  indexVectorKnowledge: (payload) => requestContent('/vector-webhook', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  indexVectorKnowledgeFile: (formData) => requestFormData('/vector-webhook', formData),
  assignUserRole: (id, roleId) => request(withId(endpoints.users.path, `${id}/role`), {
    method: 'PUT',
    body: JSON.stringify({ role_id: Number(roleId) }),
  }),
  vectorCollectionDetail: (uuid) => request(withId(endpoints.vectorCollections.path, uuid)),
  vectorCollectionFile: (uuid) => requestFile(`${withId(endpoints.vectorCollections.path, uuid)}/download`),
  deleteVectorCollection: (uuid) => request(withId(endpoints.vectorCollections.path, uuid), { method: 'DELETE' }),
  createVectorCollection: (payload) => request(endpoints.vectorCollections.path, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  uploadVectorCollectionFile: (uuid, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return requestFormData(`${withId(endpoints.vectorCollections.path, uuid)}/upload`, formData);
  },
};
