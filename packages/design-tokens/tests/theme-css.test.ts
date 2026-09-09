import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { renderThemeCss } from "../src/theme-css";
import { color } from "../src/tokens";

describe("theme.css", () => {
  it("is in sync with tokens.ts (run `npm run build -w packages/design-tokens` if this fails)", () => {
    const committed = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
    expect(committed.replace(/\r\n/g, "\n")).toBe(renderThemeCss());
  });

  it("exposes semantic status colours rather than palette names", () => {
    const css = renderThemeCss();
    expect(css).toContain("--color-status-success-fg: #12683c;");
    expect(css).toContain("--color-status-error-bg: #fdeaea;");
    expect(css).not.toMatch(/--color-(green|red|yellow|blue)-\d+/);
  });

  it("maps DEFAULT keys to the bare variable name", () => {
    const css = renderThemeCss();
    expect(css).toContain(`--color-accent: ${color.accent.DEFAULT};`);
    expect(css).toContain(`--color-accent-hover: ${color.accent.hover};`);
    expect(css).toContain(`--color-line: ${color.line.DEFAULT};`);
  });

  it("converts camelCase keys to kebab-case variables", () => {
    const css = renderThemeCss();
    expect(css).toContain("--color-surface-inverse-raised:");
    expect(css).toContain("--layout-sidebar-collapsed-width:");
    expect(css).toContain("--text-2xl--line-height:");
  });
});
