import {
  CODIGOS, CODIGO_BY_ID, SERVICIO_BY_ID, SERVICIOS, JERARQUIAS, NIVEL, CATEGORIAS_BASE, PERSONAL_SEED,
  MESES, MES_LARGO, norm, slug, type Codigo,
} from './catalog';

export type Config = { seeded: boolean; nhBase: Record<string, number>; catCodigo: Record<string, string | null>; catExtra: { id: string; nombre: string }[]; codigosExtra: CodigoExtra[]; capSeeded?: boolean };
export type CodigoExtra = { id: string; servicio: string; rubro: string; descripcion: string };
export type Personal = { id: string; legajo: string; jerarquia: string; nombre: string; activo: number; orden: number | null };
export type Parte = {
  id: string; anio: number; numero: number; nh: number | null; mes: number; dia: number; categoria_id: string | null; codigo_id: string | null;
  codigo_revisado: number; a_cargo_id: string | null; estado: number; firma: string | null; impreso: string | null; mes_archivo: string | null; mes_gib: string | null;
};

export interface Adapter {
  loadStatic(): Promise<{ config: Config | null; personal: Personal[] }>;
  loadPartes(anio: number): Promise<Parte[]>;
  saveConfig(patch: Partial<Config>): Promise<void>;
  savePersonal(list: Personal[]): Promise<void>;
  deletePersonal(id: string): Promise<void>;
  savePartes(list: Parte[]): Promise<void>;
  createParte(p: Parte): Promise<boolean>;
  deleteParte(id: string): Promise<void>;
}

export class HttpError extends Error {
  status: number; data: any;
  constructor(status: number, message: string, data?: any) { super(message); this.status = status; this.data = data ?? { error: message }; }
}

export const emptyConfig = (): Config => ({ seeded: false, nhBase: {}, catCodigo: {}, catExtra: [], codigosExtra: [] });
export const parteId = (anio: number, numero: number) => `${anio}-${String(numero).padStart(4, '0')}`;

/* ---------- Adaptador en memoria (pruebas y modo demo) ---------- */
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export class MemoryAdapter implements Adapter {
  config: Config | null = null; personal = new Map<string, Personal>(); partes = new Map<string, Parte>();
  protected persist() {}
  async loadStatic() { return { config: this.config ? clone(this.config) : null, personal: [...this.personal.values()].map(clone) }; }
  async loadPartes(anio: number) { return [...this.partes.values()].filter((p) => p.anio === anio).map(clone); }
  async saveConfig(patch: Partial<Config>) { this.config = { ...(this.config ?? emptyConfig()), ...clone(patch) } as Config; this.persist(); }
  async savePersonal(list: Personal[]) { list.forEach((p) => this.personal.set(p.id, clone(p))); this.persist(); }
  async deletePersonal(id: string) { this.personal.delete(id); this.persist(); }
  async savePartes(list: Parte[]) { list.forEach((p) => this.partes.set(p.id, clone(p))); this.persist(); }
  async createParte(p: Parte) { if (this.partes.has(p.id)) return false; this.partes.set(p.id, clone(p)); this.persist(); return true; }
  async deleteParte(id: string) { this.partes.delete(id); this.persist(); }
}

export class LocalStorageAdapter extends MemoryAdapter {
  constructor(private key = 'partes-demo-v1') {
    super();
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) { const d = JSON.parse(raw); this.config = d.config; this.personal = new Map(d.personal); this.partes = new Map(d.partes); }
    } catch { /* sin almacenamiento: queda en memoria */ }
  }
  protected persist() {
    try { localStorage.setItem(this.key, JSON.stringify({ config: this.config, personal: [...this.personal], partes: [...this.partes] })); } catch { /* ignorar */ }
  }
}

