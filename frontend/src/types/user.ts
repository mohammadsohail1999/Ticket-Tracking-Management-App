export type Role = "admin" | "agent";

export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListUsersResponse = {
  users: User[];
};
