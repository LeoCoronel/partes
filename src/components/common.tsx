import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';

export const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
export const ESTADOS: Record<number, string> = { 0: 'FALTANTE', 1: 'CERRADO', 3: 'PERSONAL', 4: 'CAPACITACION' };
// Colores de la planilla: solo PERSONAL (texto azul) y CAPACITACION (fondo cyan, texto magenta). Faltante y cerrado van sin color.
export const ESTADO_COLOR: Record<number, string> = { 3: '#4a86e8', 4: '#00ffff' };
export const ESTADO_CELDA: Record<number, { bg: string; fg: string }> = { 3: { bg: '#ffffff', fg: '#4a86e8' }, 4: { bg: '#00ffff', fg: '#ff00ff' } };

export async function api(method: string, url: string, body?: unknown) {
  const { handle } = await import('../lib/localApi');
  return handle(method, url, body ?? {});
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<any>();
  const show = (m: string) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 4500); };
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return { show, node };
}

export function MesChip({ mes }: { mes: number | string | null }) {
  const i = typeof mes === 'number' ? mes - 1 : MESES.indexOf(String(mes));
  if (i < 0 || mes === null) return <span className="muted">—</span>;
  const h = (i * 30 + 350) % 360;
  return <span className="chip" style={{ background: `hsl(${h} 55% 20%)`, color: `hsl(${h} 85% 78%)` }}>{MESES[i]}</span>;
}

export function EstadoChip({ estado }: { estado: number }) {
  const c = ESTADO_COLOR[estado] ?? '#8a909c';  // sin color propio para 0 y 1
  return <span className="chip" style={{ background: `${c}26`, color: c }}>{estado} - {ESTADOS[estado] ?? '?'}</span>;
}

const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
export const codigoLabel = (c: any, sv?: any) =>
  `${c.servicio}-${c.cod} · ${(sv?.nombre ?? '')}${sv ? ' › ' : ''}${title(c.rubro)} › ${c.descripcion}`;

