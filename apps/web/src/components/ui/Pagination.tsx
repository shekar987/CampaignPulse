import { Button } from "./Button";
import { Icon } from "./Icon";

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Noun for the summary line, e.g. "campaigns". */
  itemLabel: string;
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  itemLabel,
}: PaginationProps) {
  if (totalCount === 0) {
    return null;
  }
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalCount);

  return (
    <nav
      aria-label={`${itemLabel} pagination`}
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-secondary"
    >
      <p>
        Showing{" "}
        <span className="font-medium text-fg-primary tabular-nums">
          {first}–{last}
        </span>{" "}
        of <span className="font-medium text-fg-primary tabular-nums">{totalCount}</span>{" "}
        {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          icon={<Icon name="chevron-left" size={16} />}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span aria-current="page" className="tabular-nums">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
          <Icon name="chevron-right" size={16} />
        </Button>
      </div>
    </nav>
  );
}
