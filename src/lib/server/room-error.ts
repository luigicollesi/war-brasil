export class RoomError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly debug?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RoomError";
  }

  static [Symbol.hasInstance](value: unknown) {
    if (!(value instanceof Error)) return false;
    const candidate = value as Error & {
      status?: unknown;
      debug?: unknown;
    };
    return (
      typeof candidate.status === "number" &&
      Number.isInteger(candidate.status) &&
      candidate.status >= 100 &&
      candidate.status <= 599
    );
  }
}
