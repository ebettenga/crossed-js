export class NotFoundError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

export class UnauthorizedError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
    this.statusCode = 401;
  }
}

export class ForbiddenError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
    this.statusCode = 403;
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
    this.name = "UserNotFoundError";
  }
}

 export class UniqueConstraintError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = "UniqueConstraintError";
    this.statusCode = 409;
  }
}
