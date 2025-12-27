// User types
export interface User {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  member?: Member | null;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  memberId: string;
  email?: string;
  phone?: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  memberId?: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
  };
  message: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: any[];
}

export interface ApiError {
  success: false;
  message: string;
  errors?: any[];
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