/* ---------- Importación: utilidades ---------- */
function parseCsv(text: string): string[][] {
  const first = text.split('\n')[0];
  const delim = (first.match(/\t/g)?.length ?? 0) > 2 ? '\t' : (first.match(/;/g)?.length ?? 0) > 2 ? ';' : ',';
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function parseImpreso(s: string, anio: number): string | null {
  s = s.trim(); if (!s) return null;
  let m = s.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)/i);
  if (m) { const mi = MES_LARGO.indexOf(norm(m[2])); if (mi >= 0) return `${anio}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : anio; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/* ---------- El store: toda la lógica, en memoria, con escritura a la nube ---------- */
export class Store {
  config: Config = emptyConfig();
  personal = new Map<string, Personal>();
  years = new Map<number, Map<string, Parte>>();
  constructor(public adapter: Adapter) {}

  async init(onProgress?: (m: string) => void, seedCsv?: () => Promise<string>) {
    const { config, personal } = await this.adapter.loadStatic();
    if (config?.seeded) {
      this.config = { ...emptyConfig(), ...config };
      personal.forEach((p) => this.personal.set(p.id, p));
      await this.migrarCapacitaciones();
      return;
    }
    await this.seed(onProgress, seedCsv);
  }

  async seed(onProgress?: (m: string) => void, seedCsv?: () => Promise<string>) {
    onProgress?.('Cargando el personal…');
    const list: Personal[] = [];
    PERSONAL_SEED.activos.forEach((p, i) => list.push({ id: p.legajo, legajo: p.legajo, jerarquia: p.jerarquia, nombre: p.nombre, activo: 1, orden: i + 1 }));
    PERSONAL_SEED.inactivos.forEach((p) => list.push({ id: p.legajo, legajo: p.legajo, jerarquia: p.jerarquia, nombre: p.nombre, activo: 0, orden: null }));
    await this.adapter.savePersonal(list);
    list.forEach((p) => this.personal.set(p.id, p));
    this.config = emptyConfig();
    await this.adapter.saveConfig({ ...this.config, seeded: false });
    if (seedCsv) {
      onProgress?.('Importando los partes de 2026…');
      await this.importCsv(await seedCsv(), 2026);
    }
    await this.migrarCapacitaciones();
    this.config.seeded = true;
    await this.adapter.saveConfig({ seeded: true });
    onProgress?.('Listo');
  }

  /* --- años --- */
  async year(anio: number) {
    let m = this.years.get(anio);
    if (!m) { m = new Map((await this.adapter.loadPartes(anio)).map((p) => [p.id, p])); this.years.set(anio, m); }
    return m;
  }
  /** Años con partes (los que tienen base de NH). */
  async allYears() {
    const ys = Object.keys(this.config.nhBase).map(Number);
    for (const y of ys) await this.year(y);
    return ys.map((y) => this.years.get(y)!);
  }
  nhBase(anio: number): number | null { const v = this.config.nhBase[String(anio)]; return v === undefined ? null : v; }
  async nextNumero(anio: number) { let m = 0; for (const p of (await this.year(anio)).values()) m = Math.max(m, p.numero); return m + 1; }

  async setNhBase(anio: number, numero: number, nh: number) {
    const base = nh - numero;
    this.config.nhBase = { ...this.config.nhBase, [String(anio)]: base };
    await this.adapter.saveConfig({ nhBase: this.config.nhBase });
    const ys = await this.year(anio); const changed: Parte[] = [];
    for (const p of ys.values()) { const n = base + p.numero; if (p.nh !== n) { p.nh = n; changed.push(p); } }
    if (changed.length) await this.adapter.savePartes(changed);
    return base;
  }

  /* --- códigos propios (los que no existen en el PDF) --- */
  codigos(): (Codigo & { propio?: number })[] {
    const ex = this.config.codigosExtra.map((c, i) => ({ id: c.id, servicio: c.servicio, rubro: c.rubro, cod: c.id.split('-P')[1] ? `P${c.id.split('-P')[1]}` : c.id, descripcion: c.descripcion, dup: 0, orden: 10000 + i, propio: 1 })) as any[];
    return [...CODIGOS, ...ex];
  }
  codigoById(id: string) { return CODIGO_BY_ID.get(id) ?? this.codigos().find((c) => c.id === id) ?? null; }
  async addCodigo(p: { servicio: string; rubro: string; descripcion: string }) {
    const servicio = String(p.servicio); const descripcion = String(p.descripcion ?? '').trim().toUpperCase(); const rubro = String(p.rubro ?? '').trim().toUpperCase();
    if (!SERVICIO_BY_ID.has(servicio)) throw new HttpError(400, 'Elegí un servicio.');
    if (!descripcion || !rubro) throw new HttpError(400, 'Completá el rubro y la descripción.');
    if (this.config.codigosExtra.some((c) => c.servicio === servicio && c.rubro === rubro && c.descripcion === descripcion)) throw new HttpError(409, 'Ya existe ese código propio.');
    let n = 1; while (this.config.codigosExtra.some((c) => c.id === `${servicio}-P${n}`)) n++;
    const nuevo = { id: `${servicio}-P${n}`, servicio, rubro, descripcion };
    this.config.codigosExtra = [...this.config.codigosExtra, nuevo];
    await this.adapter.saveConfig({ codigosExtra: this.config.codigosExtra });
    return nuevo.id;
  }
  async deleteCodigo(id: string) {
    if (!this.config.codigosExtra.some((c) => c.id === id)) throw new HttpError(404, 'No es un código propio.');
    let n = 0; for (const ys of await this.allYears()) for (const p of ys.values()) if (p.codigo_id === id) n++;
    if (n) throw new HttpError(409, `Lo usan ${n} partes: cambiales el código antes de borrarlo.`);
    this.config.codigosExtra = this.config.codigosExtra.filter((c) => c.id !== id);
    const cc = { ...this.config.catCodigo }; for (const k of Object.keys(cc)) if (cc[k] === id) cc[k] = null;
    this.config.catCodigo = cc;
    await this.adapter.saveConfig({ codigosExtra: this.config.codigosExtra, catCodigo: cc });
  }
  /** Una sola vez: crea los códigos propios de capacitación y los sugiere en las categorías que todavía no tienen código (respeta lo que ya corregiste). */
  private async migrarCapacitaciones() {
    if (this.config.capSeeded) return;
    const defs: [string, string][] = [['1RA', 'CATEGORIA 1RA'], ['2DA', 'CATEGORIA 2DA'], ['3RA', 'CATEGORIA 3RA'], ['4TA', 'CATEGORIA 4TA'], ['CUERDAS', 'BRIGADA DE CUERDAS'], ['FORESTAL', 'BRIGADA FORESTAL'], ['NAUTICA', 'BRIGADA NAUTICA']];
    const ids: Record<string, string> = {};
    for (const [k, d] of defs) {
      const descripcion = `CAPACITACION ${d}`;
      const ya = this.config.codigosExtra.find((c) => c.servicio === '08' && c.descripcion === descripcion);
      ids[k] = ya ? ya.id : await this.addCodigo({ servicio: '08', rubro: 'CAPACITACION', descripcion });
    }
    const sug: Record<string, string> = {};
    for (const c of this.categorias()) {
      if (c.codigo_id || c.id in this.config.catCodigo) continue;
      const n = norm(c.nombre);
      const k = /\b1ra\b/.test(n) ? '1RA' : /\b2da\b/.test(n) ? '2DA' : /\b3ra\b/.test(n) ? '3RA' : /\b4ta\b/.test(n) ? '4TA' : /cuerda/.test(n) ? 'CUERDAS' : /forestal/.test(n) ? 'FORESTAL' : /nautic/.test(n) ? 'NAUTICA' : null;
      if (k) sug[c.id] = ids[k];
    }
    this.config.catCodigo = { ...this.config.catCodigo, ...sug }; this.config.capSeeded = true;
    await this.adapter.saveConfig({ catCodigo: this.config.catCodigo, capSeeded: true });
  }

  /* --- categorías --- */
  categorias() {
    const extra = this.config.catExtra.map((c) => ({ id: c.id, nombre: c.nombre, servicio: null as string | null, rubro: null as string | null, codigo_id: null as string | null }));
    return [...CATEGORIAS_BASE, ...extra].map((c) => ({ ...c, codigo_id: c.id in this.config.catCodigo ? this.config.catCodigo[c.id] : c.codigo_id }));
  }
  categoriaById(id: string | null) { return id ? this.categorias().find((c) => c.id === id) ?? null : null; }

  async setCategoriaCodigo(id: string, codigo_id: string | null) {
    this.config.catCodigo = { ...this.config.catCodigo, [id]: codigo_id };
    await this.adapter.saveConfig({ catCodigo: this.config.catCodigo });
  }

  /* --- personal --- */
  private activos() { return [...this.personal.values()].filter((p) => p.activo).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)); }
  private async writeOrder(ids: string[]) {
    const changed: Personal[] = [];
    ids.forEach((id, i) => { const p = this.personal.get(id)!; if (p.orden !== i + 1 || !p.activo) { p.orden = i + 1; changed.push(p); } });
    if (changed.length) await this.adapter.savePersonal(changed);
  }
  listPersonal() {
    return [...this.personal.values()]
      .map((p) => ({ ...p, j: p.activo ? p.orden : null, nivel: NIVEL.get(p.jerarquia) ?? 0 }))
      .sort((a, b) => (b.activo - a.activo) || ((a.orden ?? 0) - (b.orden ?? 0)) || a.legajo.localeCompare(b.legajo));
  }
  suggestJ(jerarquia: string) {
    const nivel = NIVEL.get(jerarquia); const act = this.activos();
    if (!nivel) return act.length + 1;
    let m = 0; for (const p of act) if ((NIVEL.get(p.jerarquia) ?? 0) >= nivel) m = Math.max(m, p.orden ?? 0);
    return m + 1;
  }
  async addPersonal(p: any) {
    const legajo = String(p.legajo).trim().padStart(3, '0');
    if (this.personal.has(legajo)) throw new HttpError(409, 'Ese legajo ya existe.');
    if (!NIVEL.has(p.jerarquia)) throw new HttpError(400, 'Jerarquía inválida.');
    const ids = this.activos().map((x) => x.id);
    const j = Math.min(Math.max(parseInt(p.j) || this.suggestJ(p.jerarquia), 1), ids.length + 1);
    const np: Personal = { id: legajo, legajo, jerarquia: p.jerarquia, nombre: String(p.nombre).toUpperCase().trim(), activo: 1, orden: j };
    this.personal.set(legajo, np);
    ids.splice(j - 1, 0, legajo);
    await this.adapter.savePersonal([np]);
    await this.writeOrder(ids);
    return legajo;
  }
  async movePersonal(id: string, j: number) {
    const ids = this.activos().map((x) => x.id).filter((x) => x !== id);
    ids.splice(Math.min(Math.max(j, 1), ids.length + 1) - 1, 0, id);
    await this.writeOrder(ids);
  }
  async setActivo(id: string, activo: boolean, j?: number) {
    const p = this.personal.get(id); if (!p) throw new HttpError(404, 'No existe.');
    if (!activo) {
      p.activo = 0; p.orden = null; await this.adapter.savePersonal([p]);
      await this.writeOrder(this.activos().map((x) => x.id));
    } else {
      const ids = this.activos().map((x) => x.id);
      const pos = Math.min(Math.max(j || this.suggestJ(p.jerarquia), 1), ids.length + 1);
      p.activo = 1; p.orden = pos; await this.adapter.savePersonal([p]);
      ids.splice(pos - 1, 0, id); await this.writeOrder(ids);
    }
  }
  async updatePersonal(id: string, patch: any) {
    const cur = this.personal.get(id); if (!cur) throw new HttpError(404, 'No existe.');
    const nuevoLegajo = patch.legajo != null ? String(patch.legajo).trim().padStart(3, '0') : cur.legajo;
    const upd: Personal = {
      ...cur, legajo: nuevoLegajo, jerarquia: patch.jerarquia ?? cur.jerarquia,
      nombre: patch.nombre != null ? String(patch.nombre).toUpperCase().trim() : cur.nombre,
    };
    if (nuevoLegajo !== cur.legajo) {
      if (this.personal.has(nuevoLegajo)) throw new HttpError(409, 'Ese legajo ya existe.');
      upd.id = nuevoLegajo; this.personal.delete(id); this.personal.set(nuevoLegajo, upd);
      await this.adapter.savePersonal([upd]); await this.adapter.deletePersonal(id);
      for (const ys of await this.allYears()) {
        const ch: Parte[] = []; for (const pa of ys.values()) if (pa.a_cargo_id === id) { pa.a_cargo_id = nuevoLegajo; ch.push(pa); }
        if (ch.length) await this.adapter.savePartes(ch);
      }
    } else { this.personal.set(id, upd); await this.adapter.savePersonal([upd]); }
  }
  async deletePersonal(id: string) {
    let n = 0; for (const ys of await this.allYears()) for (const pa of ys.values()) if (pa.a_cargo_id === id) n++;
    if (n > 0) throw new HttpError(409, `Tiene ${n} partes a su cargo: dalo de baja en lugar de borrarlo.`);
    this.personal.delete(id); await this.adapter.deletePersonal(id);
    await this.writeOrder(this.activos().map((x) => x.id));
  }

  /* --- partes --- */
  row(p: Parte) {
    const co = p.codigo_id ? this.codigoById(p.codigo_id) : null; const sv = co ? SERVICIO_BY_ID.get(co.servicio) : null;
    const pe = p.a_cargo_id ? this.personal.get(p.a_cargo_id) : null; const ca = this.categoriaById(p.categoria_id);
    return {
      ...p, categoria: ca?.nombre ?? null,
      cod_servicio: co?.servicio ?? null, cod_rubro: co?.rubro ?? null, cod_cod: co?.cod ?? null, cod_desc: co?.descripcion ?? null, cod_servicio_nombre: sv?.nombre ?? null,
      a_cargo_legajo: pe?.legajo ?? null, a_cargo_nombre: pe?.nombre ?? null, a_cargo_jerarquia: pe?.jerarquia ?? null,
    };
  }

  async listPartes(q: URLSearchParams) {
    const anio = Number(q.get('anio') || new Date().getFullYear());
    let rows = [...(await this.year(anio)).values()].map((p) => this.row(p));
    if (q.get('mes')) rows = rows.filter((r) => r.mes === Number(q.get('mes')));
    const est = q.get('estado'); if (est !== null && est !== '') rows = rows.filter((r) => r.estado === Number(est));
    if (q.get('pendientes') === '1') rows = rows.filter((r) => r.codigo_revisado === 0);
    if (q.get('acargo')) rows = rows.filter((r) => r.a_cargo_id === q.get('acargo'));
    const t = (q.get('q') ?? '').trim();
    if (t) {
      const tn = norm(t);
      rows = rows.filter((r) => String(r.numero) === t || String(r.nh) === t || [r.a_cargo_nombre, r.categoria, r.cod_desc].some((x) => x && norm(x).includes(tn)));
    }
    rows.sort((a, b) => b.numero - a.numero);
    const limit = Math.min(Number(q.get('limit') || 100), 500); const offset = Number(q.get('offset') || 0);
    return { total: rows.length, rows: rows.slice(offset, offset + limit), nhBase: this.nhBase(anio), proximo: await this.nextNumero(anio) };
  }

  async getParte(id: string) { for (const ys of this.years.values()) { const p = ys.get(id); if (p) return this.row(p); } return null; }

  async createParte(p: any) {
    const anio = Number(p.anio); const numero = p.numero ? Number(p.numero) : await this.nextNumero(anio);
    let base = this.nhBase(anio);
    if (base === null) {
      if (!p.nh) throw new HttpError(409, 'Es el primer parte del año: indicá su N° histórico (NH).', { error: 'NEED_NH', message: 'Es el primer parte del año: indicá su N° histórico (NH).' });
      base = await this.setNhBase(anio, numero, Number(p.nh));
    }
    const cat = this.categoriaById(p.categoria_id ?? null);
    const codigo_id = p.codigo_id ?? null;
    const np: Parte = {
      id: parteId(anio, numero), anio, numero, nh: base + numero, mes: Number(p.mes), dia: Number(p.dia), categoria_id: p.categoria_id ?? null,
      codigo_id: codigo_id ?? cat?.codigo_id ?? null, codigo_revisado: codigo_id ? 1 : 0, a_cargo_id: p.a_cargo_id ?? null, estado: Number(p.estado ?? 0),
      firma: p.firma ?? null, impreso: p.impreso ?? null, mes_archivo: p.mes_archivo ?? null, mes_gib: p.mes_gib ?? null,
    };
    const ys = await this.year(anio);
    if (ys.has(np.id) || !(await this.adapter.createParte(np))) throw new HttpError(409, 'Ya existe un parte con ese número en ese año.');
    ys.set(np.id, np);
    return this.row(np);
  }

  async updateParte(id: string, patch: any) {
    let found: Parte | undefined; for (const ys of this.years.values()) if (ys.has(id)) found = ys.get(id);
    if (!found) throw new HttpError(404, 'No existe el parte.');
    for (const k of ['mes', 'dia', 'categoria_id', 'codigo_id', 'a_cargo_id', 'estado', 'firma', 'impreso', 'mes_archivo', 'mes_gib'] as const) {
      if (k in patch) (found as any)[k] = patch[k] === '' ? null : patch[k];
    }
    if ('codigo_id' in patch) found.codigo_revisado = patch.codigo_id ? 1 : 0;
    await this.adapter.savePartes([found]);
    return this.row(found);
  }

  async deleteParte(id: string) {
    for (const ys of this.years.values()) ys.delete(id);
    await this.adapter.deleteParte(id);
  }

  /** Asigna un código a todos los partes (pendientes) de una categoría vieja. */
  async bulkCodigo(categoria_id: string, codigo_id: string, soloPendientes = true) {
    const ch: Parte[] = [];
    for (const ys of await this.allYears()) for (const p of ys.values())
      if (p.categoria_id === categoria_id && (!soloPendientes || p.codigo_revisado === 0)) { p.codigo_id = codigo_id; p.codigo_revisado = 1; ch.push(p); }
    if (ch.length) await this.adapter.savePartes(ch);
    return ch.length;
  }
  async confirmarSugeridos(categoria_id: string) {
    const ch: Parte[] = [];
    for (const ys of await this.allYears()) for (const p of ys.values())
      if (p.categoria_id === categoria_id && p.codigo_revisado === 0 && p.codigo_id) { p.codigo_revisado = 1; ch.push(p); }
    if (ch.length) await this.adapter.savePartes(ch);
    return ch.length;
  }

  async catalogos() {
    const cnt = new Map<string, { partes: number; pendientes: number }>();
    for (const ys of await this.allYears()) for (const p of ys.values()) if (p.categoria_id) {
      const c = cnt.get(p.categoria_id) ?? { partes: 0, pendientes: 0 }; c.partes++; if (!p.codigo_revisado) c.pendientes++; cnt.set(p.categoria_id, c);
    }
    return {
      servicios: SERVICIOS, codigos: this.codigos(), jerarquias: JERARQUIAS, personal: this.listPersonal(),
      categorias: this.categorias().map((c) => ({ ...c, ...(cnt.get(c.id) ?? { partes: 0, pendientes: 0 }) })).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    };
  }

  /* --- trazabilidad --- */
  async trazabilidad(anio: number, mes?: number) {
    const ps = [...(await this.year(anio)).values()].filter((p) => !mes || p.mes === mes);
    const por = new Map<string, number>(); const pend = new Map<string, number>(); let revisados = 0;
    for (const p of ps) {
      if (p.codigo_revisado && p.codigo_id) { por.set(p.codigo_id, (por.get(p.codigo_id) ?? 0) + 1); revisados++; }
      else if (!p.codigo_revisado) { const n = this.categoriaById(p.categoria_id)?.nombre ?? 'sin categoría'; pend.set(n, (pend.get(n) ?? 0) + 1); }
    }
    const tree: any[] = [];
    for (const c of this.codigos()) {
      const n = por.get(c.id); if (!n) continue;
      let s = tree.find((x) => x.id === c.servicio);
      if (!s) tree.push((s = { id: c.servicio, nombre: SERVICIO_BY_ID.get(c.servicio)!.nombre, n: 0, hijos: [] }));
      let ru = s.hijos.find((x: any) => x.nombre === c.rubro);
      if (!ru) s.hijos.push((ru = { nombre: c.rubro, n: 0, hijos: [] }));
      ru.hijos.push({ id: c.id, nombre: `${c.cod} ${c.descripcion}`, n }); ru.n += n; s.n += n;
    }
    tree.sort((a, b) => a.id.localeCompare(b.id));
    const porMes = Array.from({ length: 13 }, (_, m) => ({ mes: m, total: 0, revisados: 0 }));
    for (const p of (await this.year(anio)).values()) { const b = porMes[p.mes >= 1 && p.mes <= 12 ? p.mes : 0]; b.total++; if (p.codigo_revisado && p.codigo_id) b.revisados++; }
    return { total: ps.length, revisados, porMes, tree, pendientes: [...pend].map(([categoria, n]) => ({ categoria, n })).sort((a, b) => b.n - a.n) };
  }

  /* --- importación CSV --- */
  async importCsv(text: string, anio: number) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new HttpError(400, 'El archivo no tiene filas de datos.');
    const head = rows[0].map(norm);
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const ix = { s: col('s', 'n', 'parte', 'n parte'), nh: col('n.h.', 'nh', 'n.h'), dia: col('dia'), mes: col('mes'), cat: col('categoria'), cargo: col('a cargo'),
      estado: col('estado'), firma: col('firma'), impreso: col('impreso'), arch: col('mes archivo'), gib: col('gib') };
    if (ix.s < 0 || ix.dia < 0 || ix.mes < 0) throw new HttpError(400, 'No encuentro las columnas S, DIA y MES en la primera fila.');

    const rep = { insertados: 0, actualizados: 0, omitidos: 0, base: null as number | null, nhDistinto: [] as any[], diaInvalido: [] as any[], mesInvalido: [] as number[],
      estadoDudoso: [] as number[], sinCargo: [] as number[], categoriasNuevas: [] as string[], legajosDesconocidos: [] as string[], filasInvalidas: [] as number[] };
    const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
    const data = rows.slice(1);

    let base = this.nhBase(anio);
    if (base === null && ix.nh >= 0) {
      for (const r of data) {
        const s = parseInt(get(r, ix.s)); const nh = parseInt(get(r, ix.nh));
        if (!isNaN(s) && !isNaN(nh)) { base = await this.setNhBase(anio, s, nh); break; }
      }
    }
    rep.base = base;

    const cats = new Map(this.categorias().map((c) => [norm(c.nombre), c]));
    const ys = await this.year(anio); const out: Parte[] = []; let extraCambio = false;
    for (const r of data) {
      const numero = parseInt(get(r, ix.s)); const dia = parseInt(get(r, ix.dia));
      const mesTxt = get(r, ix.mes).toUpperCase(); let mes = MESES.indexOf(mesTxt) + 1;
      if (isNaN(numero) || isNaN(dia)) { rep.omitidos++; rep.filasInvalidas.push(isNaN(numero) ? -1 : numero); continue; }
      if (mes === 0) { mes = 0; rep.mesInvalido.push(numero); }
      if (dia < 1 || dia > 31) rep.diaInvalido.push({ numero, dia, mes: mesTxt });

      const catTxt = get(r, ix.cat); let cat: any = null;
      if (catTxt && catTxt !== '?') {
        cat = cats.get(norm(catTxt));
        if (!cat) {
          cat = { id: slug(catTxt) || `x-${this.config.catExtra.length + 1}`, nombre: catTxt, codigo_id: null };
          cats.set(norm(catTxt), cat); this.config.catExtra = [...this.config.catExtra, { id: cat.id, nombre: catTxt }]; extraCambio = true; rep.categoriasNuevas.push(catTxt);
        }
      }
      const leg = get(r, ix.cargo).match(/^(\d{1,3})/)?.[1]?.padStart(3, '0');
      let cargo: string | null = null;
      if (leg) { if (this.personal.has(leg)) cargo = leg; else if (!rep.legajosDesconocidos.includes(leg)) rep.legajosDesconocidos.push(leg); } else rep.sinCargo.push(numero);

      const estTxt = get(r, ix.estado); const estN = parseInt(estTxt);
      const estado = isNaN(estN) ? 0 : estN; if (isNaN(estN)) rep.estadoDudoso.push(numero);
      const arch = get(r, ix.arch).toUpperCase(); const gib = get(r, ix.gib).toUpperCase();
      const nh = base !== null ? base + numero : null; const nhCsv = parseInt(get(r, ix.nh));
      if (nh !== null && !isNaN(nhCsv) && nhCsv !== nh) rep.nhDistinto.push({ numero, csv: nhCsv, calculado: nh });

      const id = parteId(anio, numero); const ex = ys.get(id);
      const p: Parte = {
        id, anio, numero, nh, mes, dia, categoria_id: cat?.id ?? null, a_cargo_id: cargo, estado, firma: get(r, ix.firma) || null,
        impreso: parseImpreso(get(r, ix.impreso), anio), mes_archivo: MESES.includes(arch) ? arch : null, mes_gib: MESES.includes(gib) ? gib : null,
        codigo_id: ex ? ex.codigo_id : cat?.codigo_id ?? null, codigo_revisado: ex ? ex.codigo_revisado : 0,
      };
      if (ex) rep.actualizados++; else rep.insertados++;
      ys.set(id, p); out.push(p);
    }
    if (extraCambio) await this.adapter.saveConfig({ catExtra: this.config.catExtra });
    if (out.length) await this.adapter.savePartes(out);
    return rep;
  }
}
