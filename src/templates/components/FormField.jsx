import { FileJson } from 'lucide-react';
import { labelFor } from '../../utils/resourceUtils.jsx';

export function FormField({ field, value, form = {}, data, error, autoFocus = false, disabled = false, onChange, onFormat }) {
  const wide = field.type === 'textarea' || field.type === 'json' || field.type === 'multiRelation';
  const Wrapper = field.type === 'multiRelation' ? 'div' : 'label';
  return (
    <Wrapper className={`${wide ? 'wide ' : ''}${field.type === 'multiRelation' ? 'form-field' : ''}`}>
      <span>{field.label}</span>
      <Field field={field} value={value} form={form} data={data} autoFocus={autoFocus} disabled={disabled} onChange={onChange} />
      {field.type === 'json' && (
        <div className="field-actions">
          <button type="button" className="text-button" onClick={onFormat} disabled={disabled || Boolean(error)}>
            <FileJson size={14} /> Format JSON
          </button>
          <span className={error ? 'field-error' : 'field-valid'}>{error || 'JSON valid'}</span>
        </div>
      )}
      {field.type !== 'json' && error && <span className="field-error">{error}</span>}
    </Wrapper>
  );
}

function relationOptions(field, data, form) {
  const options = data[field.resource] || [];
  if (field.key !== 'action_id' || field.resource !== 'actions') return options;

  const currentIntentId = String(form.id ?? '');
  const currentActionId = String(form.action_id ?? '');
  const usedActionIds = new Set((data.intents || [])
    .filter((intent) => String(intent.id ?? '') !== currentIntentId)
    .map((intent) => String(intent.action_id ?? ''))
    .filter(Boolean));

  return options.filter((item) => {
    const optionId = String(item.id ?? item.uuid);
    return optionId === currentActionId || !usedActionIds.has(optionId);
  });
}

function Field({ field, value, form, data, autoFocus, disabled, onChange }) {
  if (field.type === 'select') {
    return (
      <select value={value} onChange={(event) => onChange(event.target.value)} autoFocus={autoFocus} disabled={disabled}>
        <option value="">Select option</option>
        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }

  if (field.type === 'relation') {
    const options = relationOptions(field, data, form);
    return (
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} autoFocus={autoFocus} disabled={disabled}>
        <option value="">None</option>
        {options.map((item) => (
          <option key={item.id ?? item.uuid} value={item.id ?? item.uuid}>{labelFor(field.resource, item.id ?? item.uuid, data)}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'multiRelation') {
    const selectedValues = Array.isArray(value) ? value.map(String) : String(value || '').split(',').filter(Boolean);

    function toggleValue(nextValue) {
      const nextValueString = String(nextValue);
      if (selectedValues.includes(nextValueString)) {
        onChange(selectedValues.filter((item) => item !== nextValueString));
        return;
      }
      onChange([...selectedValues, nextValueString]);
    }

    return (
      <div className="multi-relation-field">
        {(data[field.resource] || []).map((item) => {
          const itemValue = item.id ?? item.uuid;
          const itemValueString = String(itemValue);
          return (
            <label className="multi-relation-option" key={itemValueString}>
              <input
                type="checkbox"
                checked={selectedValues.includes(itemValueString)}
                onChange={() => toggleValue(itemValue)}
                disabled={disabled}
              />
              <span>{labelFor(field.resource, itemValue, data)}</span>
            </label>
          );
        })}
        {(data[field.resource] || []).length === 0 && <span className="muted-cell">Tidak ada opsi tersedia.</span>}
      </div>
    );
  }

  if (field.type === 'textarea' || field.type === 'json') {
    return <textarea rows={field.type === 'json' ? 5 : 3} value={value} placeholder={field.placeholder || ''} onChange={(event) => onChange(event.target.value)} autoFocus={autoFocus} disabled={disabled} />;
  }

  const inputType = field.type === 'password' || field.type === 'email' ? field.type : 'text';
  return <input type={inputType} value={value} placeholder={field.placeholder || ''} onChange={(event) => onChange(event.target.value)} autoFocus={autoFocus} disabled={disabled} />;
}
