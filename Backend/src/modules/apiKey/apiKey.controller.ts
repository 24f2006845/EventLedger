import type { Request, Response, NextFunction } from 'express';
import AppError from '../../utils/Apperror.js';
import { deleteApiKeyService, generateApiKeyService, getApiKeysService } from './apiKey.service.js';
import { string } from 'zod';

export const generateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const userId = req.user?.userId;
        const { name } = req.body;
        const projectId = req.params.projectId as string;
        if (!userId) {
            return next(new AppError('User ID not found in request', 400));
        }
        if (!name) {
            return next(new AppError('API key name is required', 400));
        }
        if (!projectId) {
            return next(new AppError('Project ID is required', 400));
        }
        const apiKeyData = await generateApiKeyService({ name, projectId, userId });
        const responseData = {
            apiKey: apiKeyData.apiKey,
            rawApiKey: apiKeyData.rawApiKey,
        };
        res.status(201).json(responseData);
    }
    catch (error) {
        if (error instanceof Error) {
            return next(new AppError(error.message, 500));
        }
        next(new AppError('An unknown error occurred', 500));
    }
}

export const getApiKeys = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const projectId = req.params.projectId as string;
        const userId = req.user?.userId;
        if (!userId) {
            return next(new AppError('User ID not found in request', 400));
        }
        if (!projectId) {
            return next(new AppError('Project ID is required', 400));
        }
        const apiKeys = await getApiKeysService(projectId, userId);
        res.status(200).json(apiKeys);
    }
    catch (error) {
        if (error instanceof Error) {
            return next(new AppError(error.message, 500));
        }
        next(new AppError('An unknown error occurred', 500));
    }
}


export const deleteApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const userId = req.user?.userId;
        const projectId = req.params.projectId as string;
        const apiKeyId = req.params.id as string;
        if (!userId) {
            return next(new AppError('User ID not found in request', 400));
        }
        if (!projectId) {
            return next(new AppError('Project ID is required', 400));
        }
        if (!apiKeyId) {
            return next(new AppError('API key ID is required', 400));
        }
        await deleteApiKeyService(apiKeyId, projectId, userId);
        res.status(200).json({ message: 'API key deleted successfully' });

    }
    catch (error) {
        if (error instanceof Error) {
            return next(new AppError(error.message, 500));
        }
        next(new AppError('An unknown error occurred', 500));
    }
}   

