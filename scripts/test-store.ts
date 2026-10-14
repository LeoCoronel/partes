import { readFileSync } from 'node:fs';
import { Store, MemoryAdapter } from '../src/lib/store';
import { handle, setStore } from '../src/lib/localApi';
import { CODIGOS, CATEGORIAS_BASE } from '../src/lib/catalog';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, x?: any) => { c ? ok++ : (bad++, console.log('FALLA:', n, x ?? '')); };
const throws = async (f: () => Promise<any>) => { try { await f(); return null; } catch (e: any) { return e; } };

const csv = readFileSync('data/partes_2026.csv', 'utf8');
const mk = async (seed = true) => { const s = new Store(new MemoryAdapter()); await s.init(undefined, seed ? async () => csv : undefined); setStore(s); return s; };

(async () => {
  t('273 códigos', CODIGOS.length === 273); t('40 categorías', CATEGORIAS_BASE.length === 40);
  let s = await mk();
  const L = await handle('GET', '/api/partes?anio=2026&limit=500');
  t('1126 partes 2026', L.total === 1126, L.total); t('base 22405', L.nhBase === 22405, L.nhBase); t('próximo 1183', L.proximo === 1183, L.proximo);
  t('NH = base+S', L.rows.every((r: any) => r.nh === 22405 + r.numero));
  const per = s.listPersonal(); const act = per.filter((p) => p.activo);
  t('69 activos', act.length === 69, act.length); t('12 inactivos', per.length - act.length === 12);
  t('J1/J2/J3', act[0].legajo === '004' && act[1].legajo === '130' && act[2].legajo === '002', act.slice(0, 4).map((p) => p.legajo));
  t('J contiguos', act.every((p, i) => p.j === i + 1));
  // reinicio no vuelve a sembrar
  const ad = s.adapter; const s2 = new Store(ad); await s2.init(); t('reinicio sin re-seed', (await s2.listPartes(new URLSearchParams('anio=2026'))).total === 1126);

  // carga: salto de números y NH
  const c1 = await handle('POST', '/api/partes', { anio: 2026, numero: 1190, dia: 5, mes: 10, a_cargo_id: '004', estado: 0 });
  t('salto de número', c1.numero === 1190 && c1.nh === 22405 + 1190);
  t('duplicado 409', (await throws(() => handle('POST', '/api/partes', { anio: 2026, numero: 1190, dia: 1, mes: 1 })))?.status === 409);
  const c2 = await handle('POST', '/api/partes', { anio: 2026, dia: 5, mes: 10 }); t('autonumera', c2.numero === 1191);
  // año nuevo pide NH
  const e = await throws(() => handle('POST', '/api/partes', { anio: 2027, numero: 1, dia: 1, mes: 1 }));
  t('NEED_NH', e?.status === 409 && e.data?.error === 'NEED_NH');
  const c3 = await handle('POST', '/api/partes', { anio: 2027, numero: 3, dia: 1, mes: 1, nh: 30000 }); t('base 2027', c3.nh === 30000);
  const c4 = await handle('POST', '/api/partes', { anio: 2027, numero: 5, dia: 1, mes: 1 }); t('nh 2027 salto', c4.nh === 30002, c4.nh);
  await handle('PUT', '/api/config', { anio: 2027, numero: 3, nh: 31000 });
  t('recalcula NH', (await handle('GET', `/api/partes/${c3.id}`)).nh === 31000 && (await handle('GET', `/api/partes/${c4.id}`)).nh === 31002);

  // códigos propios y capacitaciones
  const cat0 = (await handle('GET', '/api/catalogos'));
  t('7 códigos propios de capacitación', cat0.codigos.filter((c: any) => c.propio && c.descripcion.startsWith('CAPACITACION ')).length === 8);
  const c4ta = cat0.categorias.find((c: any) => c.nombre.includes('(4TA)')); t('4ta sugiere código propio', c4ta.codigo_id === '07-P4', c4ta.codigo_id);
  t('CEPRO queda en propio de capacitación 07', cat0.categorias.find((c: any) => c.nombre.includes('CEPRO')).codigo_id === '07-P8');
  t('representación sugiere 07-15', cat0.categorias.find((c: any) => /REPRESENTACION/.test(c.nombre)).codigo_id === '07-15');
  {
    const cs = cat0.categorias; const g = (re: RegExp) => cs.find((c: any) => re.test(c.nombre));
    t('1.3 → 01-112 y sin pendientes', g(/^1\.3 /).codigo_id === '01-112' && g(/^1\.3 /).pendientes === 0, g(/^1\.3 /));
    t('9.3 → 07-15 resuelto', g(/REPRESENTACION/).codigo_id === '07-15' && g(/REPRESENTACION/).pendientes === 0);
    t('cañaveral 11-4', g(/^11\.4/).codigo_id === '11-4'); t('coop same 03-7', g(/^3\.4/).codigo_id === '03-7');
    t('inspeccion 08-2', g(/^inspeccion$/).codigo_id === '08-2'); t('intervencion 07-16', g(/^intervencion$/).codigo_id === '07-16' && g(/^intervencion$/).pendientes === 0);
    t('riferos código propio', cat0.codigos.find((c: any) => c.id === g(/^riferos$/).codigo_id)?.propio === 1 && g(/^riferos$/).pendientes === 0);
    t('citacion 08-7', g(/^citacion$/).codigo_id === '08-7' && g(/^declaracion$/).pendientes === 0);
    const ps = (await handle('GET', '/api/partes?anio=2026&limit=500')).rows; t('sin 11-2 en cañaveral', !ps.some((r: any) => /CAÑAVERAL/.test(r.categoria) && r.codigo_id === '11-2'));
  }
  const prop = await handle('POST', '/api/codigos', { servicio: '01', rubro: 'edilicios', descripcion: 'otro edilicio' });
  t('crea código propio', prop.id === '01-P1', prop);
  t('duplicado propio 409', (await throws(() => handle('POST', '/api/codigos', { servicio: '01', rubro: 'EDILICIOS', descripcion: 'OTRO EDILICIO' })))?.status === 409);
  await handle('PATCH', `/api/partes/${c1.id}`, { codigo_id: '01-P1' });
  t('propio suma en trazabilidad', (await handle('GET', '/api/trazabilidad?anio=2026')).tree.find((x: any) => x.id === '01')?.hijos.some((r: any) => r.nombre === 'EDILICIOS' && r.n === 1));
  t('no borra propio en uso', (await throws(() => handle('DELETE', '/api/codigos/01-P1')))?.status === 409);
  await handle('PATCH', `/api/partes/${c1.id}`, { codigo_id: null }); await handle('DELETE', '/api/codigos/01-P1');
  // migración de datos viejos: capacitaciones creadas en 08 pasan a 99 junto con los partes que las usan
  {
    const ad = new MemoryAdapter(); const s0 = new Store(ad); await s0.init(undefined, async () => csv);
    s0.config.codigosExtra = s0.config.codigosExtra.map((c) => ({ ...c, servicio: '08', id: c.id.replace('07-', '08-') }));
    s0.config.catCodigo = Object.fromEntries(Object.entries(s0.config.catCodigo).map(([k, v]) => [k, v ? v.replace('07-', '08-') : v]));
    s0.config.capSeeded3 = false; s0.config.capSeeded4 = false; await s0.updateParte('2026-0001', { codigo_id: '08-P2' });
    await (s0 as any).migrarCapacitaciones3(); await (s0 as any).migrarCapacitaciones4();
    t('migra a 07', s0.config.codigosExtra.filter((c) => c.descripcion.startsWith('CAPACITACION ')).every((c) => c.servicio === '07') && (await s0.getParte('2026-0001'))!.codigo_id === '07-P2' && s0.categorias().find((c) => c.nombre.includes('(4TA)'))!.codigo_id === '07-P4');
  }
  // código y trazabilidad
  const cod = CODIGOS.find((c) => c.id === '01-5')!;
  const pu = await handle('PATCH', `/api/partes/${c1.id}`, { codigo_id: cod.id, estado: 1 });
  t('código asignado', pu.codigo_id === '01-5' && pu.codigo_revisado === 1 && pu.estado === 1);
  const tr = await handle('GET', '/api/trazabilidad?anio=2026'); t('traza suma el código', tr.tree.find((x: any) => x.id === '01')?.hijos.some((r: any) => r.hijos.some((h: any) => h.nombre.startsWith('5 '))));
  // bulk
  const cats = (await handle('GET', '/api/catalogos')).categorias; const cat = cats.find((c: any) => c.partes > 0 && c.pendientes > 0);
  const b = await handle('POST', '/api/partes/bulk', { categoria_id: cat.id, codigo_id: '02-5' });
  t('bulk', b.actualizados === cat.pendientes, b);
  // personal
  const sug = await handle('GET', '/api/personal?jerarquia=Cadete'); t('sugerido cadete al final', sug.sugerido === 70, sug.sugerido);
  const n = await handle('POST', '/api/personal', { legajo: '900', jerarquia: 'Comandante Mayor', nombre: 'nuevo uno', j: 4 });
  t('alta en J4', s.personal.get('900')!.orden === 4 && s.personal.get('008')!.orden === 5);
  await handle('PATCH', '/api/personal/900', { accion: 'baja' }); t('baja sube', s.personal.get('008')!.orden === 4 && s.personal.get('900')!.orden === null);
  await handle('PATCH', '/api/personal/900', { accion: 'alta', j: 4 }); t('alta vuelve', s.personal.get('900')!.orden === 4);
  await handle('PATCH', '/api/personal/900', { accion: 'mover', j: 1 }); t('mover J1', s.personal.get('900')!.orden === 1 && s.personal.get('004')!.orden === 2);
  t('no borra con partes', (await throws(() => handle('DELETE', '/api/personal/004')))?.status === 409);
  await handle('PATCH', '/api/personal/900', { accion: 'baja' }); await handle('DELETE', '/api/personal/900'); t('borra sin partes', !s.personal.has('900'));
  t('J sigue contiguo', s.listPersonal().filter((p) => p.activo).every((p, i) => p.j === i + 1));

  // importar idempotente
  const imp = await handle('POST', '/api/importar', { csv, anio: 2026 });
  t('reimport actualiza', imp.insertados === 0 && imp.actualizados === 1126, imp);
  t('anomalías', imp.diaInvalido.length >= 1 && imp.mesInvalido.includes(738), JSON.stringify({ d: imp.diaInvalido, m: imp.mesInvalido }));
  t('código corregido sobrevive', (await handle('GET', `/api/partes/${c1.id}`)).codigo_id === '01-5');
  s = await mk(false); t('sin seed vacío', (await handle('GET', '/api/partes?anio=2026')).total === 0);
  console.log(`${ok} ok, ${bad} fallas`); process.exit(bad ? 1 : 0);
})();
