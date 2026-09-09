import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Render as a landmark section with its own heading when a title is provided. */
  title?: string;
  description?: string;
  actions?: ReactNode;
  as?: "section" | "div" | "article";
  padded?: boolean;
}

export function Card({
  title,
  description,
  actions,
  as: Tag = "section",
  padded = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  const headingId = title ? `${slugify(title)}-heading` : undefined;
  return (
    <Tag
      aria-labelledby={headingId}
      className={`rounded-lg border border-line-subtle bg-surface-raised shadow-sm ${className}`}
      {...rest}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-4 py-3 sm:px-5">
          <div>
            <h2 id={headingId} className="text-base font-semibold text-fg-primary">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-sm text-fg-secondary">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={padded ? "p-4 sm:p-5" : ""}>{children}</div>
    </Tag>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
