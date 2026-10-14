import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, MESES } from './common';

const PAL = ['#8b7bff', '#35b6e8', '#2fbf71', '#f5a524', '#f0566a', '#e879c6', '#5eead4', '#c4b454', '#7c8cf8', '#fb923c', '#a3e635', '#94a3b8'];
const AXIS = { fill: '#8a909c', fontSize: 12 };
const TIP = { contentStyle: { background: '#181b21', border: '1px solid #23262d', borderRadius: 8, color: '#e8eaee' }, cursor: { fill: 'rgba(255,255,255,.04)' }, labelStyle: { color: '#e8eaee' }, itemStyle: { color: '#e8eaee' } };

function Kpi({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return <div className="card p-4"><div className="muted text-xs">{label}</div><div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div></div>;
}

export default function Trazabilidad() {
  const [anio, setAnio] = useState(new Date().getFullYear()); const [mes, setMes] = useState('');
  const [d, setD] = useState<any>(null);
  const [path, setPath] = useState<number[]>([]); // índices elegidos: servicio › rubro
  useEffect(() => { api('GET', `/api/trazabilidad?anio=${anio}${mes ? '&mes=' + mes : ''}`).then((r) => { setD(r); setPath([]); }); }, [anio, mes]);

  const nivel = useMemo(() => {
    if (!d) return { items: [] as any[], crumbs: [] as string[] };
    let nodes: any[] = d.tree; const crumbs: string[] = [];
    for (const i of path) { const n = nodes[i]; if (!n) break; crumbs.push(n.id ? `${n.id} ${n.nombre}` : n.nombre); nodes = n.hijos ?? []; }
    const items = nodes.map((n: any, i: number) => ({ i, name: n.id && path.length === 0 ? `${n.id} ${n.nombre}` : n.nombre, n: n.n, hasKids: !!n.hijos?.length }))
      .sort((a, b) => b.n - a.n);
    return { items, crumbs };
  }, [d, path]);

  const meses = useMemo(() => (d?.porMes ?? []).filter((m: any) => m.mes >= 1).map((m: any) => ({ name: MESES[m.mes - 1], Confirmados: m.revisados, Pendientes: m.total - m.revisados })), [d]);
  const sinMes = d?.porMes?.[0]?.total ?? 0;
  const pend = (d?.pendientes ?? []).slice(0, 12).map((p: any) => ({ name: p.categoria ?? 'sin categoría', n: p.n }));
  const alturaNivel = Math.max(220, nivel.items.length * 34 + 20);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><h1 className="text-xl font-semibold">Trazabilidad</h1>
          <p className="muted text-sm">Servicio › Rubro › Código. Tocá una barra para entrar al detalle.</p></div>
        <div className="ml-auto flex gap-2">
          <input className="inp w-20" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año" />
          <select className="inp" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
            <option value="">Todo el año</option>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>
      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Partes" value={d.total} />
            <Kpi label="Con código confirmado" value={d.revisados} color="var(--color-ok)" />
            <Kpi label="Pendientes de corrección" value={d.total - d.revisados} color="var(--color-warn)" />
            <Kpi label="Avance" value={d.total ? Math.round((d.revisados / d.total) * 100) + '%' : '—'} color="var(--color-accent)" />
          </div>

          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
              <button className="btn" disabled={path.length === 0} onClick={() => setPath(path.slice(0, -1))}>← Volver</button>
              <button className="text-accent" onClick={() => setPath([])}>Todos los servicios</button>
              {nivel.crumbs.map((c, k) => <span key={k} className="muted">› <button className="text-ink" onClick={() => setPath(path.slice(0, k + 1))}>{c}</button></span>)}
            </div>
            {nivel.items.length === 0
              ? <p className="muted p-4 text-sm">Todavía no hay partes con código confirmado. Corregí los códigos en <a className="text-accent" href="#/catalogos">Catálogos</a> o cargá partes nuevos.</p>
              : (
                <ResponsiveContainer width="100%" height={alturaNivel}>
                  <BarChart data={nivel.items} layout="vertical" margin={{ left: 8, right: 36 }}>
                    <CartesianGrid horizontal={false} stroke="#23262d" />
                    <XAxis type="number" tick={AXIS} allowDecimals={false} stroke="#23262d" />
                    <YAxis type="category" dataKey="name" width={260} tick={AXIS} stroke="#23262d" interval={0} />
                    <Tooltip {...TIP} formatter={(v: any) => [v, 'Partes']} />
                    <Bar dataKey="n" radius={[0, 6, 6, 0]} onClick={(x: any) => x?.hasKids && setPath([...path, x.i])} cursor="pointer">
                      {nivel.items.map((it, k) => <Cell key={k} fill={PAL[(path.length ? path[0] : it.i) % PAL.length]} fillOpacity={it.hasKids ? 1 : 0.7} />)}
                      <LabelList dataKey="n" position="right" fill="#e8eaee" fontSize={12} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <h2 className="text-sm font-semibold mb-2">Partes por mes {anio}</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={meses}>
                  <CartesianGrid vertical={false} stroke="#23262d" />
                  <XAxis dataKey="name" tick={AXIS} stroke="#23262d" /><YAxis tick={AXIS} allowDecimals={false} stroke="#23262d" />
                  <Tooltip {...TIP} />
                  <Bar dataKey="Confirmados" stackId="a" fill="#2fbf71" />
                  <Bar dataKey="Pendientes" stackId="a" fill="#f5a524" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-xs muted mt-1"><span><i className="inline-block size-2 rounded-sm mr-1" style={{ background: '#2fbf71' }} />Confirmados</span><span><i className="inline-block size-2 rounded-sm mr-1" style={{ background: '#f5a524' }} />Pendientes</span>{sinMes > 0 && <span>· {sinMes} sin mes válido</span>}</div>
            </div>
            <div className="card p-4">
              <h2 className="text-sm font-semibold mb-2 text-warn">Pendientes por categoría vieja</h2>
              {pend.length === 0 ? <p className="muted text-sm p-4">No hay pendientes.</p> : (
                <ResponsiveContainer width="100%" height={Math.max(220, pend.length * 30 + 20)}>
                  <BarChart data={pend} layout="vertical" margin={{ right: 36 }}>
                    <CartesianGrid horizontal={false} stroke="#23262d" />
                    <XAxis type="number" tick={AXIS} allowDecimals={false} stroke="#23262d" />
                    <YAxis type="category" dataKey="name" width={190} tick={AXIS} stroke="#23262d" interval={0} />
                    <Tooltip {...TIP} formatter={(v: any) => [v, 'Partes']} />
                    <Bar dataKey="n" fill="#f5a524" radius={[0, 6, 6, 0]}><LabelList dataKey="n" position="right" fill="#e8eaee" fontSize={12} /></Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
