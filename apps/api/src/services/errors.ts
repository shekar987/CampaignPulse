import type { ZodError } from "zod";

/**
 * Base class for errors the API deliberately surfaces to clients. Anything that is not an
 * AppError is treated as unexpected, logged with its stack and masked in the response.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly extensions: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found`, "NOT_FOUND", { entity, id });
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationError extends AppError {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message, "BAD_USER_INPUT", { issues });
    this.issues = issues;
  }

  static fromZod(error: ZodError, message = "Input validation failed"): ValidationError {
    return new ValidationError(
      message,
      error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }
}
