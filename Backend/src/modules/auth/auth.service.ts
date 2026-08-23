    import prisma from "../../config/db.js";
    import bcrypt from "bcrypt";
    import { generateAccessToken, generateRefreshToken,verifyAccessToken,verifyRefreshToken} from "../../utils/jwt.js";
    import AppError from "../../utils/Apperror.js";
    import type { JwtPayload } from "../../types/jwt.types.js";
    import crypto from "crypto";

    export async function registerService( username: string, email: string, password: string) {
    try {
        
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
        return (new AppError("User already exists", 400));
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);


        // Create new user
        const newUser = await prisma.user.create({
        data: {
            username,
            email,
            password: hashedPassword,
        },
        });

        return { message: "User registered successfully", userId: newUser.id };
    } catch (error) {
        if (error instanceof AppError) {
        return error;
        }
        throw new AppError("Internal Server Error", 500);
    }
    }

    export async function loginService(email: string, password: string) {
    try {
        

        // Check if user exists
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
        return (new AppError("Invalid email or password", 401));
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
        return (new AppError("Invalid email or password", 401));
        }
        const payload = {
            userId: user.id,
            role: user.role as JwtPayload["role"],
        }

        // Generate tokens
        const accessToken = generateAccessToken(payload );
        const refreshToken = generateRefreshToken(payload );
        const hashRefreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");

        await prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: hashRefreshToken },
        });
        return { accessToken, refreshToken, message: "Logged in successfully" };
    } catch (error) {
        if (error instanceof AppError) {
        return error;
        }
        throw new AppError("Internal Server Error", 500);
    }
    }   

    export async function logoutService(userId :string) {
    try {
        await prisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
        });

        return { message: "Logged out successfully" };
    } catch (error) {
        if (error instanceof AppError) {
        return error
        }
        throw new AppError("Internal Server Error", 500);
    }
    }

    export async function GetMeService(userId: string) {
    try {
        const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
        },
        });

        if (!user) {
        return (new AppError("User not found", 404));
        }

        return { user };
    } catch (error) {
        if (error instanceof AppError) {
        return error;
        }
        throw new AppError("Internal Server Error", 500);
    }
    }
    export async function refreshTokenService(refreshToken: string) {
    try {
        const decoded = verifyRefreshToken(refreshToken);
        const userId = decoded.userId;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.refreshTokenHash) {
        return (new AppError("Invalid refresh token", 401));
        }

        const hashRefreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
        if (hashRefreshToken !== user.refreshTokenHash) {
        return (new AppError("Invalid refresh token", 401));
        }

        const payload = {
            userId: user.id,
            role: user.role as JwtPayload["role"],
        }

        const newAccessToken = generateAccessToken(payload);
        const newRefreshToken = generateRefreshToken(payload);
        const newHashRefreshToken = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

        await prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: newHashRefreshToken },
        });

        return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    }
    catch (error) {
        if (error instanceof AppError) {
        return error;
        }
        throw new AppError("Internal Server Error", 500);
    }
    }


