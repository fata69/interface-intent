const fileNameKeys = ['filename', 'file_name', 'original_name', 'originalName', 'title', 'name', 'fileName'];
const pathKeys = ['path', 'file_path', 'filePath', 'filepath', 'directory', 'url'];
const timeKeys = ['uploaded_at', 'uploadedAt', 'upload_time', 'uploadTime', 'updated_at', 'updatedAt', 'created_at', 'createdAt'];

function parseJsonLike(value) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!['{', '['].includes(trimmed[0])) return trimmed;

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function baseName(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const normalized = text.replaceAll('\\', '/');
  return normalized.split('/').filter(Boolean).pop() || text;
}

function firstValue(record, keys) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return '';
  for (const key of keys) {
    if (record[key]) return record[key];
  }
  return '';
}

function firstNestedValue(value, keys) {
  const parsed = parseJsonLike(value);
  if (!parsed) return '';
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const result = firstNestedValue(entry, keys);
      if (result) return result;
    }
    return '';
  }
  if (typeof parsed !== 'object') return '';

  const direct = firstValue(parsed, keys);
  if (direct) return direct;

  for (const value of Object.values(parsed)) {
    if (value && typeof value === 'object') {
      const nested = firstNestedValue(value, keys);
      if (nested) return nested;
    }
  }
  return '';
}

function normalizeMetadataEntry(entry) {
  const parsed = parseJsonLike(entry);
  if (!parsed) return null;

  if (typeof parsed === 'string') {
    return { label: baseName(parsed) || parsed, raw: parsed };
  }

  if (Array.isArray(parsed)) return parsed.map(normalizeMetadataEntry).filter(Boolean);

  const directFileName = firstValue(parsed, fileNameKeys);
  const directPath = firstValue(parsed, pathKeys);
  const nestedFile = parsed.file || parsed.document || parsed.upload || parsed.metadata;
  const nested = nestedFile && nestedFile !== parsed ? normalizeMetadataEntry(nestedFile) : null;
  const nestedEntry = Array.isArray(nested) ? nested[0] : nested;
  const label = directFileName || baseName(directPath) || nestedEntry?.label || '';

  if (!label && !directPath && !nestedEntry?.path) return null;

  return {
    label,
    raw: parsed,
    path: directPath || nestedEntry?.path || '',
    type: parsed.type || parsed.mime_type || parsed.mimeType || nestedEntry?.type || '',
  };
}

export function vectorCollectionName(item) {
  return item?.name || item?.collection_name || item?.uuid || '-';
}

export function vectorMetadataFiles(item) {
  const metadata = item?.cmetadata;
  if (!metadata) return [];

  const normalized = normalizeMetadataEntry(metadata);
  const entries = Array.isArray(normalized) ? normalized : [normalized];
  return entries
    .filter(Boolean)
    .map((entry, index) => ({
      ...entry,
      id: `${item?.uuid || vectorCollectionName(item)}-${index}`,
      label: entry.label || vectorCollectionName(item),
    }));
}

export function vectorCollectionFileLabel(item) {
  return vectorMetadataFiles(item)[0]?.label || '';
}

export function vectorCollectionTimeValue(item) {
  return firstValue(item, timeKeys) || firstNestedValue(item?.cmetadata, timeKeys) || '';
}

export function vectorCollectionSearchText(item) {
  return [
    vectorCollectionName(item),
    item?.uuid,
    item?.cmetadata,
    vectorCollectionTimeValue(item),
    ...vectorMetadataFiles(item).flatMap((entry) => [entry.label, entry.path, entry.type]),
  ].filter(Boolean).join(' ');
}