/** Combobox con búsqueda difusa y teclado: ↑↓ elegir, Enter/Tab confirmar, Esc cerrar. */
export function Combo<T>(props: {
  items: T[]; getKey: (t: T) => string | number; getLabel: (t: T) => string; getSearch?: (t: T) => string;
  value: T | null; onChange: (t: T | null) => void; placeholder?: string; quick?: (q: string) => T[] | null;
  inputRef?: React.Ref<HTMLInputElement>; onCommit?: () => void; className?: string; max?: number; allowClear?: boolean;
}) {
  const { items, getKey, getLabel, getSearch, value, onChange, placeholder, quick, inputRef, onCommit, className, max = 8, allowClear = true } = props;
  const [text, setText] = useState(''); const [open, setOpen] = useState(false); const [hi, setHi] = useState(0);
  const editing = useRef(false);
  const valueRef = useRef<T | null>(value); valueRef.current = value; // el blur usa siempre el valor más reciente
  useEffect(() => { if (!editing.current) setText(value ? getLabel(value) : ''); }, [value]);
  const fuse = useMemo(() => new Fuse(items, { keys: [{ name: 's', getFn: (t: T) => (getSearch ?? getLabel)(t) }], threshold: 0.35, ignoreLocation: true }), [items]);
  const results = useMemo(() => {
    const q = text.trim();
    if (!open) return [] as T[];
    if (!q || (value && q === getLabel(value))) return items.slice(0, max);
    const qk = quick?.(q); if (qk && qk.length) return qk.slice(0, max);
    return fuse.search(q, { limit: max }).map((r) => r.item);
  }, [text, open, items, value]);
  const pick = (t: T | null) => { onChange(t); editing.current = false; setText(t ? getLabel(t) : ''); setOpen(false); setHi(0); };
  return (
    <div className={`relative ${className ?? ''}`}>
      <input ref={inputRef} className="inp w-full" value={text} placeholder={placeholder}
        onFocus={(e) => { setOpen(true); e.currentTarget.select(); }}
        onBlur={() => setTimeout(() => { editing.current = false; setOpen(false); const v = valueRef.current; setText(v ? getLabel(v) : ''); }, 120)}
        onChange={(e) => { editing.current = true; setText(e.target.value); setOpen(true); setHi(0); if (!e.target.value && allowClear) onChange(null); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Escape') { setOpen(false); }
          else if ((e.key === 'Enter' || (e.key === 'Tab' && editing.current && text.trim())) && open && results[hi]) {
            if (e.key === 'Enter') e.preventDefault();
            pick(results[hi]); if (e.key === 'Enter') onCommit?.();
          } else if (e.key === 'Enter') { onCommit?.(); }
        }} />
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-[28rem] max-w-[90vw] overflow-auto rounded-lg border border-line bg-panel2 p-1 shadow-xl">
          {results.map((t, i) => (
            <li key={getKey(t)} onMouseDown={(e) => { e.preventDefault(); pick(t); onCommit?.(); }} onMouseEnter={() => setHi(i)}
              className={`cursor-pointer rounded-md px-2 py-1.5 text-sm ${i === hi ? 'bg-accent/20' : ''}`}>{getLabel(t)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Buscador de códigos del PDF. Acepta "1-12", "11.3", "pastizal", "forestal campos"… */
export function CodigoPicker({ codigos, servicios, value, onChange, placeholder, inputRef, onCommit, hintServicio }: {
  codigos: any[]; servicios: any[]; value: number | null; onChange: (id: number | null) => void; placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>; onCommit?: () => void; hintServicio?: string | null;
}) {
  const sv = useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios]);
  const byId = useMemo(() => new Map(codigos.map((c) => [c.id, c])), [codigos]);
  const items = useMemo(() => {
    if (!hintServicio) return codigos;
    return [...codigos.filter((c) => c.servicio === hintServicio), ...codigos.filter((c) => c.servicio !== hintServicio)];
  }, [codigos, hintServicio]);
  return (
    <Combo items={items} getKey={(c: any) => c.id} getLabel={(c: any) => codigoLabel(c, sv.get(c.servicio))}
      getSearch={(c: any) => `${c.servicio}-${c.cod} ${sv.get(c.servicio)?.nombre ?? ''} ${c.rubro} ${c.descripcion}`}
      value={value ? byId.get(value) ?? null : null} onChange={(c: any) => onChange(c ? c.id : null)}
      placeholder={placeholder ?? 'Código: 1-12, 11.3, pastizal…'} inputRef={inputRef} onCommit={onCommit}
      quick={(q) => {
        const m = q.match(/^(\d{1,2})\s*[-.\s]\s*(\d{1,3})$/);
        if (!m) return null;
        const s = m[1].padStart(2, '0'); const n = Number(m[2]);
        return codigos.filter((c) => c.servicio === s && c.cod === n);
      }} />
  );
}

export function PersonaPicker({ personal, value, onChange, inputRef, onCommit, placeholder }: {
  personal: any[]; value: number | null; onChange: (id: number | null) => void; inputRef?: React.Ref<HTMLInputElement>; onCommit?: () => void; placeholder?: string;
}) {
  const byId = useMemo(() => new Map(personal.map((p) => [p.id, p])), [personal]);
  const label = (p: any) => `${p.activo ? 'J' + p.j : 'baja'} · ${p.legajo} · ${p.jerarquia} · ${p.nombre}`;
  return (
    <Combo items={personal} getKey={(p: any) => p.id} getLabel={label}
      getSearch={(p: any) => `${p.legajo} ${p.nombre} ${p.jerarquia}`}
      value={value ? byId.get(value) ?? null : null} onChange={(p: any) => onChange(p ? p.id : null)}
      placeholder={placeholder ?? 'Legajo, J12 o nombre'} inputRef={inputRef} onCommit={onCommit}
      quick={(q) => {
        const j = q.match(/^j\s*(\d+)$/i); if (j) return personal.filter((p) => p.activo && p.j === Number(j[1]));
        if (/^\d{1,3}$/.test(q)) return personal.filter((p) => p.legajo === q.padStart(3, '0') || p.legajo.startsWith(q));
        return null;
      }} />
  );
}

export const personaCorta = (p: any) => (p ? `${p.legajo} · ${p.nombre}` : '—');
