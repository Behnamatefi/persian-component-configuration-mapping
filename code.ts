// ─────────────────────────────────────────────────────────────────────────────
// TDS – Persian Component Configuration Mapping
//
// Algorithm (runs on each selected ComponentNode / ComponentSetNode):
//
//  Step 1 — Strip existing Persian lines from description.
//           Any line that contains Persian/Arabic script characters AND no
//           Latin characters is removed. These are always previous plugin
//           output — a clean slate before re-inserting.
//
//  Step 2 — Find every line in the description that starts with "alt name:"
//           (dot after "alt" is optional; matching is case-insensitive).
//
//  Step 3 — Transliterate the value after "alt name:" using the standard
//           Persian keyboard layout (ISIRI 9147) and insert the result on
//           the line immediately below the "alt name:" line.
//
//  Step 4 — Transliterate the component's name field to Persian.
//
//  Step 5 — Every other line in the description is left completely unchanged.
//
// Example
// ───────
//   Before:  alt name: Card, Gift          After:  alt name: Card, Gift
//            رنگ: color-primary-500                زشقی, لهبف
//                                                  رنگ: color-primary-500
//   Name:    Card                          Name:   زشقی
//
// Instance safety: InstanceNode is never processed — its description and
// name are shared with the master component; writing to them would silently
// mutate the master and affect every instance in the file.
// ─────────────────────────────────────────────────────────────────────────────

/** Standard Persian keyboard layout — QWERTY key → Persian character. */
const LATIN_TO_PERSIAN: Record<string, string> = {
  // ── Row 1 ──────────────────────────────────────────────────────────────────
  'q': 'ض', 'w': 'ص', 'e': 'ث', 'r': 'ق', 't': 'ف',
  'y': 'غ', 'u': 'ع', 'i': 'ه', 'o': 'خ', 'p': 'ح',
  // ── Row 2 ──────────────────────────────────────────────────────────────────
  'a': 'ش', 's': 'س', 'd': 'ی', 'f': 'ب', 'g': 'ل',
  'h': 'ا', 'j': 'ت', 'k': 'ن', 'l': 'م',
  // ── Row 3 ──────────────────────────────────────────────────────────────────
  'z': 'ظ', 'x': 'ط', 'c': 'ز', 'v': 'ر', 'b': 'ذ',
  'n': 'د', 'm': 'پ',
  // ── Uppercase (same Persian output — Persian has no case) ──────────────────
  'Q': 'ض', 'W': 'ص', 'E': 'ث', 'R': 'ق', 'T': 'ف',
  'Y': 'غ', 'U': 'ع', 'I': 'ه', 'O': 'خ', 'P': 'ح',
  'A': 'ش', 'S': 'س', 'D': 'ی', 'F': 'ب', 'G': 'ل',
  'H': 'ا', 'J': 'ت', 'K': 'ن', 'L': 'م',
  'Z': 'ظ', 'X': 'ط', 'C': 'ز', 'V': 'ر', 'B': 'ذ',
  'N': 'د', 'M': 'پ',
  // ── Digits → Persian-Indic ─────────────────────────────────────────────────
  '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
  '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹',
};

/** Matches Latin letters and ASCII digits — the characters we can translate. */
const LATIN_PATTERN = /[a-zA-Z0-9]/g;

/** Matches Persian / Arabic script characters (U+0600–U+06FF). */
const PERSIAN_SCRIPT = /[؀-ۿ]/;

/**
 * Matches an "alt name:" or "alt. name:" line and captures the value.
 * Dot after "alt" is optional. Case-insensitive.
 */
const ALT_NAME_LINE = /^alt\.? name:\s*(.+)$/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasLatinChars(text: string): boolean {
  const result = LATIN_PATTERN.test(text);
  LATIN_PATTERN.lastIndex = 0; // reset stateful /g regex after .test()
  return result;
}

function hasPersianChars(text: string): boolean {
  return PERSIAN_SCRIPT.test(text);
}

