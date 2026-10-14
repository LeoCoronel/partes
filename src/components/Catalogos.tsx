import { useEffect, useMemo, useState } from 'react';
import { api, useToast, CodigoPicker, codigoLabel } from './common';

export default function Catalogos() {
  const [cat, setCat] = useState<any>({ codigos: [], servicios: [], categorias: [] });
  const [nuevo, setNuevo] = useState({ servicio: '01', rubro: '', descripcion: '' });
  const [tab, setTab] = useState<'pend' | 'cat' | 'cod'>('pend'); const [q, setQ] = useState(''); const toast = useToast();
  const load = () => api('GET', '/api/catalogos').then(setCat);
  useEffect(() => { load(); }, []);
  const sv = useMemo(() => new Map(cat.servicios.map((s: any) => [s.id, s])), [cat.servicios]);
  const byId = useMemo(() => new Map(cat.codigos.map((c: any) => [c.id, c])), [cat.codigos]);

  const setCodigo = async (c: any, id: number | null) => { await api('PATCH', `/api/categorias/${c.id}`, { codigo_id: id }); load(); };
  const aplicar = async (c: any) => {
    if (!c.codigo_id) return toast.show('Primero elegí un código para esta categoría.');
    const r = await api('POST', '/api/partes/bulk', { categoria_id: c.id, codigo_id: c.codigo_id });
    toast.show(`${r.cambiados} partes corregidos con ese código.`); load();
  };
  const confirmar = async (c: any) => {
    const r = await api('POST', '/api/partes/bulk', { categoria_id: c.id, confirmar: true });
    toast.show(`${r.cambiados} partes confirmados.`); load();
  };
  const crear = async () => {
    try { await api('POST', '/api/codigos', nuevo); toast.show('Código propio creado.'); setNuevo({ ...nuevo, descripcion: '' }); load(); }
    catch (e: any) { toast.show(e.message); }
  };
  const borrar = async (c: any) => { try { await api('DELETE', `/api/codigos/${c.id}`); toast.show('Código borrado.'); load(); } catch (e: any) { toast.show(e.message); } };
  const rubros = [...new Set(cat.codigos.filter((c: any) => c.servicio === nuevo.servicio).map((c: any) => c.rubro))] as string[];
  const pendCats = cat.categorias.filter((c: any) => c.pendientes > 0).sort((a: any, b: any) => b.pendientes - a.pendientes);
  const pendTotal = pendCats.reduce((t: number, c: any) => t + c.pendientes, 0);
  const cods = cat.codigos.filter((c: any) => !q || `${c.servicio}-${c.cod} ${c.rubro} ${c.descripcion} ${sv.get(c.servicio)?.nombre}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Catálogos y códigos</h1>
        <p className="muted text-sm max-w-2xl">Acá resolvés los partes que todavía no tienen un código GIB confirmado.</p>
      </div>
      <div className="flex gap-2">
        <button className={`btn ${tab === 'pend' ? 'btn-primary' : ''}`} onClick={() => setTab('pend')}>Por resolver ({pendCats.length})</button>
        <button className={`btn ${tab === 'cat' ? 'btn-primary' : ''}`} onClick={() => setTab('cat')}>Todas las categorías</button>
        <button className={`btn ${tab === 'cod' ? 'btn-primary' : ''}`} onClick={() => setTab('cod')}>Códigos ({cat.codigos.length})</button>
      </div>

      {tab === 'pend' && (
        pendCats.length === 0
          ? <div className="card p-8 text-center"><div className="text-3xl">✅</div><p className="mt-2 font-semibold">Todo resuelto</p><p className="muted text-sm">No quedan partes sin código confirmado.</p></div>
          : (
            <div className="flex flex-col gap-3 max-w-4xl">
              <p className="muted text-sm">{pendTotal} partes en {pendCats.length} categorías. Elegí el código y tocá Aplicar: se lo ponés a todos los de esa categoría de una vez.</p>
              {pendCats.map((c: any) => (
                <div key={c.id} className="card p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-48 grow"><div className="font-semibold">{c.nombre}</div><div className="muted text-sm">{c.pendientes} partes</div></div>
                  <div className="w-full md:w-[26rem]"><CodigoPicker codigos={cat.codigos} servicios={cat.servicios} value={c.codigo_id} hintServicio={c.servicio} onChange={(id) => setCodigo(c, id)} /></div>
                  <button className="btn btn-primary" disabled={!c.codigo_id} onClick={() => aplicar(c)}>Aplicar a {c.pendientes}</button>
                </div>
              ))}
            </div>
          )
      )}

      {tab === 'cat' && (
        <div className="card overflow-auto max-h-[70vh]">
          <table className="tbl">
            <thead><tr><th>Categoría de la planilla</th><th>Partes</th><th>Sin revisar</th><th className="w-[26rem]">Código GIB sugerido</th><th></th></tr></thead>
            <tbody>
              {cat.categorias.map((c: any) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.nombre}</td>
                  <td>{c.partes}</td>
                  <td className={c.pendientes ? 'text-warn font-semibold' : 'muted'}>{c.pendientes}</td>
                  <td><CodigoPicker codigos={cat.codigos} servicios={cat.servicios} value={c.codigo_id} hintServicio={c.servicio} onChange={(id) => setCodigo(c, id)} /></td>
                  <td className="whitespace-nowrap">
                    <button className="btn btn-primary" disabled={!c.pendientes || !c.codigo_id} onClick={() => aplicar(c)}>Aplicar a {c.pendientes}</button>{' '}
                    <button className="btn" disabled={!c.pendientes} onClick={() => confirmar(c)} title="Dar por buenos los códigos que ya tienen">Confirmar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cod' && (
        <>
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div className="w-full"><b className="text-sm">Crear un código propio</b> <span className="muted text-sm">— para partes que no tienen un código específico en el PDF: elegí el servicio (ej. 01 Incendio) y se suman ahí en la trazabilidad.</span></div>
            <label className="text-xs muted">Servicio<select className="inp block mt-1" value={nuevo.servicio} onChange={(e) => setNuevo({ ...nuevo, servicio: e.target.value })}>
              {cat.servicios.map((s: any) => <option key={s.id} value={s.id}>{s.id} {s.nombre}</option>)}</select></label>
            <label className="text-xs muted">Rubro<input className="inp block mt-1 w-56" list="rubros" value={nuevo.rubro} onChange={(e) => setNuevo({ ...nuevo, rubro: e.target.value })} placeholder="ej. EDILICIOS" /></label>
            <datalist id="rubros">{rubros.map((r) => <option key={r} value={r} />)}</datalist>
            <label className="text-xs muted">Descripción<input className="inp block mt-1 w-80" value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && crear()} placeholder="ej. PRACTICA DE EVACUACION" /></label>
            <button className="btn btn-primary" onClick={crear}>Crear código</button>
          </div>
          <input className="inp w-80" placeholder="Buscar en los códigos…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="card overflow-auto max-h-[70vh]">
            <table className="tbl">
              <thead><tr><th>Servicio</th><th>Rubro</th><th>Cód.</th><th>Descripción</th></tr></thead>
              <tbody>
                {cods.map((c: any) => (
                  <tr key={c.id}><td>{c.servicio} {sv.get(c.servicio)?.nombre}</td><td>{c.rubro}</td><td className="font-semibold">{c.cod}</td>
                    <td>{c.descripcion} {c.dup ? <span className="chip bg-warn/20 text-warn ml-2" title="El PDF repite este número de código en el servicio">N° repetido en el PDF</span> : null}{c.propio ? <><span className="chip ml-2" style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'var(--color-accent)' }}>propio</span> <button className="btn btn-danger ml-2" onClick={() => borrar(c)} title="Borrar (solo si ningún parte lo usa)">✕</button></> : null}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {toast.node}
    </div>
  );
}
