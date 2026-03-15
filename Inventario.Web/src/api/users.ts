import { http } from "./http";

export type UserDto = {
  id: string;
  userName: string;
  email: string;
  displayName: string;
  status: string;
  isDeleted: boolean;
  lastLoginUtc?: string | null;
  createdAtUtc: string;
  organizationScope?: string | null;
  roles: string[];
  isMfaEnabled: boolean;
  isMfaRequiredByRole: boolean;
};

export type CreateUserRequest = {
  email: string;
  password: string;
  userName?: string | null;
  displayName?: string | null;
  role?: string | null;
  status?: string | null;
  organizationScope?: string | null;
};

export type UpdateUserRequest = {
  userName?: string | null;
  email?: string | null;
  displayName?: string | null;
  status?: string | null;
  role?: string | null;
  organizationScope?: string | null;
};

export type SetUserStatusRequest = {
  status: string;
};

export async function getUsers(params?: {
  status?: string | null;
  role?: string | null;
  includeDeleted?: boolean;
}) {
  const { data } = await http.get<UserDto[]>("/api/users", { params });
  return data;
}

export async function createUser(payload: CreateUserRequest) {
  const { data } = await http.post<UserDto>("/api/users", payload);
  return data;
}

export async function updateUser(id: string, payload: UpdateUserRequest) {
  const { data } = await http.put<UserDto>(`/api/users/${id}`, payload);
  return data;
}

export async function setUserStatus(id: string, status: string) {
  await http.patch(`/api/users/${id}/status`, { status } as SetUserStatusRequest);
}

export async function deleteUser(id: string) {
  await http.delete(`/api/users/${id}`);
}
