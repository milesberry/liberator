// ─── Haskell type system ────────────────────────────────────────────────────
// A simple monomorphic type language with TypeVars for polymorphic builtins.
// Full HM inference is not required: types flow outward from literal nodes and
// builtin signatures; TypeVars get instantiated per-edge via unification.

export type HaskellType =
  | { tag: 'Int' }
  | { tag: 'Float' }
  | { tag: 'Bool' }
  | { tag: 'String' }
  | { tag: 'List'; elem: HaskellType }
  | { tag: 'Fun'; from: HaskellType; to: HaskellType }
  | { tag: 'Tuple'; elems: HaskellType[] }
  | { tag: 'TypeVar'; name: string }   // scoped per node: 'a_<nodeId>'
  | { tag: 'Unknown' };                // unresolved — shown as '?' in UI

// ─── Convenience constructors ──────────────────────────────────────────────

export const TInt: HaskellType    = { tag: 'Int' };
export const TFloat: HaskellType  = { tag: 'Float' };
export const TBool: HaskellType   = { tag: 'Bool' };
export const TString: HaskellType = { tag: 'String' };
export const TUnknown: HaskellType = { tag: 'Unknown' };

export const TList  = (elem: HaskellType): HaskellType => ({ tag: 'List', elem });
export const TFun   = (from: HaskellType, to: HaskellType): HaskellType => ({ tag: 'Fun', from, to });
export const TTuple = (elems: HaskellType[]): HaskellType => ({ tag: 'Tuple', elems });
export const TVar   = (name: string): HaskellType => ({ tag: 'TypeVar', name });

// Build a curried function type from a list of argument types and result type
// e.g. TFunChain([TInt, TInt], TBool)  =>  Int -> Int -> Bool
export const TFunChain = (args: HaskellType[], result: HaskellType): HaskellType =>
  args.reduceRight((acc, arg) => TFun(arg, acc), result);

// ─── Pretty printing ───────────────────────────────────────────────────────

export function showType(t: HaskellType): string {
  switch (t.tag) {
    case 'Int':     return 'Int';
    case 'Float':   return 'Float';
    case 'Bool':    return 'Bool';
    case 'String':  return 'String';
    case 'Unknown': return '?';
    case 'TypeVar': {
      // Strip the node-id suffix for display: 'a_abc123' -> 'a'
      const base = t.name.split('_')[0];
      return base;
    }
    case 'List':    return `[${showType(t.elem)}]`;
    case 'Tuple':   return `(${t.elems.map(showType).join(', ')})`;
    case 'Fun': {
      const fromStr = t.from.tag === 'Fun'
        ? `(${showType(t.from)})`
        : showType(t.from);
      return `${fromStr} → ${showType(t.to)}`;
    }
  }
}

// ─── Structural equality ───────────────────────────────────────────────────

export function typesEqual(a: HaskellType, b: HaskellType): boolean {
  if (a.tag !== b.tag) return false;
  switch (a.tag) {
    case 'Int': case 'Float': case 'Bool': case 'String': case 'Unknown':
      return true;
    case 'TypeVar':
      return (b as { tag: 'TypeVar'; name: string }).name === a.name;
    case 'List':
      return typesEqual(a.elem, (b as { tag: 'List'; elem: HaskellType }).elem);
    case 'Fun': {
      const bf = b as { tag: 'Fun'; from: HaskellType; to: HaskellType };
      return typesEqual(a.from, bf.from) && typesEqual(a.to, bf.to);
    }
    case 'Tuple': {
      const bt = b as { tag: 'Tuple'; elems: HaskellType[] };
      return a.elems.length === bt.elems.length &&
        a.elems.every((e, i) => typesEqual(e, bt.elems[i]));
    }
  }
}

// ─── Unification ──────────────────────────────────────────────────────────
// Returns an updated substitution map on success, or null on failure.
// TypeVars unify with anything (one-way: only LHS vars are bound).

