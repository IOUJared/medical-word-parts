export type ElementOptions = {
  readonly className?: string;
  readonly text?: string;
};

export function createElement<Tag extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: Tag,
  options: ElementOptions = {},
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag);
  if (options.className !== undefined) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  return element;
}
