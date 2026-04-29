// ─────────────────────────────────────────────────────────────────────────────
// TDS – Persian Component Configuration Mapping
// Converts English digits (0–9) to Persian digits (۰–۹) in component
// descriptions. Only targets ComponentNode and ComponentSetNode — never
// InstanceNode, because an instance shares its `description` field with its
// master component. Writing to an instance's description would silently mutate
// the master and update every other instance of that component in the file.
// ─────────────────────────────────────────────────────────────────────────────

const PERSIAN_DIGIT_MAP: Record<string, string> = {
  '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
  '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹',
};

const EN_DIGIT_PATTERN = /[0-9]/g;

/** Replace every ASCII digit in `text` with its Persian equivalent. */
function toPersianDigits(text: string): string {
  return text.replace(EN_DIGIT_PATTERN, (d) => PERSIAN_DIGIT_MAP[d]);
}

/**
 * Returns true if the node is a directly editable component definition.
 * InstanceNode is intentionally excluded — see file-level comment above.
 */
function isEditableComponent(node: SceneNode): node is ComponentNode | ComponentSetNode {
  return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
}

/**
 * Recursively walks the subtree rooted at `node` and collects all
 * ComponentNode / ComponentSetNode descendants into `results`.
 *
 * Traversal rules:
 *  - COMPONENT_SET  → collect, then stop (its children are variant Components
 *                     whose descriptions are separate from the set description;
 *                     users can select variants individually if needed).
 *  - COMPONENT      → collect, then recurse (nested components are valid).
 *  - INSTANCE       → skip entirely — do NOT recurse, because Figma resolves
 *                     the instance's children through the master, and any
 *                     component found inside would be the master itself.
 *  - Everything else (FRAME, GROUP, SECTION …) → recurse.
 */
function collectComponents(
  node: SceneNode,
  results: Array<ComponentNode | ComponentSetNode>,
): void {
  if (node.type === 'INSTANCE') {
    // Bug root cause: never touch instances. Skip the whole subtree.
    return;
  }

  if (isEditableComponent(node)) {
    results.push(node);
    // Always stop after collecting a component — never recurse into its
    // internals. For COMPONENT_SET this prevents descending into variants;
    // for COMPONENT this prevents descending into nested component definitions,
    // which was the cause of "all components on the page get processed" when
    // one component happened to contain others as children.
    return;
  }

  // Only non-component containers (FRAME, GROUP, SECTION, etc.) reach here.
  if ('children' in node) {
    for (const child of node.children) {
      collectComponents(child, results);
    }
  }
}

/**
 * Converts English digits in `node.description` to Persian digits.
 * Returns true if the description was actually changed, false if it was
 * already clean (no English digits present).
 */
function convertDescription(node: ComponentNode | ComponentSetNode): boolean {
  const original = node.description;
  if (!original || !EN_DIGIT_PATTERN.test(original)) {
    EN_DIGIT_PATTERN.lastIndex = 0; // reset stateful regex after .test()
    return false;
  }
  EN_DIGIT_PATTERN.lastIndex = 0;
  node.description = toPersianDigits(original);
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
        // 3. Convert and count only nodes that actually had English digits.
        let converted = 0;
        for (const component of unique) {
          if (convertDescription(component)) {
            converted++;
          }
        }

        const total = unique.length;
        if (converted === 0) {
          figma.closePlugin(
            `Checked ${total} component${total === 1 ? '' : 's'} — no English digits found.`,
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
