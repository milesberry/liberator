// ─── App layout ───────────────────────────────────────────────────────────
// CSS grid: toolbar (top) | palette (left) | canvas (centre) | output (bottom)

import { useRef } from 'react';
import { Toolbar }          from '../toolbar/Toolbar';
import { Palette }          from './Palette';
import { LiberatorCanvas }  from '../canvas/LiberatorCanvas';
import { OutputPanel }      from './OutputPanel';
import { PropertiesPanel }  from './PropertiesPanel';
import { HaskellPanel }     from './HaskellPanel';

export function AppLayout() {
  // Bridge: CanvasInner (inside ReactFlowProvider) registers its tidy-up handler
  // here so the Toolbar (outside the provider) can trigger it.
  const tidyUpRef = useRef<(() => void) | null>(null);

  return (
    <div className="flex flex-col h-screen overflow-hidden"
         style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* Top toolbar — full width */}
      <Toolbar onTidyUp={() => tidyUpRef.current?.()} />

      {/* Main area: palette + canvas + properties */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <div className="w-52 flex-shrink-0 overflow-hidden">
          <Palette />
        </div>

        {/* Canvas + output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <LiberatorCanvas onRegisterTidyUp={(fn) => { tidyUpRef.current = fn; }} />
          </div>

          {/* Bottom output panel */}
          <div className="h-40 flex-shrink-0">
            <OutputPanel />
          </div>
        </div>

        {/* Right properties panel */}
        <PropertiesPanel />
        {/* Haskell code panel */}
        <HaskellPanel />
      </div>
    </div>
  );
}
