// ─── Wire value text ──────────────────────────────────────────────────────
// How the value on a wire is described, on the wire itself and in Properties.

import { showType, type HaskellType } from '../types/haskell';
import type { WireValue } from '../store/evaluationStore';

// True when every part of the type is known (no type variables or unknowns)
function isConcrete(t: HaskellType): boolean {
  switch (t.tag) {
    case 'TypeVar': case 'Unknown': return false;
    case 'List':  return isConcrete(t.elem);
    case 'Tuple': return t.elems.every(isConcrete);
    case 'Fun':   return isConcrete(t.from) && isConcrete(t.to);
    default:      return true;
  }
}

export function wireValueText(value: WireValue | undefined, type: HaskellType): string {
  if (!value) return 'Click Run to see the value here';
  // A half-known type such as Int → b would only confuse, so give it only when certain
  if (value.kind === 'function') return isConcrete(type) ? `a function (${showType(type)})` : 'a function';
  if (value.kind === 'error') return `error: ${value.text}`;
  return value.text;
}
