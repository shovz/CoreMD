import api from "./apiClient";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export const login = (data: LoginRequest) => {
  return api.post<LoginResponse>("/auth/login", data);
};
