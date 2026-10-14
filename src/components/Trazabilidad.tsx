import { useEffect, useState } from 'react';
import { api, MESES } from './common';

function Nodo({ n, nivel, abierto }: { n: any; nivel: number; abierto: boolean }) {
  const [open, setOpen] = useState(abierto);
  const hijos = n.hijos?.length > 0;
  return (
    <div>
      <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-panel2" style={{ paddingLeft: 8 + nivel * 22 }}
        onClick={() => hijos && setOpen(!open)} aria-expanded={hijos ? open : undefined}>
        <span className="w-4 text-center muted">{hijos ? (open ? '▾' : '▸') : '·'}</span>
        <span className={nivel === 0 ? 'font-semibold' : ''}>{nivel === 0 ? `${n.id} ${n.nombre}` : nivel === 1 ? n.nombre : n.nombre}</span>
        <span className="chip ml-auto" style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}>{n.n}</span>
      </button>
      {open && hijos && n.hijos.map((h: any, i: number) => <Nodo key={i} n={h} nivel={nivel + 1} abierto={false} />)}
    </div>
  );
}

export default function Trazabilidad() {
  const [anio, setAnio] = useState(new Date().getFullYear()); const [mes, setMes] = useState('');
  const [d, setD] = useState<any>(null);
  useEffect(() => { api('GET', `/api/trazabilidad?anio=${anio}${mes ? '&mes=' + mes : ''}`).then(setD); }, [anio, mes]);
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-wrap items-end gap-3">
        <div><h1 className="text-xl font-semibold">Trazabilidad</h1>
          <p className="muted text-sm">Servicio › Rubro › Código del PDF, con la cantidad de partes en cada nivel.</p></div>
        <div className="ml-auto flex gap-2">
          <input className="inp w-20" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año" />
          <select className="inp" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
            <option value="">Todo el año</option>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>
      {d && (
        <>
          <div className="card p-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span><b>{d.total}</b> partes</span><span className="text-ok"><b>{d.revisados}</b> con código confirmado</span>
            <span className="text-warn"><b>{d.total - d.revisados}</b> pendientes de corrección</span>
          </div>
          <div className="card p-2">
            {d.tree.length === 0 && <p className="muted p-4 text-sm">Todavía no hay partes con código confirmado. Corregí los códigos en <a className="text-accent" href="#/catalogos">Catálogos</a> o cargá partes nuevos.</p>}
            {d.tree.map((s: any) => <Nodo key={s.id} n={s} nivel={0} abierto={true} />)}
          </div>
          {d.pendientes.length > 0 && (
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-semibold text-warn">Pendientes de corrección (por categoría vieja)</h2>
              <div className="flex flex-wrap gap-2">{d.pendientes.map((p: any, i: number) => (
                <span key={i} className="rounded-lg border border-line bg-panel2 px-3 py-1 text-sm">{p.categoria ?? 'sin categoría'} <b className="ml-1">{p.n}</b></span>))}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
