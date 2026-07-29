export const themeStorageKey = "medical-word-parts:theme";

export type Theme = "light" | "dark";

export function parseTheme(value: string | null): Theme | undefined {
  switch (value) {
    case "light":
    case "dark":
      return value;
    default:
      return undefined;
  }
}

function storedTheme(target: Window): Theme | undefined {
  try {
    return parseTheme(target.localStorage.getItem(themeStorageKey));
  } catch (error) {
    if (error instanceof DOMException) return undefined;
    throw error;
  }
}

function persistTheme(target: Window, theme: Theme): void {
  try {
    target.localStorage.setItem(themeStorageKey, theme);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}

function applyExplicitTheme(target: Window, theme: Theme | undefined): void {
  if (theme === undefined) target.document.documentElement.removeAttribute("data-theme");
  else target.document.documentElement.dataset["theme"] = theme;
}

export function applyThemeBootstrap(target: Window): void {
  applyExplicitTheme(target, storedTheme(target));
}

export function enhanceTheme(target: Window): () => void {
  const button = target.document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (button === null) return () => undefined;
  const preference = target.matchMedia("(prefers-color-scheme: dark)");
  let explicit = storedTheme(target);
  applyExplicitTheme(target, explicit);

  const synchronize = () => {
    const effective = explicit ?? (preference.matches ? "dark" : "light");
    button.setAttribute("aria-pressed", String(effective === "dark"));
  };
  const handlePreference = () => {
    if (explicit === undefined) synchronize();
  };
  const handleClick = () => {
    const effective = explicit ?? (preference.matches ? "dark" : "light");
    explicit = effective === "dark" ? "light" : "dark";
    applyExplicitTheme(target, explicit);
    persistTheme(target, explicit);
    synchronize();
  };

  preference.addEventListener("change", handlePreference);
  button.addEventListener("click", handleClick);
  synchronize();
  button.removeAttribute("inert");
  return () => {
    preference.removeEventListener("change", handlePreference);
    button.removeEventListener("click", handleClick);
  };
}
