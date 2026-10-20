import type { UpdateUserBody } from '@core/schema/user.ts'

export type Role = "admin" | "agent";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  banned: boolean | null;
  deletedAt: string | null;
  createdAt: string;
};

export type ListUsersResponse = {
  users: User[];
};

// No `role`: the UI only creates agents (the backend defaults the role).
export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
};

export type CreateUserResponse = {
  user: User;
};

export type UpdateUserInput = UpdateUserBody;

export type UpdateUserResponse = {
  user: User;
};

export type DeleteUserResponse = {
  user: User;
};
