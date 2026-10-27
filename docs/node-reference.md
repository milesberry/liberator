# Node reference

This page explains every node in Liberator's palette: what it does, an example, and the Haskell it stands for. You'll see the same one-line summaries when you hover over a node, in the palette or on the canvas, and in the **Properties** panel when you select a node.

New to Liberator? Start with the [Getting Started guide](getting-started.md).

---

## Reading a node

- **Inputs** are on the left of a node and **outputs** are on the right. Values flow along the wires from left to right.
- **Wire colours show what kind of value a wire carries.**

  | Colour | Type |
  |---|---|
  | blue | whole number (`Int`) |
  | light blue | decimal number (`Float`) |
  | green | `True` or `False` (`Bool`) |
  | yellow | text (`String`) |
  | purple | list |
  | cyan | pair (tuple) |
  | orange, and thicker | function |
  | grey | not known yet |
  | red | doesn't fit: hover over the label or select the wire to see why |

- **Leave an input empty to get a function.** For example, Add (+) with only `y = 1` connected is the function `\x -> x + 1`, "add one to something". You can then wire it into `map`, `filter` or a fold. This is called *partial application*, and it works for every node with inputs, including your own Functions.
- **Nothing runs until you click Run.** Each **Output** node then shows the value wired into it, and you can **hover over any wire to see the value it carries**, or click the wire to keep the value showing. Inside a Function, wires that depend on its inputs say *varies*.

---

## Values

Type the value into the box on the node.

| Node | What it does | Example |
|---|---|---|
| **Integer** | A whole number. A decimal such as `2.5` makes the box turn red: use a Float for that. | `42`, `-7` |
| **Float** | A number with a decimal point. | `3.14`, `0.5` |
| **Bool** | One of the two truth values. | `True`, `False` |
| **String** | Some text, in double quotes. | `"hello"` |
| **List** | Several values of the same type, in square brackets and separated by commas. `[]` is the empty list. | `[1,2,3]`, `[True,False]`, `["a","b"]` |

## Output

| Node | What it does |
|---|---|
| **Output** | Shows the value wired into it when you click **Run**. A graph can have several. |

## Arithmetic

| Node | What it does | Example |
|---|---|---|
| **Add (+)** | Adds two numbers. | `3 + 4` is `7` |
| **Subtract (-)** | Takes y away from x. | `10 - 3` is `7` |
| **Multiply (\*)** | Multiplies two numbers. | `6 * 7` is `42` |
| **Divide (/)** | Divides x by y. The answer is always a decimal. | `7 / 2` is `3.5` |
| **Div (÷)** | Whole-number division, rounding down. | ``7 `div` 2`` is `3` |
| **Mod (%)** | The remainder after whole-number division. | ``7 `mod` 2`` is `1` |
| **Negate** | Changes the sign. | `negate 5` is `-5` |
| **Abs** | The size of a number, ignoring its sign. | `abs (-5)` is `5` |

**Tip:** `div` and `mod` are useful for working with digits and for testing divisibility: ``n `mod` 3 == 0`` is True when n is a multiple of 3.

## Comparison

Each comparison gives `True` or `False`.

| Node | True when… | Example |
|---|---|---|
| **Equal (==)** | x and y are equal. | `3 == 3` is `True` |
| **Not Equal (/=)** | x and y are different. | `3 /= 4` is `True` |
| **Less Than (<)** | x is smaller than y. | `2 < 5` is `True` |
| **Greater Than (>)** | x is bigger than y. | `2 > 5` is `False` |
| **Less or Equal (<=)** | x is smaller than or equal to y. | `5 <= 5` is `True` |
| **Greater or Equal (>=)** | x is bigger than or equal to y. | `4 >= 5` is `False` |

**Tip:** to make a test for `filter`, leave **x** empty and wire a value into **y**. Greater Than with `y = 3` is `\x -> x > 3`, "is it bigger than 3?".

## Logic

| Node | What it does | Example |
|---|---|---|
| **And (&&)** | True only if both inputs are True. | `True && False` is `False` |
| **Or (\|\|)** | True if either input is True. | `True \|\| False` is `True` |
| **Not** | Swaps True and False. | `not True` is `False` |

## Control

