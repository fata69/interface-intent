import { useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { modules } from '../../config/resources';
import { validateEmail, validateJson } from '../../utils/resourceUtils.jsx';
import { FormField } from './FormField';

export function ResourceModal({ modal, form, errors, visibleFields, data, busy = false, onChangeField, onFormatJson, onClose, onSubmit }) {
  useEffect(() => {
    if (!modal || busy) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, modal, onClose]);

  if (!modal) return null;
  const config = modules[modal.resource];
  const actionLabel = modal.mode === 'create' ? 'Create' : 'Update';
  const submitLabel = `${actionLabel} ${config.singular}`;

  function fieldError(field) {
    if (field.type === 'json') return validateJson(form[field.key]);
    if (field.type === 'email') return validateEmail(form[field.key]);
    return '';
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={onSubmit} aria-busy={busy} noValidate>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{actionLabel}</p>
            <h2>{config.singular}</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy} title="Close modal">
            <X size={18} />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="error-box">
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        )}

        {modal.resource === 'actions' && !form.action_type && (
          <div className="hint-box"><Info size={16} />Pilih Action Type dulu untuk menampilkan target yang relevan.</div>
        )}

        <div className="form-grid">
          {visibleFields.map((field, index) => (
            <FormField
              key={field.key}
              field={field}
              value={form[field.key] ?? ''}
              data={data}
              error={fieldError(field)}
              autoFocus={index === 0}
              disabled={busy}
              onChange={(value) => onChangeField(field, value)}
              onFormat={() => onFormatJson(field)}
            />
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving...' : submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
