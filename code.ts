// ─────────────────────────────────────────────────────────────────────────────
// TDS – Persian Component Configuration Mapping
//
// Purpose: transliterate Latin characters in component descriptions to their
// Persian equivalents based on the standard Persian (ISIRI 9147) keyboard
// layout. Designers who accidentally type with the wrong keyboard layout end
// up with Latin characters that look like gibberish — this plugin converts
// them back to the intended Persian text.
//
// Example:
//   "Google"      →  "لخخلمث"
//   "Saraf gift"  →  "سشقشب لهبف"
//
// Only ComponentNode and ComponentSetNode are processed — never InstanceNode,
// because an instance shares its `description` with its master component and
// writing to it would silently mutate the master and affect every instance of
// that component across the file.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard Persian keyboard layout — QWERTY key → Persian character.
 * Uppercase and lowercase Latin letters map to the same Persian character
 * (Persian script has no case distinction).
 * Digits map to their Persian-Indic equivalents.
 */
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

/** Matches any Latin letter or ASCII digit — the characters we can translate. */
const LATIN_PATTERN = /[a-zA-Z0-9]/g;

/** Returns true if the text contains at least one translatable character. */
function hasLatinChars(text: string): boolean {
  const result = LATIN_PATTERN.test(text);
  LATIN_PATTERN.lastIndex = 0; // reset stateful /g regex after .test()
  return result;
}

/** Replace every Latin letter and ASCII digit with its Persian equivalent. */
function transliterate(text: string): string {
  const result = text.replace(LATIN_PATTERN, (ch) => LATIN_TO_PERSIAN[ch] ?? ch);
  LATIN_PATTERN.lastIndex = 0;
  return result;
}

/**
 * Returns true if the node is a directly editable component definition.
 * InstanceNode is intentionally excluded — see file-level comment.
 */
function isEditableComponent(node: SceneNode): node is ComponentNode | ComponentSetNode {
  return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
}

/**
 * Recursively walks the subtree rooted at `node` and collects all
 * ComponentNode / ComponentSetNode descendants into `results`.
 *
 * Traversal rules:
 *  - COMPONENT / COMPONENT_SET → collect, then STOP. Never recurse into a
 *    component's internals: prevents the "all components on page get
 *    processed" bug that occurs when a component contains nested component
 *    definitions as children.
 *  - INSTANCE  → skip entirely, do not recurse (children resolve through
 *    the master and modifying them would affect the master component).
 *  - Everything else (FRAME, GROUP, SECTION …) → recurse.
 */
function collectComponents(
  node: SceneNode,
  results: Array<ComponentNode | ComponentSetNode>,
): void {
  if (node.type === 'INSTANCE') return;

  if (isEditableComponent(node)) {
    results.push(node);
    return; // never recurse into component internals
  }

  if ('children' in node) {
    for (const child of node.children) {
      collectComponents(child, results);
    }
  }
}

/**
 * Transliterates Latin characters in `node.description` to Persian.
 * Returns true if the description was actually changed.
 */
function convertDescription(node: ComponentNode | ComponentSetNode): boolean {
  const original = node.description;
  if (!original || !hasLatinChars(original)) return false;
  node.description = transliterate(original);
  return true;
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
      // 1. Collect all editable component nodes from the selection tree.
      const found: Array<ComponentNode | ComponentSetNode> = [];
      for (const node of selection) {
        collectComponents(node, found);
      }

      // 2. Deduplicate by node ID (handles overlapping selections, e.g. a
      //    frame selected alongside one of its child components).
      const unique = [...new Map(found.map((n) => [n.id, n])).values()];

      if (unique.length === 0) {
        figma.closePlugin(
          'No editable components found in selection. ' +
          'Select a Component or Component Set (not an instance).',
        );
      } else {
        // 3. Transliterate and count only nodes that actually changed.
        let converted = 0;
        for (const component of unique) {
          if (convertDescription(component)) converted++;
        }

        const total = unique.length;
        if (converted === 0) {
          figma.closePlugin(
            `Checked ${total} component${total === 1 ? '' : 's'} — no Latin characters found.`,
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
