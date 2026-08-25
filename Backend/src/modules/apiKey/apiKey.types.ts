export interface ApiKey {
  id: string;
  key_hash: string;
  status: 'ACTIVE' | 'INACTIVE' | 'REVOKED';
  projectId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}