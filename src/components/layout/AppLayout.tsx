// ─── App layout ───────────────────────────────────────────────────────────
// CSS grid: toolbar (top) | palette (left) | canvas (centre) | output (bottom)

import { Toolbar }        from '../toolbar/Toolbar';
import { Palette }        from './Palette';
import { LiberatorCanvas } from '../canvas/LiberatorCanvas';
import { OutputPanel }    from './OutputPanel';

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top toolbar — full width */}
      <Toolbar />

      {/* Main area: palette + canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <div className="w-52 flex-shrink-0 overflow-hidden">
          <Palette />
        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <LiberatorCanvas />
          </div>

          {/* Bottom output panel */}
          <div className="h-40 flex-shrink-0">
            <OutputPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
