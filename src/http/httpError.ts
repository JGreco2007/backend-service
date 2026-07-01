/**
 * An error whose message is safe to send to the client as-is (a validation
 * failure, a 404, a business-rule rejection, ...). Anything thrown that is
 * NOT an HttpError is treated by the global error handler as a bug or
 * infrastructure failure — logged in full, but never shown to the client.
 */
export class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}
