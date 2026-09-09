import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const CONTROL_CLASSES =
  "h-10 w-full rounded-md border bg-surface-raised px-3 text-sm text-fg-primary placeholder:text-fg-muted disabled:bg-surface-sunken";

function controlBorder(invalid: boolean): string {
  return invalid ? "border-status-error-border" : "border-line";
}

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg-primary">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-status-error-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextField({ id, label, hint, error, className = "", ...rest }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL_CLASSES} ${controlBorder(Boolean(error))} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function SelectField({
  id,
  label,
  hint,
  error,
  className = "",
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${CONTROL_CLASSES} ${controlBorder(Boolean(error))} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export interface CheckboxOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface CheckboxGroupProps<T extends string> {
  legend: string;
  name: string;
  options: readonly CheckboxOption<T>[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  hint?: ReactNode;
  error?: string;
}

export function CheckboxGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  hint,
  error,
}: CheckboxGroupProps<T>) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const described = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      aria-describedby={described}
      aria-invalid={error ? true : undefined}
      className="flex flex-col gap-1.5"
    >
      <legend className="text-sm font-medium text-fg-primary">{legend}</legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          const checked = value.includes(option.value);
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 ${
                checked ? "border-accent bg-accent-subtle" : "border-line bg-surface-raised"
              }`}
            >
              <input
                id={id}
                type="checkbox"
                name={name}
                value={option.value}
                checked={checked}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, option.value]
                      : value.filter((entry) => entry !== option.value),
                  )
                }
                className="mt-0.5 h-4 w-4 accent-accent"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-fg-primary">{option.label}</span>
                {option.description ? (
                  <span className="text-xs text-fg-secondary">{option.description}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-fg-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-status-error-fg">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
