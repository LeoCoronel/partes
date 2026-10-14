import { useEffect, useMemo, useRef, useState } from 'react';
import { api, useToast, MESES, ESTADOS, CodigoPicker, PersonaPicker } from './common';

type Fila = { key: number; numero: number; dia: number; mes: number; codigo_id: number | null; a_cargo_id: number | null; estado: number; st: 'nuevo' | 'ok' | 'error'; msg?: string };
let K = 1;

export default function CargaRapida() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [cat, setCat] = useState<any>({ codigos: [], servicios: [], personal: [] });
  const [cfg, setCfg] = useState<any>({ nhBase: null, proximo: 1 });
  const [rows, setRows] = useState<Fila[]>([]);
  const [repetirCargo, setRepetirCargo] = useState(true);
  const [pegar, setPegar] = useState(false); const [texto, setTexto] = useState('');
  const [nhInput, setNhInput] = useState(''); const [busy, setBusy] = useState(false);
  const toast = useToast();
  const cod = useRef<Record<number, HTMLInputElement | null>>({});
  const car = useRef<Record<number, HTMLInputElement | null>>({});
  const focusNext = useRef<{ key: number; campo: 'cod' | 'car' } | null>(null);

  useEffect(() => { api('GET', '/api/catalogos').then(setCat); }, []);
  const loadCfg = async () => { const c = await api('GET', `/api/config?anio=${anio}`); setCfg(c); return c; };
  useEffect(() => {
    loadCfg().then((c) => setRows([{ key: K++, numero: c.proximo, dia: hoy.getDate(), mes: hoy.getMonth() + 1, codigo_id: null, a_cargo_id: null, estado: 0, st: 'nuevo' }]));
  }, [anio]);
  useEffect(() => {
    const f = focusNext.current; if (!f) return; focusNext.current = null;
    setTimeout(() => (f.campo === 'cod' ? cod.current[f.key] : car.current[f.key])?.focus(), 30);
  });

  const set = (key: number, p: Partial<Fila>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p, st: r.st === 'error' ? 'nuevo' : r.st } : r)));
  const nuevaFila = (base?: Fila, copiarTodo = false): Fila => ({
    key: K++, numero: (base?.numero ?? cfg.proximo - 1) + 1, dia: base?.dia ?? hoy.getDate(), mes: base?.mes ?? hoy.getMonth() + 1,
    codigo_id: copiarTodo ? base?.codigo_id ?? null : null, a_cargo_id: copiarTodo || repetirCargo ? base?.a_cargo_id ?? null : null,
    estado: base?.estado ?? 0, st: 'nuevo',
  });
  // Toma la fila más reciente del estado (no la del render) para copiar lo que se acaba de elegir.
  const agregar = (key?: number, copiarTodo = false) => {
    const newKey = K++;
    setRows((rs) => {
      const idx = key !== undefined ? rs.findIndex((r) => r.key === key) : rs.length - 1;
      const c = [...rs]; c.splice(idx + 1, 0, { ...nuevaFila(rs[idx], copiarTodo), key: newKey }); return c;
    });
    focusNext.current = { key: newKey, campo: 'cod' };
  };
  const quitar = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));

  const nhDe = (n: number) => (cfg.nhBase !== null ? cfg.nhBase + n : null);
  const pendientes = rows.filter((r) => r.st !== 'ok');
  const listos = pendientes.filter((r) => r.codigo_id);

  const fijarBase = async () => {
    const primero = rows.find((r) => r.st !== 'ok'); if (!primero || !nhInput) return;
    await api('PUT', '/api/config', { anio, numero: primero.numero, nh: Number(nhInput) });
    toast.show(`Base de NH fijada: parte ${primero.numero} = NH ${nhInput}`); setNhInput(''); loadCfg();
  };

  const guardar = async () => {
    if (cfg.nhBase === null) return toast.show('Primero indicá el NH del primer parte.');
    setBusy(true); let ok = 0;
    for (const r of rows) {
      if (r.st === 'ok') continue;
      if (!r.codigo_id) { set(r.key, { st: 'error', msg: 'Falta el código' }); continue; }
      try { await api('POST', '/api/partes', { anio, numero: r.numero, dia: r.dia, mes: r.mes, codigo_id: r.codigo_id, a_cargo_id: r.a_cargo_id, estado: r.estado });
        setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, st: 'ok', msg: undefined } : x))); ok++; }
      catch (e: any) { setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, st: 'error', msg: e.message } : x))); }
    }
    setBusy(false); toast.show(`${ok} partes guardados`); loadCfg();
  };
  const limpiar = () => setRows((rs) => { const resto = rs.filter((r) => r.st !== 'ok'); const ult = rs[rs.length - 1];
    return resto.length ? resto : [nuevaFila({ ...ult, numero: (cfg.proximo ?? ult.numero + 1) - 1 })]; });

  const onKey = (e: React.KeyboardEvent, r: Fila) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); agregar(r.key, true); }
    else if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); guardar(); }
  };

  const personalPorLegajo = useMemo(() => new Map(cat.personal.map((p: any) => [p.legajo, p.id])), [cat.personal]);
  const parsePegado = () => {
    const base = rows[rows.length - 1]; let n = base.numero; let dia = base.dia; let mes = base.mes; const nuevas: Fila[] = []; const malas: string[] = [];
    for (const linea of texto.split('\n').map((l) => l.trim()).filter(Boolean)) {
      const t = linea.split(/[\s,;\t]+/); let codigo: any = null; let cargo: any = null;
      const m = linea.match(/(?:^|\s)(\d{1,2})\s*[-.]\s*(\d{1,3})(?=\s|$)/);
      if (m) codigo = cat.codigos.find((c: any) => c.servicio === m[1].padStart(2, '0') && c.cod === Number(m[2]) && !c.dup) ?? cat.codigos.find((c: any) => c.servicio === m[1].padStart(2, '0') && c.cod === Number(m[2]));
      const mm = t.find((x) => MESES.includes(x.toUpperCase())); if (mm) mes = MESES.indexOf(mm.toUpperCase()) + 1;
      const solos = t.filter((x) => /^\d{1,3}$/.test(x));
      const d = solos.find((x) => Number(x) >= 1 && Number(x) <= 31 && x.length <= 2 && !personalPorLegajo.has(x.padStart(3, '0')) );
      if (solos.length >= 2) { dia = Number(solos[0]); cargo = personalPorLegajo.get(solos[solos.length - 1].padStart(3, '0')); }
      else if (solos.length === 1) { cargo = personalPorLegajo.get(solos[0].padStart(3, '0')) ?? null; if (!cargo && d) dia = Number(d); }
      if (!codigo) { malas.push(linea); continue; }
      nuevas.push({ key: K++, numero: ++n, dia, mes, codigo_id: codigo.id, a_cargo_id: cargo ?? null, estado: 0, st: 'nuevo' });
    }
    if (nuevas.length) setRows((rs) => [...rs.filter((r) => r.st !== 'nuevo' || r.codigo_id || r.a_cargo_id), ...nuevas]);
    toast.show(`${nuevas.length} filas agregadas${malas.length ? `, ${malas.length} sin código reconocible` : ''}`); setTexto(''); setPegar(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Carga rápida</h1>
          <p className="muted text-sm">Código con <kbd>Enter</kbd> → «a cargo» con <kbd>Enter</kbd> → nueva fila. <kbd>Ctrl+D</kbd> duplica la fila, <kbd>Ctrl+Enter</kbd> guarda todo. Podés escribir <b>1-12</b>, <b>11.3</b> o parte del nombre.</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={repetirCargo} onChange={(e) => setRepetirCargo(e.target.checked)} />Repetir «a cargo»</label>
          <input className="inp w-20" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año" />
          <button className="btn" onClick={() => setPegar(!pegar)}>Pegar varias líneas</button>
        </div>
      </div>

      {cfg.nhBase === null && (
        <div className="card border-warn p-4 flex flex-wrap items-end gap-3">
          <p className="text-sm text-warn max-w-md">Todavía no hay partes de {anio}: indicá el N° histórico (NH) del primer parte de esta tanda (N° {rows.find((r) => r.st !== 'ok')?.numero ?? '—'}). Después el NH se calcula solo, aunque te saltees números.</p>
          <input className="inp w-36" type="number" placeholder="NH del primer parte" value={nhInput} onChange={(e) => setNhInput(e.target.value)} />
          <button className="btn btn-primary" onClick={fijarBase} disabled={!nhInput}>Fijar</button>
        </div>
      )}

      {pegar && (
        <div className="card p-4 flex flex-col gap-2">
          <p className="muted text-sm">Una línea por parte: <code>día mes código legajo</code>, por ejemplo <code>12 FEB 11.3 102</code> o <code>12 feb 1-12 153</code>. Si omitís día o mes, usa los de la fila anterior.</p>
          <textarea className="inp h-32 font-mono text-xs" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div><button className="btn btn-primary" onClick={parsePegado} disabled={!texto.trim()}>Agregar filas</button></div>
        </div>
      )}

      <div className="card overflow-visible">
        <table className="tbl">
          <thead><tr><th>S</th><th>NH</th><th>Día</th><th>Mes</th><th className="w-[26rem]">Código GIB</th><th className="w-80">A cargo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const ro = r.st === 'ok';
              return (
                <tr key={r.key} onKeyDown={(e) => onKey(e, r)} className={ro ? 'opacity-50' : ''} style={r.st === 'error' ? { background: 'rgba(240,86,106,.08)' } : undefined}>
                  <td><input className="inp w-20" type="number" disabled={ro} value={r.numero} onChange={(e) => set(r.key, { numero: Number(e.target.value) })} /></td>
                  <td className="muted">{nhDe(r.numero) ?? '—'}</td>
                  <td><input className="inp w-16" type="number" min={1} max={31} disabled={ro} value={r.dia} onChange={(e) => set(r.key, { dia: Number(e.target.value) })} /></td>
                  <td><select className="inp" disabled={ro} value={r.mes} onChange={(e) => set(r.key, { mes: Number(e.target.value) })}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></td>
                  <td>{ro ? <span className="muted">guardado</span> : <CodigoPicker codigos={cat.codigos} servicios={cat.servicios} value={r.codigo_id}
                    inputRef={(el) => { cod.current[r.key] = el; }} onChange={(id) => set(r.key, { codigo_id: id })}
                    onCommit={() => car.current[r.key]?.focus()} />}</td>
                  <td>{!ro && <PersonaPicker personal={cat.personal} value={r.a_cargo_id} inputRef={(el) => { car.current[r.key] = el; }}
                    onChange={(id) => set(r.key, { a_cargo_id: id })}
                    onCommit={() => { if (r.key === rows[rows.length - 1].key) agregar(r.key); else cod.current[rows[rows.findIndex((x) => x.key === r.key) + 1]?.key]?.focus(); }} />}</td>
                  <td><select className="inp" disabled={ro} value={r.estado} onChange={(e) => set(r.key, { estado: Number(e.target.value) })}>
                    {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}</select></td>
                  <td className="whitespace-nowrap">
                    {r.msg && <span className="text-bad text-xs mr-2">{r.msg}</span>}
                    {!ro && <button className="btn btn-danger" onClick={() => quitar(r.key)} aria-label="Quitar fila" title="Quitar fila">✕</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" onClick={() => agregar()}>+ Fila</button>
        <button className="btn btn-primary" onClick={guardar} disabled={busy || listos.length === 0}>Guardar {listos.length} {listos.length === 1 ? 'parte' : 'partes'}</button>
        {rows.some((r) => r.st === 'ok') && <button className="btn" onClick={limpiar}>Limpiar guardados</button>}
        {pendientes.length > listos.length && <span className="text-warn text-sm">{pendientes.length - listos.length} fila(s) sin código no se guardan</span>}
      </div>
      {toast.node}
    </div>
  );
}
