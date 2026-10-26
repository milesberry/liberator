// ─── Plain-English node summaries ──────────────────────────────────────────
// One short sentence per node, for the palette and canvas tooltips and the
// Properties panel. The registry's `description` holds the Haskell type
// signature; this says what the node does. docs/node-reference.md is the
// longer version, so keep the two in step.

import type { LibNodeData } from '../types/nodes';

const SUMMARIES: Record<string, string> = {
  // Values
  'value:Int':    'A whole number, such as 42 or -7.',
  'value:Float':  'A number with a decimal point, such as 3.14.',
  'value:Bool':   'True or False.',
  'value:String': 'Some text, written in quotes, such as "hello".',
  'value:List':   'A list of values of the same type, such as [1,2,3]. [] is the empty list.',

  // Arithmetic
  'primop:+':      'Adds two numbers.',
  'primop:-':      'Subtracts y from x.',
  'primop:*':      'Multiplies two numbers.',
  'primop:/':      'Divides x by y, giving a decimal answer: 7 / 2 is 3.5.',
  'primop:div':    'Whole-number division, rounding down: 7 `div` 2 is 3.',
  'primop:mod':    'The remainder after whole-number division: 7 `mod` 2 is 1.',
  'primop:negate': 'Changes the sign of a number: 5 becomes -5.',
  'primop:abs':    'The size of a number, ignoring its sign: -5 becomes 5.',

  // Comparison
  'primop:==': 'True if x and y are equal.',
  'primop:/=': 'True if x and y are not equal.',
  'primop:<':  'True if x is less than y.',
  'primop:>':  'True if x is greater than y.',
  'primop:<=': 'True if x is less than or equal to y.',
  'primop:>=': 'True if x is greater than or equal to y.',

  // Logic
  'primop:&&':  'True only if both inputs are True.',
  'primop:||':  'True if either input is True.',
  'primop:not': 'Swaps True and False.',

  // Lists
  'listop:head':    'The first item of a list. An empty list is an error.',
  'listop:tail':    'The list without its first item.',
  'listop:cons':    'Puts an item on the front of a list: 1 : [2,3] is [1,2,3].',
  'listop:uncons':  'Splits a list into its first item (head) and the rest (tail).',
  'listop:null':    'True if the list is empty.',
  'listop:length':  'How many items are in a list.',
  'listop:++':      'Joins two lists: [1,2] ++ [3] is [1,2,3].',
  'listop:snoc':    'Adds an item to the end of a list: [1,2] ++ [3] is [1,2,3].',
  'listop:reverse': 'The list in reverse order.',
  'listop:take':    'The first n items of a list.',
  'listop:drop':    'The list without its first n items.',
  'listop:elem':    'True if x is somewhere in the list.',
  'listop:last':    'The last item of a list. An empty list is an error.',
  'listop:init':    'The list without its last item.',
  'matchlist':      'Chooses what to return for an empty list and for a list with a head and tail.',

  // Higher-order
  'hof:map':     'Applies a function to every item in a list.',
  'hof:filter':  'Keeps only the items for which the test p gives True.',
  'hof:foldr':   'Combines a list into one value, working from the right, starting from z.',
  'hof:foldl':   'Combines a list into one value, working from the left, starting from z.',
  'hof:zipWith': 'Combines two lists item by item using a function.',

  // Utilities
  'listop:sum':     'Adds up all the numbers in a list.',
  'listop:product': 'Multiplies together all the numbers in a list.',
  'listop:maximum': 'The largest item in a list.',
  'listop:minimum': 'The smallest item in a list.',
  'listop:range':   'The list of whole numbers from 1 to n: [1..n].',
  'listop:zip':     'Pairs up two lists item by item: [(x1,y1), (x2,y2), …].',
  'comment':        'A note for the reader. It does nothing when the program runs.',

  // Tuples
  'hof:pair': 'Makes a pair (x, y) from two values.',
  'hof:fst':  'The first value of a pair.',
  'hof:snd':  'The second value of a pair.',

  // Strings
  'hof:show':       'Turns any value into text: 42 becomes "42".',
  'hof:strConcat':  'Joins two strings: "ab" ++ "cd" is "abcd".',
  'hof:concat':     'Joins a list of strings into one string.',
  'hof:words':      'Splits a string into words at the spaces.',
  'hof:unwords':    'Joins a list of words into one string, with spaces between.',
  'hof:lines':      'Splits a string into lines at the line breaks.',
  'hof:unlines':    'Joins a list of lines into one string, with line breaks between.',
  'hof:strLength':  'How many characters are in a string.',
  'hof:strReverse': 'The string backwards.',
  'hof:ord':        'The character code of the first character: "A" gives 65.',
  'hof:chr':        'The character with a given code: 65 gives "A".',
  'hof:strToChars': 'Turns a string into a list of character codes.',
  'hof:charsToStr': 'Turns a list of character codes back into a string.',

  // Control
  'listcomp': 'Builds a new list from xs: applies f to each item, keeping only those that pass p.',
  'lambda':   'Makes a function without a name: x is the input, and the body is the answer.',
  'if':       'Gives the "then" value if the condition is True, otherwise the "else" value.',
  'apply':    'Applies the function f to the value x.',
  'let':      'Gives a value a name, x, to use inside an expression.',

  // Output and Functions
  'output': 'Shows the value wired into it when you click Run.',
  'call':   'Uses one of your named Functions. Choose it by name.',
  'module': 'A named Function you have made. Double-click to see or change what it does.',
  'param':  'One of this Function\'s inputs. Type in the box to rename it.',
  'functionOutput': 'The answer this Function gives back.',
};

// The summary for a node's data: parameters and function outputs are
// recognised by their anchor marker, as everywhere else
export function nodeSummary(data: LibNodeData): string | undefined {
  const d = data as { kind: string; op?: string; valueType?: string; _modulePortId?: string; targetName?: string };
  if (d._modulePortId) return SUMMARIES[d.kind === 'value' ? 'param' : 'functionOutput'];
  if (d.kind === 'call' && d.targetName) return `Uses your Function ${d.targetName}. Double-click to open its definition.`;
  return SUMMARIES[`${d.kind}:${d.op ?? d.valueType ?? ''}`] ?? SUMMARIES[d.kind];
}

// The summary for a palette entry (kind plus its subtype, if any)
export function definitionSummary(kind: string, subtype?: string): string | undefined {
  return SUMMARIES[subtype ? `${kind}:${subtype}` : kind] ?? SUMMARIES[kind];
}
