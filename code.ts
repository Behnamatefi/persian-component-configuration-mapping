const PERSIAN_DIGIT_MAP: Record<string, string> = {
  '0': '۰',
  '1': '۱',
  '2': '۲',
  '3': '۳',
  '4': '۴',
  '5': '۵',
  '6': '۶',
  '7': '۷',
  '8': '۸',
  '9': '۹'
};

function convertDigitsToPersian(text: string): string {
  return text.replace(/[0-9]/g, (digit) => PERSIAN_DIGIT_MAP[digit] ?? digit);
}

function isPublishableSceneNode(node: SceneNode): node is SceneNode & PublishableMixin {
  return 'description' in node;
}

function convertNodeDescription(node: SceneNode & PublishableMixin): boolean {
  const currentDescription = node.description ?? '';
  if (currentDescription.length === 0) {
    return false;
  }

  const convertedDescription = convertDigitsToPersian(currentDescription);
  if (convertedDescription === currentDescription) {
    return false;
  }

  node.description = convertedDescription;
  return true;
}

function hasChildren(node: SceneNode): node is SceneNode & { children: readonly SceneNode[] } {
  return 'children' in node;
}

function convertSelectionNode(node: SceneNode): number {
  let updatedNodes = 0;

  if (isPublishableSceneNode(node) && convertNodeDescription(node)) {
    updatedNodes += 1;
  }

  if (hasChildren(node)) {
    for (const child of node.children) {
      updatedNodes += convertSelectionNode(child);
    }
  }

  return updatedNodes;
}

function convertSelection(selection: readonly SceneNode[]): number {
  let updatedNodes = 0;
  for (const node of selection) {
    updatedNodes += convertSelectionNode(node);
  }
  return updatedNodes;
}

if (figma.command === 'convert') {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.closePlugin('Select at least one component to convert.');
  } else {
    const updatedCount = convertSelection(selection);
    const suffix = updatedCount === 1 ? '' : 's';
    const message =
      updatedCount === 0
        ? 'No component descriptions needed conversion.'
        : `Converted descriptions on ${updatedCount} node${suffix}.`;
    figma.closePlugin(message);
  }
} else {
  figma.closePlugin();
}
