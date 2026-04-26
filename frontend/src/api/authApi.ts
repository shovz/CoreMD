import api from "./apiClient";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  full_name?: string;
  email?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  role: string;
  full_name?: string;
}

export const login = (data: LoginRequest) => {
  return api.post<LoginResponse>("/auth/login", data);
};

export const register = (data: RegisterRequest) => {
  return api.post<RegisterResponse>("/auth/register", data);
};

export const getMe = (): Promise<LoginResponse> => {
  return api.get<LoginResponse>("/auth/me").then((r) => r.data);
};