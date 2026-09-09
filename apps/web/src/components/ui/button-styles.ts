export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-fg-on-accent hover:bg-accent-hover",
  secondary: "border-line bg-surface-raised text-fg-primary hover:bg-surface-sunken",
  ghost:
    "border-transparent bg-transparent text-fg-secondary hover:bg-surface-sunken hover:text-fg-primary",
  danger: "border-transparent bg-status-error-solid text-fg-on-accent hover:opacity-90",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-sm",
  md: "h-10 px-4 text-sm",
};

/** Class list shared by buttons and button-styled links so they look identical. */
export function buttonClasses(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className = "",
): string {
  return `${BASE} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;
}
