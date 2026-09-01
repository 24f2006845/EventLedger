import { log } from "console";
import prisma from "../../config/db.js";

export const getAllUsersService = async (userId: string) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                NOT: {
                    id: userId,
                },
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },  
        })
        return users;
    } catch (error) {
        throw new Error("Failed to fetch  users ");
    }
};
export const getUserByIdService = async (userId: string) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return user;
    } catch (error) {
        throw new Error("Failed to fetch user");
    }
};

export const getAllUserProjectsService = async () => {
    try {
        const projects = await prisma.project.findMany({
            select: {
                id: true,
                name: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                    }
                },
                description: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        
        return projects;
    } catch (error) {
        throw new Error("Failed to fetch projects");
    }
};

export const getProjectByIdService = async (projectId: string) => {
    try {
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
            },
            select: {
                id: true,
                name: true,
                user:{
                    select: {
                        id: true,
                        username: true,
                        email: true,
                    }
                },
                description: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return project;
    } catch (error) {
        throw new Error("Failed to fetch project");
    }
};

export const getAllApiKeysService = async (projectId: string) => {
    try {
        const apiKeys = await prisma.apiKey.findMany({
            where: {
                projectId: projectId,
            },
            select: {
                id: true,
                name: true,
                status: true,
                project: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                createdAt: true,
                updatedAt: true,
            },
        });
        log("API Keys:", apiKeys);
        return apiKeys;
    } catch (error) {
        throw new Error("Failed to fetch API keys");
    }
};

export const getAllApiKeysByIdService = async (projectId: string, apiKeyId: string) => {
    try {
        const apiKeys = await prisma.apiKey.findMany({
            where: {
                projectId: projectId,
            },
            select: {
                id: true,
                name: true,
                status: true,
                project: {
                    select: {
                        id: true,   
                    name: true,
                    }
                },
                createdAt: true,
                updatedAt: true,
            },
        });
        const apiKey = apiKeys.find((key) => key.id === apiKeyId);
        return apiKey;
    } catch (error) {
        throw new Error("Failed to fetch API keys");
    }
};

export const deleteApiKeyService = async (projectId: string, apiKeyId: string) => {
    try {
        const apiKey = await prisma.apiKey.findFirst({
            where: {
                id: apiKeyId,
                projectId: projectId,
            },
        });
        if (!apiKey) {
            throw new Error("API key not found");
        }
        await prisma.apiKey.update({
            where: {
                id: apiKeyId,
            },
            data: {
                status: "REVOKED",
            },
        });
        return apiKey;
    } catch (error) {
        throw new Error("Failed to delete API key");
    }
}