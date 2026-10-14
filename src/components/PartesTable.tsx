import { useEffect, useMemo, useState, useCallback } from 'react';
import { api, useToast, MesChip, EstadoChip, MESES, ESTADOS, ESTADO_COLOR, ESTADO_CELDA, CodigoPicker, PersonaPicker, codigoLabel } from './common';

const LIMIT = 100;

export default function PartesTable() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(''); const [estado, setEstado] = useState('');
  const [q, setQ] = useState(''); const [pend, setPend] = useState(false); const [page, setPage] = useState(0);
  const [data, setData] = useState<any>({ rows: [], total: 0, nhBase: null, proximo: 1 });
  const [cat, setCat] = useState<any>({ codigos: [], servicios: [], personal: [], categorias: [] });
  const [editCod, setEditCod] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const p = new URLSearchParams({ anio: String(anio), limit: String(LIMIT), offset: String(page * LIMIT) });
    if (mes) p.set('mes', mes); if (estado !== '') p.set('estado', estado); if (q) p.set('q', q); if (pend) p.set('pendientes', '1');
    setData(await api('GET', '/api/partes?' + p));
  }, [anio, mes, estado, q, pend, page]);
  useEffect(() => { api('GET', '/api/catalogos').then(setCat); }, []);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load]);
  useEffect(() => setPage(0), [anio, mes, estado, q, pend]);

  const svById = useMemo(() => new Map(cat.servicios.map((s: any) => [s.id, s])), [cat.servicios]);
  const patch = async (id: number, body: any) => {
    try { const r = await api('PATCH', `/api/partes/${id}`, body); setData((d: any) => ({ ...d, rows: d.rows.map((x: any) => (x.id === id ? r : x)) })); }
    catch (e: any) { toast.show(e.message); }
  };
  const del = async (r: any) => {
    if (!confirm(`¿Borrar el parte ${r.numero}?`)) return;
    await api('DELETE', `/api/partes/${r.id}`); load();
  };
  const pages = Math.max(1, Math.ceil(data.total / LIMIT));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Partes {anio}</h1>
          <p className="muted text-sm">{data.total} partes · próximo N° {data.proximo}{data.nhBase !== null && <> · NH = {data.nhBase} + N°</>}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input className="inp w-20" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año" />
          <select className="inp" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
            <option value="">Todos los meses</option>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="inp" value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
            <option value="">Todos los estados</option>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}
          </select>
          <input className="inp w-44" placeholder="Buscar N°, NH, nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={pend} onChange={(e) => setPend(e.target.checked)} />Código sin revisar</label>
          <button className="btn btn-primary" onClick={() => setNuevo((v) => !v)}>+ Nuevo parte</button>
        </div>
      </div>

      {nuevo && <NuevoParte anio={anio} proximo={data.proximo} nhBase={data.nhBase} cat={cat}
        onSaved={() => { toast.show('Parte guardado'); load(); }} onClose={() => setNuevo(false)} />}

      <div className="card overflow-auto max-h-[70vh]">
        <table className="tbl">
          <thead><tr>
            <th>S</th><th>NH</th><th>Día</th><th>Mes</th><th>Código GIB</th><th>A cargo</th><th>Estado</th><th>Firma</th><th>Impreso</th><th>Archivo</th><th>GIB</th><th></th>
          </tr></thead>
          <tbody>
            {data.rows.map((r: any) => (
              <tr key={r.id} data-e={ESTADO_COLOR[r.estado] ? r.estado : undefined} style={{ ['--c' as any]: ESTADO_COLOR[r.estado] }}>
                <td className="font-semibold">{r.numero}</td>
                <td className="muted">{r.nh ?? '—'}</td>
                <td className={r.dia < 1 ? 'text-bad font-semibold' : ''} title={r.dia < 1 ? 'Día inválido' : ''}>{r.dia}</td>
                <td className="rojo">{r.mes >= 1 && r.mes <= 12 ? MESES[r.mes - 1] : '—'}</td>
                <td className="min-w-72">
                  {editCod === r.id ? (
                    <CodigoPicker codigos={cat.codigos} servicios={cat.servicios} value={r.codigo_id}
                      onChange={(id) => { if (id) { patch(r.id, { codigo_id: id }); setEditCod(null); } }} />
                  ) : (
                    <button className="w-full text-left" onClick={() => setEditCod(r.id)} title="Clic para cambiar el código">
                      {r.codigo_id ? (
                        <span className={r.codigo_revisado ? '' : 'text-warn'}>
                          {!r.codigo_revisado && '⚠ '}{codigoLabel({ servicio: r.cod_servicio, cod: r.cod_cod, rubro: r.cod_rubro, descripcion: r.cod_desc }, svById.get(r.cod_servicio))}
                          {!r.codigo_revisado && <span className="muted"> (sugerido)</span>}
                        </span>
                      ) : (
                        <span className="text-warn">⚠ Sin código <span className="muted">· {r.categoria ?? 'sin categoría'}</span></span>
                      )}
                    </button>
                  )}
                </td>
                <td className="min-w-56">
                  <PersonaPicker personal={cat.personal} value={r.a_cargo_id} onChange={(id) => patch(r.id, { a_cargo_id: id })} />
                </td>
                <td>
                  <select className="inp" value={r.estado} onChange={(e) => patch(r.id, { estado: Number(e.target.value) })}
                    style={ESTADO_CELDA[r.estado] ? { background: ESTADO_CELDA[r.estado].bg, color: ESTADO_CELDA[r.estado].fg, fontWeight: 600 } : undefined}>
                    {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}
                  </select>
                </td>
                <td>
                  <select className="inp" value={r.firma ?? ''} onChange={(e) => patch(r.id, { firma: e.target.value || null })}>
                    <option value="">—</option><option>FIRMAR</option><option>ARCHIVO</option>
                  </select>
                </td>
                <td className="rojo"><input type="date" className="inp" value={r.impreso ?? ''} onChange={(e) => patch(r.id, { impreso: e.target.value || null })} /></td>
                <td className="rojo">
                  <select className="inp" value={r.mes_archivo ?? ''} onChange={(e) => patch(r.id, { mes_archivo: e.target.value || null })}>
                    <option value="">—</option>{MESES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </td>
                <td className="rojo">
                  <select className="inp" value={r.mes_gib ?? ''} onChange={(e) => patch(r.id, { mes_gib: e.target.value || null })} title="Mes en que se cargó en GIB">
                    <option value="">—</option>{MESES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </td>
                <td><button className="btn btn-danger" onClick={() => del(r)} title="Borrar parte" aria-label="Borrar">✕</button></td>
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td colSpan={12} className="muted p-6 text-center">No hay partes con estos filtros. Importá tu planilla o cargá uno nuevo.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="muted">Página {page + 1} de {pages}</span>
        <div className="flex gap-2">
          <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>← Anterior</button>
          <button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Siguiente →</button>
        </div>
      </div>
      {toast.node}
    </div>
  );
}

function NuevoParte({ anio, proximo, nhBase, cat, onSaved, onClose }: any) {
  const hoy = new Date();
  const [f, setF] = useState<any>({ numero: proximo, dia: hoy.getDate(), mes: hoy.getMonth() + 1, codigo_id: null, a_cargo_id: null, estado: 0, nh: '' });
  const [err, setErr] = useState<string | null>(null); const [needNh, setNeedNh] = useState(nhBase === null);
  useEffect(() => setF((x: any) => ({ ...x, numero: proximo })), [proximo]);
  const nh = nhBase !== null && f.numero ? nhBase + Number(f.numero) : null;
  const save = async () => {
    setErr(null);
    if (!f.codigo_id) return setErr('Elegí el código GIB.');
    try {
      await api('POST', '/api/partes', { anio, numero: f.numero, dia: f.dia, mes: f.mes, codigo_id: f.codigo_id, a_cargo_id: f.a_cargo_id, estado: f.estado, nh: f.nh || undefined });
      onSaved(); setNeedNh(false); setF((x: any) => ({ ...x, codigo_id: null, nh: '' }));
    } catch (e: any) { if (e.data?.error === 'NEED_NH') setNeedNh(true); setErr(e.message); }
  };
  return (
    <div className="card p-4 flex flex-wrap items-end gap-3">
      <label className="text-xs muted">N° parte<input className="inp block w-20 mt-1" type="number" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></label>
      <label className="text-xs muted">NH<div className="inp mt-1 w-24 opacity-70">{nh ?? '—'}</div></label>
      {needNh && <label className="text-xs text-warn">NH del parte {f.numero} (primera vez del año)
        <input className="inp block w-32 mt-1" type="number" value={f.nh} onChange={(e) => setF({ ...f, nh: e.target.value })} autoFocus /></label>}
      <label className="text-xs muted">Día<input className="inp block w-16 mt-1" type="number" min={1} max={31} value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} /></label>
      <label className="text-xs muted">Mes<select className="inp block mt-1" value={f.mes} onChange={(e) => setF({ ...f, mes: Number(e.target.value) })}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
      <div className="text-xs muted w-80">Código GIB<CodigoPicker codigos={cat.codigos} servicios={cat.servicios} value={f.codigo_id} onChange={(id) => setF({ ...f, codigo_id: id })} /></div>
      <div className="text-xs muted w-64">A cargo<PersonaPicker personal={cat.personal} value={f.a_cargo_id} onChange={(id) => setF({ ...f, a_cargo_id: id })} /></div>
      <label className="text-xs muted">Estado<select className="inp block mt-1" value={f.estado} onChange={(e) => setF({ ...f, estado: Number(e.target.value) })}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}</select></label>
      <button className="btn btn-primary" onClick={save}>Guardar</button>
      <button className="btn" onClick={onClose}>Cerrar</button>
      {err && <p className="w-full text-sm text-bad">{err}</p>}
    </div>
  );
}
