import { Store, HttpError, LocalStorageAdapter, type Adapter } from './store';

let store: Store | null = null;
export const setStore = (s: Store) => { store = s; };
export const getStore = () => { if (!store) throw new Error('Store no iniciado'); return store; };

/** Router local: mismas rutas que tenía la API REST, pero sobre el Store en memoria. */
export async function handle(method: string, url: string, body: any = {}): Promise<any> {
  const s = getStore();
  const u = new URL(url, 'http://x');
  const q = u.searchParams;
  const p = u.pathname.replace(/^\/api\//, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [r, id, sub] = p;
  const anioQ = Number(q.get('anio') || new Date().getFullYear());

  if (r === 'catalogos') return s.catalogos();
  if (r === 'config') {
    if (method === 'PUT') { await s.setNhBase(Number(body.anio), Number(body.numero), Number(body.nh)); return { ok: true }; }
    return { nhBase: s.nhBase(anioQ), proximo: await s.nextNumero(anioQ) };
  }
  if (r === 'trazabilidad') return s.trazabilidad(anioQ, q.get('mes') ? Number(q.get('mes')) : undefined);
  if (r === 'importar') return s.importCsv(String(body.csv ?? ''), Number(body.anio));
  if (r === 'codigos') {
    if (method === 'POST') return { id: await s.addCodigo(body) };
    if (method === 'DELETE') { await s.deleteCodigo(id); return { ok: true }; }
  }
  if (r === 'categorias' && method === 'PATCH') { await s.setCategoriaCodigo(id, body.codigo_id ?? null); return { ok: true }; }
  if (r === 'partes') {
    if (id === 'bulk') {
      const n = body.confirmar ? await s.confirmarSugeridos(body.categoria_id) : await s.bulkCodigo(body.categoria_id, body.codigo_id);
      return { cambiados: n, actualizados: n };
    }
    if (!id) return method === 'POST' ? s.createParte(body) : s.listPartes(q);
    if (method === 'PATCH') return s.updateParte(id, body);
    if (method === 'DELETE') { await s.deleteParte(id); return { ok: true }; }
    const x = await s.getParte(id); if (!x) throw new HttpError(404, 'No existe.'); return x;
  }
  if (r === 'personal') {
    if (!id) {
      if (method === 'POST') { const legajo = await s.addPersonal(body); return { id: legajo }; }
      return { sugerido: s.suggestJ(q.get('jerarquia') ?? ''), personal: s.listPersonal() };
    }
    if (method === 'DELETE') { await s.deletePersonal(id); return { ok: true }; }
    if (method === 'PATCH') {
      if (body.accion === 'mover') await s.movePersonal(id, Number(body.j));
      else if (body.accion === 'baja') await s.setActivo(id, false);
      else if (body.accion === 'alta') await s.setActivo(id, true, body.j ? Number(body.j) : undefined);
      else {
        const before = s.personal.get(id)?.jerarquia;
        await s.updatePersonal(id, body);
        void before;
      }
      return { ok: true };
    }
  }
  throw new HttpError(404, `Ruta desconocida: ${method} ${url}`);
}

export const seedCsv = async () => (await import('../../data/partes_2026.csv?raw')).default as string;

export async function initStore(adapter: Adapter, onProgress?: (m: string) => void) {
  const s = new Store(adapter);
  await s.init(onProgress, seedCsv);
  setStore(s);
  return s;
}
export const demoAdapter = () => new LocalStorageAdapter();
