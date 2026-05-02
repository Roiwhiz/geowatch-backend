import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { ValidationError } from "../utils/errors";

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(
        new ValidationError(
          "Invalid request body",
          result.error.flatten().fieldErrors,
        ),
      );
    }

    // Replace body with validated + typed data
    req.body = result.data;

    next();
  };
