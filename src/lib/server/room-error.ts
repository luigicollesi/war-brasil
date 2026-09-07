export class RoomError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly debug?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RoomError";
  }
}
