import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { CreateUserSchema } from "../validators/schemas";
import { NotFoundError } from "../utils/errors";

// ─────────────────────────────────────────────────────────────────────────────
// User Controller
// Validates requests, calls the service, shapes the HTTP response.
// Never contains database logic — that lives in the service.
// ─────────────────────────────────────────────────────────────────────────────

export const UserController = {
  // POST /api/users
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = CreateUserSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "validation_error",
          message: "Invalid request body",
          details: result.error.flatten().fieldErrors,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await UserService.create(result.data);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  },

  // POST /api/users/identify
  // Handles both first-time and returning users in one endpoint.
  // If the email exists → return existing user with isNew: false
  // If the email does not exist → create user and return with isNew: true
  async identify(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = CreateUserSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({
          error: "validation_error",
          message: "Invalid request body",
          details: result.error.flatten().fieldErrors,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await UserService.identify(result.data.email);

      // 201 for new users, 200 for returning users
      res.status(user.isNew ? 201 : 200).json(user);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/users/:userId
  async getById(
    req: Request<{ userId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await UserService.findById(userId);

      if (!user) throw new NotFoundError("User", userId);

      res.json(user);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/users/:userId/sessions
  async getSessions(
    req: Request<{ userId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await UserService.findById(userId);
      if (!user) throw new NotFoundError("User", userId);
      const sessions = await UserService.findSessionsByUserId(userId);
      res.json(sessions);
    } catch (error) {
      next(error);
    }
  },
};
