// Catálogos estáticos (vienen en el código; no se guardan en la nube).
import codigosJson from '../../data/codigos.json';
import personalJson from '../../data/personal.json';
import categoriasJson from '../../data/categorias.json';

export const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
export const ESTADOS: Record<number, string> = { 0: 'FALTANTE', 1: 'CERRADO', 3: 'PERSONAL', 4: 'CAPACITACION' };
export const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export type Codigo = { id: string; servicio: string; rubro: string; cod: number | string; descripcion: string; dup: number; orden: number };
export type Servicio = { id: string; nombre: string; clasificacion: string };
export type CategoriaBase = { id: string; nombre: string; servicio: string | null; rubro: string | null; codigo_id: string | null };

const seen: Record<string, number> = {};
export const CODIGOS: Codigo[] = (codigosJson as any[]).map((c, i) => {
  const k = `${c.servicio}-${c.cod}`;
  seen[k] = (seen[k] ?? 0) + 1;
  return { id: c.dup ? `${k}-${seen[k]}` : k, servicio: c.servicio, rubro: c.rubro, cod: c.cod, descripcion: c.descripcion, dup: c.dup ? 1 : 0, orden: i };
});
export const CODIGO_BY_ID = new Map(CODIGOS.map((c) => [c.id, c]));

export const SERVICIOS: Servicio[] = [];
for (const c of codigosJson as any[]) if (!SERVICIOS.some((s) => s.id === c.servicio)) SERVICIOS.push({ id: c.servicio, nombre: c.servicioNombre, clasificacion: c.clasificacion });
SERVICIOS.sort((a, b) => a.id.localeCompare(b.id));
export const SERVICIO_BY_ID = new Map(SERVICIOS.map((s) => [s.id, s]));

export const JERARQUIAS: { nombre: string; nivel: number }[] = (personalJson as any).jerarquias.map((n: string, i: number) => ({ nombre: n, nivel: i + 1 }));
export const NIVEL = new Map(JERARQUIAS.map((j) => [j.nombre, j.nivel]));

export const CATEGORIAS_BASE: CategoriaBase[] = (categoriasJson as any[]).map((c) => ({
  id: slug(c.nombre), nombre: c.nombre, servicio: c.servicio, rubro: c.rubro,
  codigo_id: c.cod != null ? CODIGOS.find((x) => x.servicio === c.servicio && x.cod === c.cod && !x.dup)?.id ?? null : null,
}));

export type PersonalSeed = { legajo: string; jerarquia: string; nombre: string };
export const PERSONAL_SEED = { activos: (personalJson as any).activos as PersonalSeed[], inactivos: (personalJson as any).inactivos as PersonalSeed[] };
