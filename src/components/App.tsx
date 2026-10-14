import { useEffect, useState } from 'react';
import AuthGate from './AuthGate';
import PartesTable from './PartesTable';
import CargaRapida from './CargaRapida';
import Trazabilidad from './Trazabilidad';
import PersonalManager from './PersonalManager';
import Catalogos from './Catalogos';
import Importar from './Importar';
import { logout } from '../lib/firebase';

const NAV = [
  { id: 'partes', label: 'Partes', icon: 'M4 5h16M4 12h16M4 19h10', C: PartesTable },
  { id: 'carga', label: 'Carga rápida', icon: 'M13 2 4 14h7l-1 8 9-12h-7z', C: CargaRapida },
  { id: 'trazabilidad', label: 'Trazabilidad', icon: 'M5 4v6a3 3 0 0 0 3 3h8a3 3 0 0 1 3 3v4M5 4h.01M19 20h.01', C: Trazabilidad },
  { id: 'personal', label: 'Personal', icon: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 21a8 8 0 0 1 16 0', C: PersonalManager },
  { id: 'catalogos', label: 'Catálogos y códigos', icon: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6', C: Catalogos },
  { id: 'importar', label: 'Importar', icon: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16', C: Importar },
];
const cur = () => (location.hash.replace(/^#\/?/, '') || 'partes');

function Shell({ demo, email }: { demo: boolean; email?: string }) {
  const [route, setRoute] = useState(cur());
  useEffect(() => { const f = () => setRoute(cur()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const active = NAV.find((n) => n.id === route) ?? NAV[0];
  const Page = active.C;
  return (
    <div className="flex min-h-screen">
      <aside className="hidden sm:flex w-16 lg:w-60 shrink-0 flex-col gap-1 border-r border-line bg-panel p-2 lg:p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2 py-3 mb-3">
          <div className="size-9 rounded-full bg-panel2 grid place-items-center text-lg">🚒</div>
          <div className="hidden lg:block font-semibold leading-tight">Partes<br /><span className="muted text-xs font-normal">de servicio</span></div>
        </div>
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} title={n.label}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm no-underline ${active.id === n.id ? 'bg-panel2 text-ink' : 'text-mute hover:text-ink hover:bg-panel2'}`}>
            <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
            <span className="hidden lg:inline">{n.label}</span>
          </a>
        ))}
        <div className="mt-auto hidden lg:block px-2 text-xs muted break-all">
          {email}{email && <button className="btn mt-2 w-full" onClick={() => logout().then(() => location.reload())}>Salir</button>}
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-3 sm:p-6">
        {demo && <div className="card px-3 py-2 mb-3 text-sm" style={{ borderColor: '#f5a524' }}>Modo demo: los datos quedan solo en este navegador. Configurá Firebase (.env) para guardar en la nube.</div>}
        <nav className="sm:hidden flex gap-2 overflow-x-auto pb-3">
          {NAV.map((n) => <a key={n.id} href={`#/${n.id}`} className={`btn whitespace-nowrap ${active.id === n.id ? 'btn-primary' : ''}`}>{n.label}</a>)}
        </nav>
        <Page key={active.id} />
      </main>
    </div>
  );
}
export default function App() { return <AuthGate>{(i) => <Shell {...i} />}</AuthGate>; }
