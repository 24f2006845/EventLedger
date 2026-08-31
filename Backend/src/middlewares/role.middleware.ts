import type { Request, Response, NextFunction } from "express";
import AppError from "../utils/Apperror.js";
export const adminMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'ADMIN') {
        return next(new AppError("You do not have permission to access this resource", 403));
    }
    next();
};