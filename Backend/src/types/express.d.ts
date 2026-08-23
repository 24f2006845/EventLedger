import type { Role } from "../../generated/prisma/browser.js";

declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                role: Role;
            };
        }
    }
}
