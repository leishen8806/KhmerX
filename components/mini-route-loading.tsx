import {LoaderCircle} from 'lucide-react';
import type {ReactElement} from 'react';

export function MiniRouteLoading(): ReactElement {
  return (
    <main className="mini-app mini-route-loading-shell" role="status" aria-live="polite">
      <header className="mini-top mini-route-loading-top">
        <span className="mini-loading-placeholder mini-loading-placeholder--back" aria-hidden="true" />
        <span className="mini-loading-placeholder mini-loading-placeholder--title" aria-hidden="true" />
      </header>
      <div className="mini-content mini-route-loading-content">
        <section className="mini-card mini-route-loading-card">
          <LoaderCircle size={28} className="spin" aria-hidden="true" />
          <span>正在加载页面…</span>
        </section>
      </div>
      <nav className="mini-bottom mini-route-loading-bottom" aria-hidden="true">
        <span />
        <span />
        <span />
      </nav>
    </main>
  );
}
