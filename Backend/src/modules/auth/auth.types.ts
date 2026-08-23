export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  message: string;
}
export interface RegisterResponse {
  message: string;
  userId: string;
}
