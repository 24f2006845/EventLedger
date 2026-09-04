import type { ProjectData } from './project.types.js';
import prisma from '../../config/db.js';
import type { getProjectInput } from './project.types.js';
import { PaginateResults } from '../../utils/Pagination.js';
export const createProjectService =  async (projectData: ProjectData) => {
    const user = await prisma.user.findUnique({
        where: {
            id: projectData.userId,
        },
    });

    if (!user) {
        throw new Error('User not found');
    }

    const project = await prisma.project.create({
        data: {
            name: projectData.name,
            description: projectData?.description as string ,
            userId: projectData.userId,
        },
    });

    return project; 

}

export const getAllProjectsService = async (data: getProjectInput) => {
    const { limit, cursor, userId } = data;
    const projects  = await prisma.project.findMany({
        where: {
            userId: userId,
        },
        take: limit + 1,
        ...(cursor && {
            cursor: {
                id: cursor,
            },
            skip: 1,
        }),
        orderBy: {
            createdAt: 'desc',
        },
    });

    const { result: response, nextCursor, hasMore } = PaginateResults(projects, limit, cursor);

    return { projects: response, nextCursor, hasMore };
    
}

export const getProjectByIdService = async (projectId: string, userId: string) => {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId: userId,
        },
    });

    return project;
}

export const deleteProjectService = async (projectId: string, userId: string) => {
    const project = await prisma.project.findUnique({
        where: {
            id: projectId,
            userId: userId,
        },
    });

    if (!project) {
        throw new Error('Project not found');
    }

    await prisma.project.update({
        where: {
            id: projectId,
        },
        data: {
            status:"ARCHIVED"
        },
    });

    return { message: 'Project deleted successfully' };
}