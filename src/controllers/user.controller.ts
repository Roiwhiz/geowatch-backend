import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
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
      const user = await UserService.create(req.body);
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
      const user = await UserService.identify(req.body.email);
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
