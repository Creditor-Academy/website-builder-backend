export class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
    }
}

// Invalid input, malformed/expired tokens
export class BadRequestError extends AppError {
    constructor(msg: string) { super(msg, 400); }
}

// Wrong credentials, invalid/revoked auth tokens
export class UnauthorizedError extends AppError {
    constructor(msg: string) { super(msg, 401); }
}

// Authenticated but not allowed (ownership, role)
export class ForbiddenError extends AppError {
    constructor(msg: string) { super(msg, 403); }
}

// Resource doesn't exist
export class NotFoundError extends AppError {
    constructor(msg: string) { super(msg, 404); }
}

// Duplicate resource (email, username already taken)
export class ConflictError extends AppError {
    constructor(msg: string) { super(msg, 409); }
}

// Valid request but violates business rules
export class UnprocessableEntityError extends AppError {
    constructor(msg: string) { super(msg, 422); }
}

// Rate Limit Exceeded
export class TooManyRequestsError extends AppError {
    constructor(msg: string) { super(msg, 429); }
}

// Internal Server Error
export class InternalServerError extends AppError {
    constructor(msg: string) { super(msg, 500); }
}