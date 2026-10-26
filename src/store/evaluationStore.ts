// ─── Evaluation store ──────────────────────────────────────────────────────

import { create } from 'zustand';

export interface EvalResult {
  nodeId: string;
  label: string;
  value: string;    // showValue() output
  isError: boolean;
}

// The value carried by one wire after the last Run
export interface WireValue {
  kind: 'value' | 'function' | 'varies' | 'error';
  text: string;
}

interface EvaluationState {
  results: EvalResult[];
  isRunning: boolean;
  wireValues: Map<string, WireValue>;   // keyed by source handle, nodeId__portId

  setResults: (results: EvalResult[]) => void;
  setRunning: (running: boolean) => void;
  setWireValues: (values: Map<string, WireValue>) => void;
  clearWireValues: () => void;
  reset: () => void;
}

export const useEvaluationStore = create<EvaluationState>((set) => ({
  results: [],
  isRunning: false,
  wireValues: new Map(),

  setResults: (results) => set({ results }),
  setRunning: (isRunning) => set({ isRunning }),
  setWireValues: (wireValues) => set({ wireValues }),
  clearWireValues: () => set({ wireValues: new Map() }),
  reset: () => set({ results: [], isRunning: false, wireValues: new Map() }),
}));
