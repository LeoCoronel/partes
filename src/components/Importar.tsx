import { useState } from 'react';
import { api } from './common';

export default function Importar() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [csv, setCsv] = useState(''); const [nombre, setNombre] = useState('');
  const [rep, setRep] = useState<any>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  const onFile = async (f?: File) => { if (!f) return; setNombre(f.name); setCsv(await f.text()); setRep(null); };
  const run = async () => {
    setBusy(true); setErr(null); setRep(null);
    try { setRep(await api('POST', '/api/importar', { csv, anio })); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Importar partes desde la planilla</h1>
        <ol className="muted mt-2 list-decimal pl-5 text-sm space-y-1">
          <li>En Google Sheets abrí la pestaña del año y elegí <b>Archivo › Descargar › Valores separados por comas (.csv)</b>.</li>
          <li>Elegí el año, cargá el archivo (o pegá el contenido) y tocá Importar.</li>
          <li>Podés reimportar las veces que quieras: actualiza los partes por número sin duplicarlos ni perder los códigos que ya corregiste.</li>
          <li>Después corregí los códigos en <a className="text-accent" href="#/catalogos">Catálogos</a>.</li>
        </ol>
      </div>
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs muted">Año<input className="inp block w-24 mt-1" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} /></label>
          <label className="btn cursor-pointer">Elegir archivo .csv<input type="file" accept=".csv,text/csv,.tsv,.txt" hidden onChange={(e) => onFile(e.target.files?.[0])} /></label>
          {nombre && <span className="muted text-sm">{nombre}</span>}
        </div>
        <textarea className="inp h-40 font-mono text-xs" placeholder="…o pegá acá el contenido (con la fila de títulos S, N.H., DIA, MES, CATEGORIA, A CARGO…)" value={csv} onChange={(e) => { setCsv(e.target.value); setRep(null); }} />
        <div><button className="btn btn-primary" disabled={!csv.trim() || busy} onClick={run}>{busy ? 'Importando…' : 'Importar'}</button></div>
        {err && <p className="text-bad text-sm">{err}</p>}
      </div>
      {rep && (
        <div className="card p-4 text-sm space-y-2">
          <p className="font-semibold text-ok">Listo: {rep.insertados} nuevos, {rep.actualizados} actualizados{rep.omitidos ? `, ${rep.omitidos} omitidos` : ''}.</p>
          {rep.base !== null && <p>Base de NH del {anio}: <b>{rep.base}</b> (NH = {rep.base} + N° de parte).</p>}
          {rep.nhDistinto.length > 0 && <p className="text-warn">⚠ {rep.nhDistinto.length} partes tenían un NH distinto al calculado (se usó el calculado): {rep.nhDistinto.slice(0, 8).map((x: any) => `#${x.numero} (${x.csv}→${x.calculado})`).join(', ')}{rep.nhDistinto.length > 8 && '…'}</p>}
          {rep.diaInvalido.length > 0 && <p className="text-warn">⚠ Día inválido en: {rep.diaInvalido.map((x: any) => `#${x.numero} (día ${x.dia} ${x.mes})`).join(', ')}. Corregilos en Partes.</p>}
          {rep.sinCargo.length > 0 && <p className="text-warn">⚠ Sin «A cargo»: {rep.sinCargo.slice(0, 20).map((n: number) => '#' + n).join(', ')}</p>}
          {rep.legajosDesconocidos.length > 0 && <p className="text-warn">⚠ Legajos que no están en Personal: {rep.legajosDesconocidos.join(', ')}. Agregalos en Personal y reimportá.</p>}
          {rep.categoriasNuevas.length > 0 && <p className="text-warn">⚠ Categorías nuevas creadas (sin código): {rep.categoriasNuevas.join(', ')}</p>}
          {rep.filasInvalidas.length > 0 && <p className="text-warn">⚠ {rep.filasInvalidas.length} filas omitidas por faltar N°, día o mes.</p>}
          <p><a className="btn btn-primary no-underline" href="#/catalogos">Ir a corregir códigos →</a></p>
        </div>
      )}
    </div>
  );
}
