# Liberator — Visual Haskell

A drag-and-drop visual programming environment for Haskell, designed for teaching AQA A-Level Computer Science. Build programs by connecting nodes on a canvas instead of writing text — then evaluate them live to see results.

It runs in the browser, with nothing to download, and no log-in required. [milesberry.net/liberator](https://milesberry.net/liberator)

---

## What it does

Liberator lets you construct Haskell expressions visually. Each node represents a value, function, or operation; wires between nodes represent function application and data flow. The evaluator reduces the graph to a result in the same way a Haskell runtime would.

### Node palette

Nodes are organised into categories in the left-hand palette:

| Category | Examples |
|---|---|
| **Values** | Integer, Float, Bool, Char, String, List, λ (lambda) |
| **Arithmetic** | `+` `−` `×` `÷` `mod` `^` `abs` `negate` |
| **Comparison** | `==` `/=` `<` `>` `<=` `>=` |
| **Logic** | `&&` `\|\|` `not` |
| **Lists** | `head` `tail` `x:xs` `length` `reverse` `take` `drop` `cons` `++` `elem` `null` `last` `init` `[1..n]` `sum` `product` `maximum` `minimum` `sort` `zip` |
| **Higher-Order** | `map` `filter` `foldr` `foldl` `zipWith` `flip` `const` `id` `($)` `(.)` |
| **Tuples** | `pair` `fst` `snd` |
| **Strings** | `concat` `show` `words` `unwords` `lines` `unlines` `length` `reverse` `ord` `chr` `strToChars` `charsToStr` |
| **Control** | `if/then/else` `let … in` |
| **Utilities** | `Output` (displays a result) `Apply` (explicit function application) |
| **Modules** | Named function blocks (wrap selected nodes into a reusable module) |
| **List Comprehensions** | `[ f x \| x ← xs, p x ]` desugared to `map`/`filter` |

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift+Z` or `Ctrl+Y` | Redo |
| `Ctrl/Cmd + K` | Quick-add spotlight — type to search and drop any node |
| `Ctrl/Cmd + C` | Copy selected nodes |
| `Ctrl/Cmd + X` | Cut selected nodes |
| `Ctrl/Cmd + V` | Paste nodes |
| `Delete` / `Backspace` | Delete selected nodes |

### Toolbar

| Button | Action |
|---|---|
| **Run** | Evaluate all Output nodes |
| **Reset** | Clear evaluation results |
| **Save** | Download the current graph as a `.json` file |
| **Load** | Load a previously saved `.json` graph file |
| **Export .hs** | Download the graph as a Haskell source file |
| **Examples** | Load a built-in example program |
| **Tidy Up** | Auto-arrange nodes left-to-right (DAG layout, undoable) |
| **Clear** | Remove all nodes from the canvas |
| **`</>`** | Toggle the Haskell code panel |
| **☀ / ☾** | Toggle dark / light theme |
| **?** | Open the Getting Started guide |

### Built-in examples

| # | Name |
|---|------|
| 1 | Simple arithmetic: `3 + 4` |
| 2 | `sum [1..10]` |
| 3 | `map (*2) [1..5]` |
| 4 | `filter even [1..10]` |
| 5 | `foldr (+) 0 [1..10]` |
| 6 | Project Euler #1 — multiples of 3 or 5 |
| 7 | Project Euler #2 — even Fibonacci sum |
| 8 | Project Euler #3 — largest prime factor |
| 9 | Project Euler #5 — smallest multiple of 1–20 |
| 10 | Factorial via named function (`7! = 5040`) |
| 11 | Recursive factorial — `factR 7 = 5040` |
| 12 | `let` binding: `let x = 3 in x * 2 + 1` |
| 13 | Caesar cipher — shift `"hello"` by 3 |
| 14 | Binary search — find 7 in `[1,3,5,7,9,11]` |
| 15 | Quicksort — `qsort [3,1,4,1,5,9,2,6]` |
| 16 | Merge sort — `msort [5,3,8,1,9,2,7,4]` |
| 17 | Bubble sort — `bsort [5,3,8,1,9,2]` |

---

## How it works

### Evaluation

The canvas is a directed acyclic graph (DAG) where nodes are expressions and edges are arguments. When you click **Run**, each `Output` node traces back through its inputs, builds an expression tree (`src/engine/toExprTree.ts`), then reduces it with a small call-by-value interpreter (`src/engine/evaluate.ts`). Built-in Haskell functions are implemented in `src/engine/builtins.ts`.

### Type system

Wires are coloured by the type of value they carry — numbers (orange), booleans (green), strings (yellow), lists (purple), tuples (cyan), functions (blue). Types are tracked structurally through the graph (`src/types/haskell.ts`).

### Modules (named functions)

Select two or more nodes and click **Wrap as Function**. Liberator extracts them into a named module node with auto-generated input/output ports, wiring cross-boundary edges automatically. Double-click a module node to navigate inside it; a breadcrumb trail appears at the top of the canvas.

### Auto-layout (Tidy Up)

Clicking **Tidy Up** applies a longest-path DAG layering algorithm (`src/utils/layout.ts`). Each node is assigned to a column based on the length of the longest dependency chain leading to it; nodes at the same column are spaced evenly and vertically centred. The action is undoable (Ctrl+Z) and works inside module subgraphs.

### State management

- Graph structure (nodes, edges, subgraphs, undo/redo history) — Zustand + Immer (`src/store/graphStore.ts`)
- UI state (selected node, clipboard) — Zustand (`src/store/uiStore.ts`)
- Evaluation results — Zustand (`src/store/evaluationStore.ts`)

Graphs are serialised to plain JSON. **Save** downloads a `.json` file; **Load** reads one back in.

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later (npm is bundled with it)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/milesberry/liberator.git
cd liberator

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. No backend or Haskell installation is needed — everything runs in the browser.

### Other commands

```bash
npm run build     # Production build → dist/
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
```

### Tech stack

| Layer | Library |
|---|---|
| UI framework | React 19 |
| Canvas / graph | [@xyflow/react](https://reactflow.dev) 12 |
| State | [Zustand](https://zustand-demo.pmnd.rs) 5 + [Immer](https://immerjs.github.io/immer/) 11 |
| Styling | [Tailwind CSS](https://tailwindcss.com) 4 |
| Icons | [Lucide React](https://lucide.dev) |
| Build | [Vite](https://vitejs.dev) 7 + TypeScript 5 |

---

## Project structure

```
src/
├── components/
│   ├── canvas/          # LiberatorCanvas, WireEdge, QuickAdd
│   ├── layout/          # AppLayout, Palette, OutputPanel, PropertiesPanel
│   └── toolbar/         # Toolbar
├── engine/
│   ├── builtins.ts      # Built-in Haskell functions (runtime values)
│   ├── evaluate.ts      # Expression tree evaluator
│   └── toExprTree.ts    # Graph → expression tree
├── examples/            # Built-in example programs
├── nodes/               # One component per node type + registry
├── store/               # graphStore, uiStore, evaluationStore
├── types/               # haskell.ts, nodes.ts, edges.ts, values.ts
└── utils/
    ├── idGen.ts          # Unique ID generation
    ├── layout.ts         # DAG auto-layout algorithm
    └── serialise.ts      # Save/load graph JSON
```
