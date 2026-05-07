class ApiError extends Error {
  statusCode: number;
  result?: any;

  constructor(
    statusCode: number,
    message: string | undefined,
    result?: any,
    stack = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.result = result;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
