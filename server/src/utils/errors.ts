export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConflictError extends AppError {
  public lockedBy: string;
  public lockExpiresAt?: Date;

  constructor(message: string, lockedBy: string, lockExpiresAt?: Date) {
    super(message, 409);
    this.lockedBy = lockedBy;
    this.lockExpiresAt = lockExpiresAt;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404);
  }
}

export class BadRequestError extends AppError {
  public errors?: any[];

  constructor(message: string = "Bad request", errors?: any[]) {
    super(message, 400);
    this.errors = errors;
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(message, 500);
  }
}
