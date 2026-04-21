import { useEffect } from 'react';
import { hivesignerCb } from '@aioha/aioha/build/lib/hivesigner-cb.js';

export const HiveSignerCallback = () => {
  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx !== -1) {
      const query = hash.slice(qIdx);
      const hashPath = hash.slice(0, qIdx);
      const rewritten = `${window.location.origin}${window.location.pathname}${query}${hashPath}`;
      window.history.replaceState(null, '', rewritten);
    }
    hivesignerCb();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-8">
      <div className="card bg-base-100 shadow-xl max-w-md w-full">
        <div className="card-body text-center">
          <h2 className="card-title justify-center">HiveSigner Login</h2>
          <p className="text-base-content/70">Completing login, closing window...</p>
        </div>
      </div>
    </div>
  );
};
