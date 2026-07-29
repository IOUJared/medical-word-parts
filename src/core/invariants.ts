export class CorpusInvariantError extends Error {
  override readonly name = "CorpusInvariantError";

  constructor(readonly reference: string) {
    super(`Generated corpus invariant failed for ${reference}`);
  }
}

export class UnexpectedVariantError extends Error {
  override readonly name = "UnexpectedVariantError";

  constructor() {
    super("Unexpected discriminated union variant");
  }
}

export function assertNever(value: never): never {
  void value;
  throw new UnexpectedVariantError();
}
