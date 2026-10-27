// ─── Runtime value types ───────────────────────────────────────────────────
// Produced by the evaluation engine. VFun is a curried JS function.

export type HaskellValue =
  | { tag: 'VInt';    value: number }
  | { tag: 'VFloat';  value: number }
  | { tag: 'VBool';   value: boolean }
  | { tag: 'VString'; value: string }
  | { tag: 'VList';   elements: HaskellValue[] }
  | { tag: 'VTuple';  elements: HaskellValue[] }
  | { tag: 'VFun';    fn: (arg: HaskellValue) => HaskellValue;
      // For functions made by a lambda: what fn would evaluate, so the evaluator
      // can run a tail call in a loop instead of nesting another JS call
      tail?: (arg: HaskellValue) => { expr: unknown; env: Map<string, HaskellValue> };
      // For a recursive function's name: the function it currently stands for
      deref?: () => HaskellValue }
  | { tag: 'VError';  message: string }
  | { tag: 'VBottom' };   // non-terminating / step budget exceeded

// ─── Constructors ─────────────────────────────────────────────────────────

export const VInt    = (value: number): HaskellValue => ({ tag: 'VInt', value });
export const VFloat  = (value: number): HaskellValue => ({ tag: 'VFloat', value });
export const VBool   = (value: boolean): HaskellValue => ({ tag: 'VBool', value });
export const VString = (value: string): HaskellValue => ({ tag: 'VString', value });
export const VList   = (elements: HaskellValue[]): HaskellValue => ({ tag: 'VList', elements });
export const VTuple  = (elements: HaskellValue[]): HaskellValue => ({ tag: 'VTuple', elements });
export const VFun    = (fn: (a: HaskellValue) => HaskellValue): HaskellValue => ({ tag: 'VFun', fn });
export const VError  = (message: string): HaskellValue => ({ tag: 'VError', message });
export const VBottom: HaskellValue = { tag: 'VBottom' };

// ─── Display ──────────────────────────────────────────────────────────────

export function showValue(v: HaskellValue): string {
  switch (v.tag) {
    case 'VInt':    return v.value.toString();
    case 'VFloat':  return Number.isInteger(v.value) ? v.value.toFixed(1) : v.value.toString();  // 4.0, as Haskell shows it
    case 'VBool':   return v.value ? 'True' : 'False';
    case 'VString': return `"${v.value}"`;
    case 'VList':   return `[${v.elements.map(showValue).join(', ')}]`;
    case 'VTuple':  return `(${v.elements.map(showValue).join(', ')})`;
    case 'VFun':    return '<function>';
    case 'VError':  return `Error: ${v.message}`;
    case 'VBottom': return '⊥';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function isNumeric(v: HaskellValue): v is { tag: 'VInt' | 'VFloat'; value: number } {
  return v.tag === 'VInt' || v.tag === 'VFloat';
}

export function toNumber(v: HaskellValue): number {
  if (v.tag === 'VInt' || v.tag === 'VFloat') return v.value;
  return NaN;
}
