export type Role = "admin" | "agent";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  banned: boolean | null;
  createdAt: string;
};

export type ListUsersResponse = {
  users: User[];
};
