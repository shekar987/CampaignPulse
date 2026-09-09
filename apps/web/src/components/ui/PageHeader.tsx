import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Small element rendered above the title, e.g. a back link. */
  eyebrow?: ReactNode;
  /** Elements rendered next to the title, e.g. status badges. */
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, meta, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-fg-primary">{title}</h1>
          {meta}
        </div>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-fg-secondary">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
