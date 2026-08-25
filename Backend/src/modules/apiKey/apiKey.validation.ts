import * as z from 'zod';

export const createApiKeySchema = z.object({
    body: z.object({
        projectId : z.string().uuid({ message: 'Invalid project ID' }),
        name: z.string().min(2).max(100)
    })
})
export const deleteApiKeySchema = z.object({
    params: z.object({
        apiKeyId: z.string().uuid({ message: 'Invalid API key ID' })
    })
})