| Node | What it does | Haskell |
|---|---|---|
| **If / Then / Else** | Gives the **then** value if the **if** input is True, otherwise the **else** value. Both branches must have the same type. | `if c then a else b` |
| **case [ ] of** | Chooses between two answers: one for an empty list (**[]**), and one for a list with a first item and the rest (**x:xs**). Use the **head** and **tail** outputs when building the **x:xs** answer. This is the usual shape of a recursive function on lists. | `case xs of [] -> …; (x:xs') -> …` |
| **Lambda (λ)** | Makes a function without a name. The **x →** output stands for the input. Build the answer from it and wire that into **→ result**. The **λ** output is the finished function. | `\x -> …` |
| **Apply ($)** | Applies the function **f** to the value **x**. | `f $ x` |
| **Let (local variable)** | Gives a value a name to use inside an expression. Wire the value into **= value**, use the **x →** output where you need it, and wire the finished expression into **in →**. | `let x = … in …` |
| **List Comprehension** | Builds a new list from **xs**. It applies **f** to each item, keeping only the items that pass the test **p**. The test is optional. | `[f x \| x <- xs, p x]` |

## Lists

| Node | What it does | Example |
|---|---|---|
| **head** | The first item. An empty list gives an error. | `head [3,1,2]` is `3` |
| **tail** | Everything except the first item. | `tail [3,1,2]` is `[1,2]` |
| **x:xs (uncons)** | Splits a list into its **head** and **tail** in one node. | `[3,1,2]` gives `3` and `[1,2]` |
| **cons (:)** | Puts an item on the front of a list. | `1 : [2,3]` is `[1,2,3]` |
| **append item (xs ++ [x])** | Adds an item to the end of a list. | `[1,2] ++ [3]` is `[1,2,3]` |
| **append (++)** | Joins two lists. | `[1,2] ++ [3,4]` is `[1,2,3,4]` |
| **null (isEmpty)** | True if the list is empty. | `null []` is `True` |
| **length** | How many items there are. | `length [3,1,2]` is `3` |
| **reverse** | The items in reverse order. | `reverse [1,2,3]` is `[3,2,1]` |
| **take** | The first **n** items. | `take 2 [5,6,7]` is `[5,6]` |
| **drop** | Everything after the first **n** items. | `drop 2 [5,6,7]` is `[7]` |
| **elem** | True if **x** is in the list. | `elem 3 [1,2,3]` is `True` |
| **last** | The last item. An empty list gives an error. | `last [3,1,2]` is `2` |
| **init** | Everything except the last item. | `init [3,1,2]` is `[3,1]` |

**Prepend or append?** `cons` adds to the front in a single step. Append item has to walk along the whole list to reach the end, so for long lists it's slower. That's why Haskell programs often build a list with `:` and reverse it at the end.

## Higher-order functions

These nodes take a **function** as an input (orange wire). Make one by leaving an input empty on another node, or use a Lambda or one of your own Functions.

| Node | What it does | Example |
|---|---|---|
| **map** | Applies **f** to every item. | `map (*2) [1,2,3]` is `[2,4,6]` |
| **filter** | Keeps the items for which the test **p** is True. | `filter (> 3) [1..6]` is `[4,5,6]` |
| **foldr** | Combines the items into one value, starting from **z** and working from the right. | `foldr (+) 0 [1,2,3]` is `1 + (2 + (3 + 0))`, which is `6` |
| **foldl** | The same, but working from the left. | `foldl (-) 10 [1,2]` is `(10 - 1) - 2`, which is `7` |
| **zipWith** | Combines two lists item by item using **f**. | `zipWith (+) [1,2] [10,20]` is `[11,22]` |

**foldr or foldl?** For `+` and `*` the answer is the same either way. For `-`, or for building a list, the order matters.

## Utilities

| Node | What it does | Example |
|---|---|---|
| **sum** | Adds up a list of numbers. | `sum [1,2,3]` is `6` |
| **product** | Multiplies a list of numbers together. | `product [1,2,3,4]` is `24` |
| **maximum** | The largest item. | `maximum [3,9,2]` is `9` |
| **minimum** | The smallest item. | `minimum [3,9,2]` is `2` |
| **range [1..n]** | The whole numbers from 1 to **n**. | `range 5` is `[1,2,3,4,5]` |
| **zip** | Pairs up two lists item by item. | `zip [1,2] ["a","b"]` is `[(1,"a"),(2,"b")]` |
| **Comment** | A note for whoever reads the program. It doesn't affect the result, and it appears as a `--` comment in the exported Haskell. | |

## Tuples

| Node | What it does | Example |
|---|---|---|
| **pair** | Makes a pair from two values. | `(3, "three")` |
| **fst** | The first value of a pair. | `fst (3, "three")` is `3` |
| **snd** | The second value of a pair. | `snd (3, "three")` is `"three"` |

## Strings

In Haskell a `String` is a list of characters. Liberator keeps text as its own type, so text has its own nodes for length and reverse. It has no separate character type either: a single character is a one-character string, such as `"A"`.

