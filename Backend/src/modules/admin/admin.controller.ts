
import type { Request, Response ,NextFunction} from "express";
import AppError from "../../utils/Apperror.js";
import { getAllUsersService } from "./admin.service.js";


export const getAllUsersController = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const userId  = req.user?.userId;
        const getUser  = await getAllUsersService(userId as string);
        if(!getUser){
            return next(new AppError("No users found", 404));
        }
        res.status(200).json({
            status: "success",
            data: getUser
        });
    }
    catch(err){
        if(err instanceof Error){
            return next(new AppError(err.message, 500));
        }
        next(new AppError("Failed to fetch users", 500));
    }
}

export const getUserByIdController = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const userId  = req.params.userId;
        const getUser  = await getAllUsersService(userId as string);
        if(!getUser){
            return next(new AppError("No user found", 404));
        }
        res.status(200).json({
            status: "success",
            data: getUser
        });
    }
    catch(err){
        if(err instanceof Error){
            return next(new AppError(err.message, 500));
        }
        next(new AppError("Failed to fetch user", 500));
    }
}