import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where, writeBatch, runTransaction, type Firestore } from 'firebase/firestore';
import type { Adapter, Config, Parte, Personal } from './store';

const chunk = <T,>(a: T[], n = 400) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const clean = (o: any) => JSON.parse(JSON.stringify(o)); // Firestore no admite undefined

export class FirestoreAdapter implements Adapter {
  constructor(private db: Firestore) {}
  async loadStatic() {
    const c = await getDoc(doc(this.db, 'ps_config', 'main'));
    const ps = await getDocs(collection(this.db, 'ps_personal'));
    return { config: (c.exists() ? c.data() : null) as Config | null, personal: ps.docs.map((d) => d.data() as Personal) };
  }
  async loadPartes(anio: number) {
    const r = await getDocs(query(collection(this.db, 'ps_partes'), where('anio', '==', anio)));
    return r.docs.map((d) => d.data() as Parte);
  }
  async saveConfig(patch: Partial<Config>) { await setDoc(doc(this.db, 'ps_config', 'main'), clean(patch), { merge: true }); }
  private async batchSet(col: string, items: { id: string }[]) {
    for (const c of chunk(items)) { const b = writeBatch(this.db); c.forEach((x) => b.set(doc(this.db, col, x.id), clean(x))); await b.commit(); }
  }
  savePersonal(list: Personal[]) { return this.batchSet('ps_personal', list); }
  deletePersonal(id: string) { return deleteDoc(doc(this.db, 'ps_personal', id)); }
  savePartes(list: Parte[]) { return this.batchSet('ps_partes', list); }
  async createParte(p: Parte) {
    const ref = doc(this.db, 'ps_partes', p.id);
    return runTransaction(this.db, async (t) => { if ((await t.get(ref)).exists()) return false; t.set(ref, clean(p)); return true; });
  }
  deleteParte(id: string) { return deleteDoc(doc(this.db, 'ps_partes', id)); }
}
