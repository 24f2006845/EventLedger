import type { ProjectData } from './project.types.js';
import prisma from '../../config/db.js';
import type { getProjectInput } from './project.types.js';
import { PaginateResults, decodeCursor,encodeCursor } from '../../shared/pagination/index.js';

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
    const decodedCursor = cursor ? decodeCursor(cursor, "project") : null;
    const projects  = await prisma.project.findMany({
        where: {
            userId: userId,
            status: 'ACTIVE',
        },
        take: limit + 1,
        ...(decodedCursor && {
            cursor: {
                Project_page_cursor_unique:{
                    createdAt: new Date(decodedCursor.createdAt),
                    id: decodedCursor.id,
                    userId: userId,
                }
            },
            skip: 1,
        }),
        orderBy: [
            {  createdAt: 'desc'},
            { id: 'desc' },
        ],
    });

    return PaginateResults(projects,
        limit, 
        (project) => encodeCursor({ createdAt: project.createdAt.toISOString(), id: project.id  , version: 1, resource: 'project' }));
    
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
