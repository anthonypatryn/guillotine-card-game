import { useCallback, useEffect, useRef, useState } from 'react';

// On-brand replacements for the browser's own confirm()/checkbox/drop-down.

// const [confirmIt, dialog] = useConfirm();  …  if (await confirmIt({ title, body, yes, no, danger })) …;  render {dialog}
export function useConfirm() {
  const [ask, setAsk] = useState(null);
  const resolver = useRef(null);
  const confirmIt = useCallback((opts) => new Promise((resolve) => { resolver.current = resolve; setAsk(opts); }), []);
  const done = (v) => { resolver.current?.(v); resolver.current = null; setAsk(null); };
  const dialog = ask ? <ConfirmDialog {...ask} onYes={() => done(true)} onNo={() => done(false)} /> : null;
  return [confirmIt, dialog];
}

function ConfirmDialog({ title, body, yes = 'Yes', no = 'Cancel', danger, onYes, onNo }) {
  const yesRef = useRef(null);
  useEffect(() => {
    yesRef.current?.focus();
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onNo(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onNo]);
  return (
    <div className="modal-backdrop" onClick={onNo}>
      <div className="modal confirm-card" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <p className="modal-title">{title}</p>
        {body && <p className="muted small">{body}</p>}
        <div className="btns"><button className="btn" onClick={onNo}>{no}</button><button ref={yesRef} className={'btn ' + (danger ? 'danger' : 'primary')} onClick={onYes}>{yes}</button></div>
      </div>
    </div>
  );
}

// a switch in place of a checkbox
export function Toggle({ checked, onChange, children, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle-track"><span className="toggle-knob" /></span>{children && <span className="toggle-text">{children}</span>}
    </button>
  );
}

// a row of chips in place of a drop-down: options = [value, label][]
export function Chips({ value, onChange, options, small }) {
  return (
    <div className={`chips ${small ? 'small' : ''}`} role="radiogroup">
      {options.map(([v, l]) => <button type="button" key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}