type Subst = Map<string, HaskellType>;

export function unify(
  a: HaskellType,
  b: HaskellType,
  subst: Subst = new Map()
): Subst | null {
  a = applySubst(subst, a);
  b = applySubst(subst, b);

  if (a.tag === 'Unknown' || b.tag === 'Unknown') return subst;

  if (a.tag === 'TypeVar') {
    if (b.tag === 'TypeVar' && a.name === b.name) return subst;
    if (occursIn(a.name, b)) return null; // occurs check
    const newSubst = new Map(subst);
    newSubst.set(a.name, b);
    return newSubst;
  }

  if (b.tag === 'TypeVar') {
    if (occursIn(b.name, a)) return null;
    const newSubst = new Map(subst);
    newSubst.set(b.name, a);
    return newSubst;
  }

  if (a.tag !== b.tag) return null;

  switch (a.tag) {
    case 'Int': case 'Float': case 'Bool': case 'String':
      return subst;
    case 'List': {
      const bl = b as { tag: 'List'; elem: HaskellType };
      return unify(a.elem, bl.elem, subst);
    }
    case 'Fun': {
      const bf = b as { tag: 'Fun'; from: HaskellType; to: HaskellType };
      const s1 = unify(a.from, bf.from, subst);
      if (!s1) return null;
      return unify(a.to, bf.to, s1);
    }
    case 'Tuple': {
      const bt = b as { tag: 'Tuple'; elems: HaskellType[] };
      if (a.elems.length !== bt.elems.length) return null;
      let s = subst;
      for (let i = 0; i < a.elems.length; i++) {
        const s2 = unify(a.elems[i], bt.elems[i], s);
        if (!s2) return null;
        s = s2;
      }
      return s;
    }
    default:
      return null;
  }
}

function occursIn(name: string, t: HaskellType): boolean {
  switch (t.tag) {
    case 'TypeVar': return t.name === name;
    case 'List':    return occursIn(name, t.elem);
    case 'Fun':     return occursIn(name, t.from) || occursIn(name, t.to);
    case 'Tuple':   return t.elems.some(e => occursIn(name, e));
    default:        return false;
  }
}

export function applySubst(subst: Subst, t: HaskellType): HaskellType {
  switch (t.tag) {
    case 'TypeVar': {
      const bound = subst.get(t.name);
      if (bound) return applySubst(subst, bound);
      return t;
    }
    case 'List':  return TList(applySubst(subst, t.elem));
    case 'Fun':   return TFun(applySubst(subst, t.from), applySubst(subst, t.to));
    case 'Tuple': return TTuple(t.elems.map(e => applySubst(subst, e)));
    default:      return t;
  }
}

// ─── Type category (for wire/port colouring) ──────────────────────────────

export type TypeCategory =
  | 'int' | 'float' | 'bool' | 'string' | 'list' | 'fun' | 'unknown';

export function typeCategory(t: HaskellType): TypeCategory {
  switch (t.tag) {
    case 'Int':     return 'int';
    case 'Float':   return 'float';
    case 'Bool':    return 'bool';
    case 'String':  return 'string';
    case 'List':    return 'list';
    case 'Fun':     return 'fun';
    case 'TypeVar': return 'unknown';
    case 'Unknown': return 'unknown';
    case 'Tuple':   return 'unknown';
  }
}

export function wireColor(t: HaskellType, compatible: boolean | null): string {
  if (compatible === false) return 'var(--color-wire-error)';
  switch (typeCategory(t)) {
    case 'int':     return 'var(--color-wire-int)';
    case 'float':   return 'var(--color-wire-float)';
    case 'bool':    return 'var(--color-wire-bool)';
    case 'list':    return 'var(--color-wire-list)';
    case 'fun':     return 'var(--color-wire-fun)';
    case 'string':  return 'var(--color-wire-string)';
    default:        return 'var(--color-wire-unknown)';
  }
}
