import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, ConflictError, BadRequestError } from "../utils/errors";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  // Zod request validation error
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      error: err.issues[0]?.message || "Validation failed",
      errors: err.issues,
    });
  }

  // Ticket claim conflict
  if (err instanceof ConflictError) {
    return res.status(err.statusCode || 409).json({
      success: false,
      statusCode: err.statusCode || 409,
      error: err.message,
      lockedBy: err.lockedBy,
      lockExpiresAt: err.lockExpiresAt ? err.lockExpiresAt.toISOString() : undefined,
    });
  }

  if (err instanceof BadRequestError) {
    return res.status(err.statusCode || 400).json({
      success: false,
      statusCode: err.statusCode || 400,
      error: err.message,
      ...(err.errors ? { errors: err.errors } : {}),
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      statusCode: err.statusCode,
      error: err.message,
    });
  }

  console.error(`Error on ${req.method} ${req.originalUrl || req.url}:`, err);
  return res.status(500).json({
    success: false,
    statusCode: 500,
    error: err.message || "Internal server error",
  });
}
