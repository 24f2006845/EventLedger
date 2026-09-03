export interface ProjectData {
    name: string;
    description?: string;
    userId: string; 
}

export interface getProjectInput {
    limit: number;
    cursor?: string;
    userId: string;
}