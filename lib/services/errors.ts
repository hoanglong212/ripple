export class InvalidInputError extends Error {
  readonly code = "INVALID_INPUT";

  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

export class NotIndexedError extends Error {
  constructor(
    readonly code: "PACKAGE_NOT_INDEXED" | "VERSION_NOT_INDEXED",
    message: string,
  ) {
    super(message);
    this.name = "NotIndexedError";
  }
}

export class DatabaseUnavailableError extends Error {
  readonly code = "DATABASE_UNAVAILABLE";

  constructor(message = "Ripple’s graph is temporarily unavailable.", options?: ErrorOptions) {
    super(message, options);
    this.name = "DatabaseUnavailableError";
  }
}
