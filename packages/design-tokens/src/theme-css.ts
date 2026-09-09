import { tokens, type Tokens } from "./tokens";

type NestedStrings = { [key: string]: string | NestedStrings };

/** Converts camelCase or `DEFAULT` keys into Tailwind-style variable segments. */
function segment(key: string): string | null {
  if (key === "DEFAULT") {
    return null;
  }
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function variableName(...parts: string[]): string {
  return `--${parts
    .map(segment)
    .filter((part): part is string => part !== null)
    .join("-")}`;
}

function collect(prefix: string[], value: NestedStrings, out: [string, string][]): void {
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      out.push([variableName(...prefix, key), entry]);
    } else {
      collect([...prefix, key], entry, out);
    }
  }
}

/**
 * Renders the tokens as a Tailwind v4 `@theme static` block. `static` makes Tailwind emit every
 * variable as a CSS custom property whether or not a utility uses it, so CSS Modules can rely on
 * `var(--color-status-success-fg)` or `var(--layout-sidebar-width)` being defined.
 */
export function renderThemeCss(source: Tokens = tokens): string {
  const declarations: [string, string][] = [];

  collect(["color"], source.color as NestedStrings, declarations);
  collect(["font"], source.font as NestedStrings, declarations);

  for (const [name, { size, lineHeight }] of Object.entries(source.text)) {
    declarations.push([`--text-${name}`, size]);
    declarations.push([`--text-${name}--line-height`, lineHeight]);
  }

  collect(["spacing"], source.spacing as NestedStrings, declarations);
  collect(["radius"], source.radius as NestedStrings, declarations);
  collect(["shadow"], source.shadow as NestedStrings, declarations);
  collect(["breakpoint"], source.breakpoint as NestedStrings, declarations);
  collect(["ease"], source.ease as NestedStrings, declarations);
  collect(["layout"], source.layout as NestedStrings, declarations);

  const body = declarations.map(([name, value]) => `  ${name}: ${value};`).join("\n");

  return [
    "/*",
    " * Generated from packages/design-tokens/src/tokens.ts.",
    " * Do not edit by hand: run `npm run build -w packages/design-tokens`.",
    " */",
    "@theme static {",
    body,
    "}",
    "",
  ].join("\n");
}
