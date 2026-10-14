import { useEffect, useMemo, useState } from 'react';
import { api, useToast, CodigoPicker, codigoLabel } from './common';

export default function Catalogos() {
  const [cat, setCat] = useState<any>({ codigos: [], servicios: [], categorias: [] });
  const [tab, setTab] = useState<'cat' | 'cod'>('cat'); const [q, setQ] = useState(''); const toast = useToast();
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
  const pendTotal = cat.categorias.reduce((t: number, c: any) => t + c.pendientes, 0);
  const cods = cat.codigos.filter((c: any) => !q || `${c.servicio}-${c.cod} ${c.rubro} ${c.descripcion} ${sv.get(c.servicio)?.nombre}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Catálogos y códigos</h1>
        <p className="muted text-sm max-w-3xl">Cada categoría vieja de tu planilla sugiere un código del PDF. Corregí el código de una categoría y aplicalo de una vez a todos sus partes pendientes: así no revisás parte por parte.
          Lo que no sea parejo (por ejemplo «1.2 Vivienda», que puede ser varios códigos) corregilo en Partes o en Carga rápida.</p>
      </div>
      <div className="flex gap-2">
        <button className={`btn ${tab === 'cat' ? 'btn-primary' : ''}`} onClick={() => setTab('cat')}>Categorías y pendientes ({pendTotal})</button>
        <button className={`btn ${tab === 'cod' ? 'btn-primary' : ''}`} onClick={() => setTab('cod')}>Códigos del PDF ({cat.codigos.length})</button>
      </div>

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
          <input className="inp w-80" placeholder="Buscar en los 273 códigos…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="card overflow-auto max-h-[70vh]">
            <table className="tbl">
              <thead><tr><th>Servicio</th><th>Rubro</th><th>Cód.</th><th>Descripción</th></tr></thead>
              <tbody>
                {cods.map((c: any) => (
                  <tr key={c.id}><td>{c.servicio} {sv.get(c.servicio)?.nombre}</td><td>{c.rubro}</td><td className="font-semibold">{c.cod}</td>
                    <td>{c.descripcion} {c.dup ? <span className="chip bg-warn/20 text-warn ml-2" title="El PDF repite este número de código en el servicio">N° repetido en el PDF</span> : null}</td></tr>
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