/** Replace every Latin letter / ASCII digit with its Persian keyboard equivalent. */
function transliterate(text: string): string {
  const result = text.replace(LATIN_PATTERN, (ch) => LATIN_TO_PERSIAN[ch] ?? ch);
  LATIN_PATTERN.lastIndex = 0;
  return result;
}

// ─── Description processing ───────────────────────────────────────────────────

/**
 * Step 1 — Remove every line that:
 *   - is non-empty, AND
 *   - contains at least one Persian/Arabic character, AND
 *   - contains no Latin characters.
 * These lines are always previous plugin output. Everything else is kept.
 */
function stripPersianLines(description: string): string {
  return description
    .split('\n')
    .filter((line) => !(hasPersianChars(line) && !hasLatinChars(line) && line.trim() !== ''))
    .join('\n');
}

/**
 * Steps 2–3 — Walk the (already-stripped) lines. For every "alt name:" line,
 * push the line as-is then push the transliteration immediately below it.
 * All other lines are pushed unchanged (Step 5).
 */
function insertTransliterations(description: string): string {
  const lines = description.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    result.push(line);
    const match = line.match(ALT_NAME_LINE);
    if (match) {
      result.push(transliterate(match[1].trim()));
    }
  }

  return result.join('\n');
}

/** Runs Step 1 then Steps 2–3 on a description string. */
function processDescription(description: string): string {
  return insertTransliterations(stripPersianLines(description));
}

// ─── Node processing ──────────────────────────────────────────────────────────

function isEditableComponent(node: SceneNode): node is ComponentNode | ComponentSetNode {
  return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
}

/**
 * Recursively walks the subtree and collects ComponentNode / ComponentSetNode.
 *
 * - COMPONENT / COMPONENT_SET → collect, stop (never recurse into internals).
 * - INSTANCE                  → skip entirely; do not recurse.
 * - FRAME, GROUP, SECTION …   → recurse to find nested components.
 */
function collectComponents(
  node: SceneNode,
  results: Array<ComponentNode | ComponentSetNode>,
): void {
  if (node.type === 'INSTANCE') return;

  if (isEditableComponent(node)) {
    results.push(node);
    return;
  }

  if ('children' in node) {
    for (const child of node.children) {
      collectComponents(child, results);
    }
  }
}

/**
 * Applies all five steps to a single component node.
 * Returns true if either name or description actually changed.
 */
function convertNode(node: ComponentNode | ComponentSetNode): boolean {
  let changed = false;

  // Step 4 — Transliterate the component name.
  const newName = transliterate(node.name);
  if (newName !== node.name) {
    node.name = newName;
    changed = true;
  }

  // Steps 1–3, 5 — Process the description.
  const newDescription = processDescription(node.description);
  if (newDescription !== node.description) {
    node.description = newDescription;
    changed = true;
  }

  return changed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

if (figma.command === 'convert') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.closePlugin('Nothing selected — please select one or more components first.');
  } else {
    try {
      // Collect editable component nodes from the selection tree.
      const found: Array<ComponentNode | ComponentSetNode> = [];
      for (const node of selection) {
        collectComponents(node, found);
      }

      // Deduplicate by node ID (handles overlapping selections).
      const unique = [...new Map(found.map((n) => [n.id, n])).values()];

      if (unique.length === 0) {
        figma.closePlugin(
          'No editable components found in selection. ' +
          'Select a Component or Component Set (not an instance).',
        );
      } else {
        let converted = 0;
        for (const component of unique) {
          if (convertNode(component)) converted++;
        }

        const total = unique.length;
        if (converted === 0) {
          figma.closePlugin(
            `Checked ${total} component${total === 1 ? '' : 's'} — nothing to convert.`,
          );
        } else {
          figma.closePlugin(
            `Converted ${converted} of ${total} component${total === 1 ? '' : 's'}.`,
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      figma.closePlugin(`Error: ${message}`);
    }
  }
} else {
  figma.closePlugin();
}
