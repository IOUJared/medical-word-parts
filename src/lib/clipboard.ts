export function writeClipboard(target: Window, text: string): Promise<boolean> {
  const clipboard = target.navigator.clipboard;
  if (clipboard === undefined) return Promise.resolve(false);
  return clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

export function focusAndSelectText(target: Window, element: HTMLElement): void {
  element.focus();
  const selection = target.getSelection();
  if (selection === null) return;
  const range = target.document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}