| Node | What it does | Example |
|---|---|---|
| **show** | Turns any value into text. | `show 42` is `"42"` |
| **strConcat (++)** | Joins two strings. | `"ab" ++ "cd"` is `"abcd"` |
| **concat** | Joins a list of strings. | `concat ["ab","cd"]` is `"abcd"` |
| **words** | Splits text into words at the spaces. | `words "to be"` is `["to","be"]` |
| **unwords** | Joins words with spaces between. | `unwords ["to","be"]` is `"to be"` |
| **lines** | Splits text at the line breaks. | |
| **unlines** | Joins lines with line breaks between. | |
| **strLength** | How many characters there are. | `strLength "hello"` is `5` |
| **strReverse** | The text backwards. | `strReverse "abc"` is `"cba"` |
| **ord** | The character code of the first character. | `ord "A"` is `65` |
| **chr** | The character with a given code. | `chr 65` is `"A"` |
| **strToChars** | Turns text into a list of character codes. | `strToChars "Hi"` is `[72,105]` |
| **charsToStr** | Turns a list of codes back into text. | `charsToStr [72,105]` is `"Hi"` |

**Tip:** `strToChars`, then `map`, then `charsToStr` is the pattern behind the Caesar cipher example.

---

## Functions

| Node | What it does |
|---|---|
| **Function** | A named function you've made, by selecting nodes and clicking **Make a Function**. Double-click it to go inside, and use the breadcrumb at the top to come back out. **Unwrap this Function**, in Properties, puts its nodes back on the canvas: the opposite of Make a Function. It's only possible while nothing else calls the Function (so not for a recursive one). |
| **Parameter** (teal, inside a Function) | One of the Function's inputs. Type in its box to rename it. Duplicate names are numbered automatically (`x`, `x2`, …). Parameters are numbered top to bottom, and that's the order the Function takes them in: drag one up or down, or use the ↑/↓ buttons in Properties, to change it. Click **+ Parameter** at the top of the canvas to add another. |
| **Call Function** | Uses one of your Functions by name. This is how a Function uses itself (recursion), or how you use a Function again somewhere else. Drag the Function from **My Functions** at the top of the palette, or type its name into a Call Function node. Once it knows which Function to use, it looks just like that Function's own block (with a small call icon), and double-clicking it opens the Function's definition. To switch it to a different Function, use the **Function** box in Properties. Renaming a Function renames its Calls too. **Unwrap this Call**, in Properties, replaces the Call with a copy of the Function's body, with the Call's inputs wired in where the parameters were. This is substitution, the step a Haskell programmer takes when they work out `isEven 13` by hand as ``13 `mod` 2 == 0``. Every input needs to be wired first. Unwrapping the Call inside a recursive Function unfolds the recursion one step, and the copy contains its own Call, so you can keep going. Inside a Function, click **Apply** in the breadcrumb to update its Call nodes after you add or rename parameters. Apply also turns any input left empty inside the Function into a new parameter. |

---

## Where Liberator differs from Haskell

Liberator's nodes are meant to match Haskell closely, and **Export .hs** produces a program that runs in GHCi. A few nodes are conveniences that aren't in Haskell's standard Prelude:

| Node | In Haskell you'd write | Export |
|---|---|---|
| **range [1..n]** | `[1..n]` | a helper, `range n = [1..n]` |
| **append item** | `xs ++ [x]` | exactly that |
| **pair** | `(x, y)` | a helper, `pair x y = (x, y)` |
| **strConcat**, **strLength**, **strReverse** | `++`, `length`, `reverse` | helpers defined with those |
| **ord**, **chr** | `ord 'A'`, `chr 65`, which work on a single character | helpers `strOrd` and `strChr`, which work on one-character strings |
| **strToChars**, **charsToStr** | `map ord s`, `map chr ns` | helpers defined with those |

The helpers appear at the top of the exported file, so it runs unchanged.

**Recursion has limits.** To stop a runaway program freezing the browser, Liberator gives up after 50,000 steps and shows **⊥** ("bottom", the symbol for a computation that never finishes). A recursive call that is the very *last* thing a function does, as in `lpf n d = … else lpf n (d + 1)`, can run thousands of times. One whose result still has work waiting on it, as in `n * fact (n - 1)`, uses more room for each call, so `fact 3000` hits the limit even though it would finish eventually. That difference, called tail recursion, is worth discussing with students.

Liberator also checks types more loosely than Haskell. It doesn't yet know that `+` needs numbers, so some mistakes only show up when you click **Run**, not as a red wire.
