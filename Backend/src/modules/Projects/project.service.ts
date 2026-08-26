import type { ProjectData } from './project.types.js';
import prisma from '../../config/db.js';
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

export const getAllProjectsService = async (userId: string) => {
    const projects = await prisma.project.findMany({
        where: {
            userId: userId,
        },
    });

    return projects;
}

export const getProjectByIdService = async (projectId: string, userId: string) => {
    const projectDetails = await prisma.project.findUnique({
        where: {
            id: projectId,
            userId: userId,
        },
    });

    return projectDetails;
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