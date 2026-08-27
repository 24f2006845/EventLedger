import crypto from 'crypto';
import prisma from '../../config/db.js';
import AppError from '../../utils/Apperror.js';
import type { ApiKeyRequestBody } from './apiKey.types.js';


export const generateApiKeyService = async (data: ApiKeyRequestBody) => {
    const { name, projectId, userId } = data;
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId
        },
    });
    if (!project) {
        throw new AppError('Project not found', 404);
    }

    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const newApiKey = await prisma.apiKey.create({
        data: {
            name,
            key_hash: apiKeyHash,
            projectId,
            status: 'ACTIVE',
        },
    });

    const apiKeyPrefix = `EventLedger-${apiKey}`


    const responseData = {
        apiKey: newApiKey,
        rawApiKey: apiKeyPrefix,
    };

    return { apiKey: newApiKey, rawApiKey: apiKeyPrefix };
}

export const getApiKeysService = async (projectId: string , userId: string) => {
    const apiKeys = await prisma.apiKey.findMany({
        where: {
            projectId: projectId,
            project: {
                userId: userId,
            }
        },
        select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return apiKeys;
}

export const deleteApiKeyService = async (apiKeyId: string, projectId: string, userId: string) => {
    const apiKey = await prisma.apiKey.findFirst({
        where: {
            id: apiKeyId,
            projectId: projectId,
            project: {
                userId: userId,
            },
        },
    });

    if (!apiKey) {
        throw new AppError('API key not found', 404);
    }

    await prisma.apiKey.update({
        where: {
            id: apiKeyId,
        },
        data: {
            status: 'REVOKED',
        },
    });

}