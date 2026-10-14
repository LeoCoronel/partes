import { useEffect, useState } from 'react';
import { api, useToast } from './common';

export default function PersonalManager() {
  const [per, setPer] = useState<any[]>([]); const [jer, setJer] = useState<any[]>([]);
  const [filtro, setFiltro] = useState(''); const toast = useToast();
  const [f, setF] = useState<any>({ legajo: '', nombre: '', jerarquia: 'Bombero', j: '' });
  const [sug, setSug] = useState<number | null>(null);

  useEffect(() => { api('GET', '/api/catalogos').then((c) => { setPer(c.personal); setJer(c.jerarquias); }); }, []);
  useEffect(() => { api('GET', '/api/personal?jerarquia=' + encodeURIComponent(f.jerarquia)).then((r) => setSug(r.sugerido)); }, [f.jerarquia, per.length]);

  const run = async (p: Promise<any>, ok?: string) => {
    try { const r = await p; if (Array.isArray(r)) setPer(r); else if (r.personal) setPer(r.personal); if (ok) toast.show(ok); return true; }
    catch (e: any) { toast.show(e.message); return false; }
  };
  const act = (id: number, body: any, ok?: string) => run(api('PATCH', `/api/personal/${id}`, body), ok);

  const activos = per.filter((p) => p.activo); const inactivos = per.filter((p) => !p.activo);
  const match = (p: any) => !filtro || `${p.legajo} ${p.nombre} ${p.jerarquia} J${p.j}`.toLowerCase().includes(filtro.toLowerCase());

  const add = async () => {
    if (!f.legajo || !f.nombre) return toast.show('Completá legajo y nombre.');
    if (await run(api('POST', '/api/personal', f), `${f.nombre.toUpperCase()} agregado`)) setF({ ...f, legajo: '', nombre: '', j: '' });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Gestión de personal</h1>
        <p className="muted text-sm max-w-3xl">El N° J es el orden por jerarquía y antigüedad: J1 es el jefe, J2 el segundo jefe, J3 el oficial siguiente, y así. Si agregás a alguien en un J, los de abajo bajan un lugar; si das de baja a alguien, los de abajo suben uno.
          Los partes guardan el legajo, así que cambiar el J no altera nada del historial.</p>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold">Agregar persona</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs muted">Legajo<input className="inp block w-20 mt-1" value={f.legajo} onChange={(e) => setF({ ...f, legajo: e.target.value })} /></label>
          <label className="text-xs muted">Apellido y nombre<input className="inp block w-64 mt-1" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
          <label className="text-xs muted">Jerarquía<select className="inp block mt-1" value={f.jerarquia} onChange={(e) => setF({ ...f, jerarquia: e.target.value })}>
            {[...jer].reverse().map((j) => <option key={j.nombre}>{j.nombre}</option>)}</select></label>
          <label className="text-xs muted">N° J (sugerido {sug ?? '…'})<input className="inp block w-24 mt-1" type="number" min={1} placeholder={String(sug ?? '')} value={f.j} onChange={(e) => setF({ ...f, j: e.target.value })} /></label>
          <button className="btn btn-primary" onClick={add}>Agregar</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input className="inp w-72" placeholder="Buscar legajo, nombre, jerarquía o J…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        <span className="muted text-sm">{activos.length} activos · {inactivos.length} de baja</span>
      </div>

      <div className="card overflow-auto max-h-[65vh]">
        <table className="tbl">
          <thead><tr><th>J</th><th>Legajo</th><th>Jerarquía</th><th>Apellido y nombre</th><th>Orden</th><th></th></tr></thead>
          <tbody>
            {activos.filter(match).map((p) => (
              <tr key={p.id}>
                <td className="w-16"><span className="chip bg-accent/20 text-accent">J{p.j}</span></td>
                <td><input className="inp w-16" defaultValue={p.legajo} onBlur={(e) => e.target.value !== p.legajo && act(p.id, { legajo: e.target.value })} /></td>
                <td><select className="inp" value={p.jerarquia} onChange={(e) => act(p.id, { jerarquia: e.target.value }, 'Jerarquía cambiada: revisá si cambia su J.')}>
                  {[...jer].reverse().map((j) => <option key={j.nombre}>{j.nombre}</option>)}</select></td>
                <td><input className="inp w-60" defaultValue={p.nombre} onBlur={(e) => e.target.value !== p.nombre && act(p.id, { nombre: e.target.value })} /></td>
                <td className="whitespace-nowrap">
                  <button className="btn" disabled={p.j === 1} onClick={() => act(p.id, { accion: 'mover', j: p.j - 1 })} title="Subir un J" aria-label="Subir">↑</button>{' '}
                  <button className="btn" disabled={p.j === activos.length} onClick={() => act(p.id, { accion: 'mover', j: p.j + 1 })} title="Bajar un J" aria-label="Bajar">↓</button>{' '}
                  <input className="inp w-16" type="number" min={1} placeholder="→ J" title="Mover a este J y presionar Enter"
                    onKeyDown={(e) => { if (e.key === 'Enter') { act(p.id, { accion: 'mover', j: Number((e.target as HTMLInputElement).value) }); (e.target as HTMLInputElement).value = ''; } }} />
                </td>
                <td className="whitespace-nowrap">
                  <button className="btn btn-danger" onClick={() => confirm(`¿Dar de baja a ${p.nombre}? Los de abajo suben un J.`) && act(p.id, { accion: 'baja' }, `${p.nombre} de baja`)}>Baja</button>{' '}
                  <button className="btn btn-danger" title="Borrar (solo si no tiene partes)" onClick={() => confirm(`¿Borrar a ${p.nombre}?`) && run(api('DELETE', `/api/personal/${p.id}`))}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inactivos.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-1 text-sm font-semibold">De baja o fuera del sistema de guardias</h2>
          <p className="muted mb-3 text-xs">Se conservan para que los partes viejos sigan mostrando su nombre. No ocupan un J.</p>
          <div className="flex flex-wrap gap-2">
            {inactivos.filter(match).map((p) => (
              <span key={p.id} className="flex items-center gap-2 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-sm">
                <span className="muted">{p.legajo}</span> {p.nombre} <span className="muted text-xs">{p.jerarquia}</span>
                <button className="btn" onClick={() => act(p.id, { accion: 'alta' }, `${p.nombre} dado de alta (ajustá su J si hace falta)`)}>Dar de alta</button>
              </span>
            ))}
          </div>
        </div>
      )}
      {toast.node}
    </div>
  );
}
