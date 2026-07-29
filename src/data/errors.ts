export class DataError extends Error {
  override readonly name = "DataError";

  constructor(
    readonly location: string,
    readonly detail: string,
  ) {
    super(`${location}: ${detail}`);
  }
}

export class DataValidationError extends Error {
  override readonly name = "DataValidationError";

  constructor(readonly errors: readonly string[]) {
    super(errors.join("\n"));
  }
}
