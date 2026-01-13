import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface Member {
  id: number;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  category: 'regular' | 'executive' | 'honorary' | 'student';
  status: 'active' | 'inactive' | 'suspended' | 'terminated';
  joinDate: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  occupation?: string | null;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other';
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    email: string;
    role: string;
    isActive: boolean;
  };
}

export interface MemberListResponse {
  members: Member[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface MemberStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  suspendedMembers: number;
  byCategory: Record<string, number>;
}

export const membersApi = {
  /**
   * Get all members with pagination, search, and filters
   */
  async getMembers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<MemberListResponse> {
    const response = await api.get(`${API_URL}/api/members`, { params });
    return response.data.data;
  },

  /**
   * Get member by ID
   */
  async getMember(id: number): Promise<Member> {
    const response = await api.get(`${API_URL}/api/members/${id}`);
    return response.data.data;
  },

  /**
   * Get member statistics
   */
  async getMemberStats(): Promise<MemberStats> {
    const response = await api.get(`${API_URL}/api/members/stats`);
    return response.data.data;
  },

  /**
   * Get current user's member profile
   */
  async getMe(): Promise<Member> {
    const response = await api.get(`${API_URL}/api/members/me`);
    return response.data.data;
  },
};
