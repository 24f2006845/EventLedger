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
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return users;
    } catch (error) {
        throw new Error("Failed to fetch users");
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
                name: true,
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