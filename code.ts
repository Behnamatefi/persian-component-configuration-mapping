const persianDigitMap: Record<string, string> = {
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
  return text.replace(/[0-9]/g, (d) => persianDigitMap[d]);
}

function convertNodeDescription(node: SceneNode) {
  if ('description' in node && typeof node.description === 'string') {
    node.description = convertDigitsToPersian(node.description);
  }
}

if (figma.command === 'convert') {
  const selection = figma.currentPage.selection;
  for (const node of selection) {
    convertNodeDescription(node);
  }
  figma.closePlugin(`Converted ${selection.length} items`);
} else {
  figma.closePlugin();
}
