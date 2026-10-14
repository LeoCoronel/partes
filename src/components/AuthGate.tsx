import { useEffect, useState, type ReactNode } from 'react';
import { firebaseConfigured, allowedEmail, login, logout, onUser, db } from '../lib/firebase';
import { FirestoreAdapter } from '../lib/firestoreAdapter';
import { initStore, demoAdapter } from '../lib/localApi';

type St = { k: 'init' } | { k: 'out' } | { k: 'denied'; email: string } | { k: 'load'; msg: string } | { k: 'ready'; demo: boolean; email?: string } | { k: 'error'; msg: string };

export default function AuthGate({ children }: { children: (info: { demo: boolean; email?: string }) => ReactNode }) {
  const [st, setSt] = useState<St>({ k: 'init' });
  const start = async (adapter: any, demo: boolean, email?: string) => {
    try { setSt({ k: 'load', msg: 'Cargando…' }); await initStore(adapter, (msg) => setSt({ k: 'load', msg })); setSt({ k: 'ready', demo, email }); }
    catch (e: any) { setSt({ k: 'error', msg: e?.message ?? String(e) }); }
  };
  useEffect(() => {
    if (!firebaseConfigured) { start(demoAdapter(), true); return; }
    if (!allowedEmail) { start(new FirestoreAdapter(db()), false); return; } // sin login: acceso directo
    return onUser((u) => {
      if (!u) return setSt({ k: 'out' });
      if (allowedEmail && u.email?.toLowerCase() !== allowedEmail) return setSt({ k: 'denied', email: u.email ?? '' });
      start(new FirestoreAdapter(db()), false, u.email ?? undefined);
    });
  }, []);

  if (st.k === 'ready') return <>{children({ demo: st.demo, email: st.email })}</>;
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card p-8 max-w-sm w-full text-center space-y-4">
        <div className="text-4xl">🚒</div>
        <h1 className="text-lg font-semibold">Partes de servicio</h1>
        {(st.k === 'init' || st.k === 'load') && <p className="muted">{st.k === 'load' ? st.msg : 'Iniciando…'}</p>}
        {st.k === 'out' && <button className="btn btn-primary w-full" onClick={() => login().catch((e) => setSt({ k: 'error', msg: e.message }))}>Entrar con Google</button>}
        {st.k === 'denied' && <><p className="muted">{st.email} no tiene acceso a esta app.</p><button className="btn w-full" onClick={() => logout()}>Probar con otra cuenta</button></>}
        {st.k === 'error' && <><p className="text-red-400 text-sm break-words">{st.msg}</p><button className="btn w-full" onClick={() => location.reload()}>Reintentar</button></>}
      </div>
    </div>
  );
}
