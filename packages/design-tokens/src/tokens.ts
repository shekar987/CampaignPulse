/**
 * Design tokens for CampaignPulse.
 *
 * This file is the single source of truth for colour, typography, spacing, radius, shadow and
 * layout values. `theme.css` (consumed by Tailwind through `@theme`) is generated from it with
 * `npm run build -w packages/design-tokens`; a test guards that the two never drift apart.
 *
 * Colour names are semantic (`status.success`, `surface.raised`) rather than palette names
 * (`green500`) so a re-theme changes values, not usages. Status foreground/background pairs are
 * chosen to meet WCAG AA contrast (at least 4.5:1) for normal text.
 */

export interface StatusColor {
  /** Tinted background for badges and callouts. */
  bg: string;
  /** Text colour that meets AA contrast on `bg`. */
  fg: string;
  /** Border colour for outlined variants. */
  border: string;
  /** Solid fill for icons, dots and progress bars. */
  solid: string;
}

export const color = {
  status: {
    success: { bg: "#e6f6ec", fg: "#12683c", border: "#9ad4b0", solid: "#1f8a4c" },
    warning: { bg: "#fff4dc", fg: "#8a5a00", border: "#f0c86b", solid: "#d98c00" },
    error: { bg: "#fdeaea", fg: "#a11d1d", border: "#f0a3a3", solid: "#c62828" },
    neutral: { bg: "#eef1f5", fg: "#4b5565", border: "#cfd6df", solid: "#6b7686" },
    info: { bg: "#e8f1fb", fg: "#1d4f91", border: "#a8c4ea", solid: "#2f6bbf" },
  } satisfies Record<string, StatusColor>,
  surface: {
    canvas: "#f4f6f8",
    raised: "#ffffff",
    sunken: "#eceff3",
    inverse: "#16202e",
    inverseRaised: "#1f2b3b",
  },
  fg: {
    primary: "#1a2333",
    secondary: "#4b5565",
    muted: "#6b7686",
    inverse: "#f5f7fa",
    inverseMuted: "#a5b0c0",
    onAccent: "#ffffff",
  },
  line: {
    subtle: "#e3e7ed",
    DEFAULT: "#cfd6df",
    strong: "#9aa5b5",
    inverse: "#2c3a4d",
  },
  accent: {
    DEFAULT: "#0b6e8f",
    hover: "#095a75",
    subtle: "#e6f3f7",
    ring: "#2a9fc4",
  },
} as const;

export const font = {
  sans: '"Inter", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
  mono: '"JetBrains Mono", "Cascadia Code", Consolas, "SFMono-Regular", Menlo, monospace',
} as const;

export const text = {
  xs: { size: "0.75rem", lineHeight: "1rem" },
  sm: { size: "0.875rem", lineHeight: "1.25rem" },
  base: { size: "1rem", lineHeight: "1.5rem" },
  lg: { size: "1.125rem", lineHeight: "1.75rem" },
  xl: { size: "1.25rem", lineHeight: "1.75rem" },
  "2xl": { size: "1.5rem", lineHeight: "2rem" },
  "3xl": { size: "1.875rem", lineHeight: "2.25rem" },
} as const;

export const spacing = {
  "2xs": "0.125rem",
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "3rem",
} as const;

/**
 * Named content widths for `max-w-*`. Declared explicitly because Tailwind resolves a named
 * width from the spacing scale when no container token matches, and the spacing scale above
 * reuses the same names (`max-w-3xl` would otherwise become 3rem).
 */
export const container = {
  xs: "20rem",
  sm: "24rem",
  md: "28rem",
  lg: "32rem",
  xl: "36rem",
  "2xl": "42rem",
  "3xl": "48rem",
  "4xl": "56rem",
  "5xl": "64rem",
  "6xl": "72rem",
  "7xl": "80rem",
} as const;

export const radius = {
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.625rem",
  xl: "0.875rem",
  full: "9999px",
} as const;

export const shadow = {
  sm: "0 1px 2px 0 rgb(22 32 46 / 0.06)",
  md: "0 1px 3px 0 rgb(22 32 46 / 0.08), 0 4px 12px -2px rgb(22 32 46 / 0.08)",
  lg: "0 2px 4px 0 rgb(22 32 46 / 0.08), 0 12px 32px -4px rgb(22 32 46 / 0.14)",
} as const;

export const breakpoint = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

export const ease = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  emphasized: "cubic-bezier(0.3, 0, 0, 1)",
} as const;

export const layout = {
  sidebarWidth: "16rem",
  sidebarCollapsedWidth: "4.5rem",
  topbarHeight: "3.5rem",
  contentMaxWidth: "80rem",
} as const;

export const tokens = {
  color,
  font,
  text,
  spacing,
  container,
  radius,
  shadow,
  breakpoint,
  ease,
  layout,
} as const;

export type Tokens = typeof tokens;
export type StatusTone = keyof typeof color.status;
