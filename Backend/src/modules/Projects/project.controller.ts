import type {Request, Response} from 'express';
import AppError from '../../utils/Apperror.js';
import { createProjectService,getProjectByIdService ,getAllProjectsService,deleteProjectService} from './project.service.js';

export const createProjectController = async (req: Request, res: Response) => {
    try {
        const { name, description} = req.body;
        const userId = req.user?.userId; // Assuming you have user information in the request object
        if (!name) {
            throw new AppError('Project name is required', 400);
        }
        if (!userId) {
            throw new AppError('User ID is required', 400);
        }
        // Call the service to create the project
        const project = await createProjectService({ name, description, userId });
        res.status(201).json({ message: 'Project created successfully', project });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
        } else {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}

export const getAllProjectsController = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { limit , cursor } = req.query;
        if (!userId) {
            throw new AppError('User ID is required', 400);
        }
        // Call the service to get all projects for the user
        const projects = await getAllProjectsService({limit , cursor , userId });
        res.status(200).json({ projects });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
        } else {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}

export const getProjectByIdController = async (req: Request, res: Response) => {
    try {
        const projectId = req.params.id;
        const userId = req.user?.userId; 
        if (!projectId) {
            throw new AppError('Project ID is required', 400);
        }
        if (!userId) {
            throw new AppError('User ID is required', 400);
        }
        // Call the service to get the project by ID
        const projectDetails = await getProjectByIdService(projectId as string, userId);
        if (!projectDetails) {
            throw new AppError('Project not found', 404);
        }
        res.status(200).json({ project: projectDetails });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
        } else {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}

export const deleteProjectController = async (req: Request, res: Response) => {
    try {
        const projectId = req.params.id;
        const userId = req.user?.userId; 
        if (!projectId) {
            throw new AppError('Project ID is required', 400);
        }
        if (!userId) {
            throw new AppError('User ID is required', 400);
        }
        // Call the service to delete the project by ID
        const deletedProject = await deleteProjectService(projectId as string, userId);
        if (!deletedProject) {
            throw new AppError('Project not found or not authorized to delete', 404);
        }
        res.status(200).json({ message: 'Project deleted successfully' });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
        } else {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
}