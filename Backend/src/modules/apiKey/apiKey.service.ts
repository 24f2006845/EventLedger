import crypto from 'crypto';
import prisma from '../../config/db.js';
import AppError from '../../utils/Apperror.js';


export const generateApiKey = async (name: string, userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const apiKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    let project = await prisma.project.findFirst({
        where: {
            userId: userId,
            name: name,
        },
    });

    if (!project) {
        project = await prisma.project.create({
            data: {
                name: name,
                userId: userId,
            },
        });
    }

    await prisma.apiKey.create({
        data: {
            key_hash: keyHash,
            status: 'ACTIVE',
            userId: userId,
            projectId: project.id,
        },
    });

    const apiKeyWithPrefix = `EventLedger-${apiKey}`;

    return apiKeyWithPrefix;
}

export const getApiKeys = async (projectId: string) => {
    const apiKeys = await prisma.apiKey.findMany({
        where: {
            projectId: projectId,
        },
        select: {
            id: true,
            status: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return apiKeys;
}

export const deleteApiKey = async (apiKeyId: string, projectId: string) => {
    const apiKey = await prisma.apiKey.findUnique({
        where: {
            id: apiKeyId,
        },
    });

    if (!apiKey) {
        throw new AppError('API key not found', 404);
    }

    if (apiKey.projectId !== projectId) {
        throw new AppError('Unauthorized', 403);
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