// ─── Evaluation store ──────────────────────────────────────────────────────

import { create } from 'zustand';

export interface EvalResult {
  nodeId: string;
  label: string;
  value: string;    // showValue() output
  isError: boolean;
}

interface EvaluationState {
  results: EvalResult[];
  isRunning: boolean;

  setResults: (results: EvalResult[]) => void;
  setRunning: (running: boolean) => void;
  reset: () => void;
}

export const useEvaluationStore = create<EvaluationState>((set) => ({
  results: [],
  isRunning: false,

  setResults: (results) => set({ results }),
  setRunning: (isRunning) => set({ isRunning }),
  reset: () => set({ results: [], isRunning: false }),
}));
