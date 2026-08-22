import type { Request, Response, NextFunction } from 'express';
import AppError from '../../utils/Apperror.js';

export const generateApiKey = (req: Request, res: Response, next: NextFunction) => {
    try{

    }
    catch (error) {
        if (error instanceof Error) {
            return next(new AppError(error.message, 500));
        }
        next(new AppError('An unknown error occurred', 500));
    }
}

export const getApiKeys = (req: Request, res: Response, next: NextFunction) => {
    try{

    }
    catch (error) {
        if (error instanceof Error) {
            return next(new AppError(error.message, 500));
        }
        next(new AppError('An unknown error occurred', 500));
    }
}

export const deleteApiKey = (req: Request, res: Response, next: NextFunction) => {
    try{

    }
    catch (error) {
        if (error instanceof Error) {
            return next(new AppError(error.message, 500));
        }
        next(new AppError('An unknown error occurred', 500));
    }
}   

