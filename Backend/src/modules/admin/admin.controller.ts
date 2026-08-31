
import type { Request, Response ,NextFunction} from "express";
import AppError from "../../utils/Apperror.js";
import { getAllUserProjectsService, getAllUsersService, getProjectByIdService ,getAllApiKeysService} from "./admin.service.js";


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


export const getAllProjectsController = async (req: Request, res: Response, next: NextFunction) => {
    try{
        // Implement logic to get all projects
        const userId = req.user?.userId;
        const getProjects = await getAllUserProjectsService(userId as string);
        if(!getProjects){
            return next(new AppError("No projects found", 404));
        }
        res.status(200).json({
            status: "success",
            data: getProjects
        });
    }
    catch(err){
        if(err instanceof Error){
            return next(new AppError(err.message, 500));
        }
        next(new AppError("Failed to fetch projects", 500));
    }
}

export const getProjectByIdController = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const projectId  = req.params.projectId;
        const userId = req.user?.userId;
        const project = await getProjectByIdService(projectId as string, userId as string);
        if(!project){
            return next(new AppError("No project found", 404));
        }
        res.status(200).json({
            status: "success",
            data: project
        });
    }
    catch(err){
        if(err instanceof Error){
            return next(new AppError(err.message, 500));
        }
        next(new AppError("Failed to fetch project", 500));
    }
}

export const getAllApiKeysController = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const projectId = req.params.projectId;
        
        const apiKeys = await getAllApiKeysService(projectId as string);
        if(!apiKeys){
            return next(new AppError("No API keys found", 404));
        }
        res.status(200).json({
            status: "success",
            data: apiKeys
        });
    }
    catch(err){
        if(err instanceof Error){
            return next(new AppError(err.message, 500));
        }
        next(new AppError("Failed to fetch API keys", 500));
    }
}   
export const getAllApiKeysByIdController = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const projectId = req.params.projectId;
        const apiKeyId = req.params.apiKeyId;
        
        const apiKeys = await getAllApiKeysService(projectId as string);
        if(!apiKeys){
            return next(new AppError("No API keys found", 404));
        }
        res.status(200).json({
            status: "success",
            data: apiKeys
        });
    }
    catch(err){
        if(err instanceof Error){
            return next(new AppError(err.message, 500));
        }
        next(new AppError("Failed to fetch API key", 500));
    }
}
export const deleteApiKeyController = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const projectId = req.params.projectId;
        const apiKeyId = req.params.apiKeyId;
        
        // Implement logic to delete the API key
        // For example, you can call a service function to delete the API key from the database
        
        res.status(200).json({
            status: "success",
            message: `API key with ID ${apiKeyId} deleted successfully`
        });
    }
    catch(err){
        if(err instanceof Error){
            return next(new AppError(err.message, 500));
        }
        next(new AppError("Failed to delete API key", 500));
    }
}