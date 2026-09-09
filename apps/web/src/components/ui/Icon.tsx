import type { SVGProps } from "react";

const PATHS = {
  pulse: "M3 12h4l3-8 4 16 3-8h4",
  "layout-grid": "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  megaphone:
    "M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12",
  siren: "M6 19V11a6 6 0 0 1 12 0v8M4 19h16M12 5V3M5 7 3.5 5.5M19 7l1.5-1.5",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4",
  "chevron-left": "M15 6l-6 6 6 6",
  "chevron-right": "M9 6l6 6-6 6",
  "arrow-left": "M19 12H5M11 18l-6-6 6-6",
  "check-circle": "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8.5 12l2.5 2.5 5-5",
  "alert-triangle": "M12 4 2.5 20h19L12 4zM12 10v4M12 17h.01",
  "alert-octagon": "M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5zM12 8v5M12 16h.01",
  "minus-circle": "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 12h8",
  refresh: "M20 11a8 8 0 0 0-14.5-4.5L3 9M4 13a8 8 0 0 0 14.5 4.5L21 15M3 4v5h5M21 20v-5h-5",
  clock: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3 2",
  filter: "M4 5h16l-6 7v5l-4 2v-7L4 5z",
  inbox: "M4 13h4l2 3h4l2-3h4M6 5h12l2 8v6H4v-6l2-8z",
  play: "M7 5v14l11-7z",
  "rotate-ccw": "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  archive: "M4 5h16v4H4zM6 9v10h12V9M10 13h4",
  "check-square": "M9 12l2 2 4-4M5 4h14v16H5z",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Pixel size; icons are square. */
  size?: number;
  /** Accessible label. Omit for purely decorative icons, which are hidden from assistive tech. */
  label?: string;
}

/** Minimal inline icon set so the app needs no icon-font or external asset requests. */
export function Icon({ name, size = 18, label, className, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={className}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
