import { queryOptions, useQuery } from '@tanstack/react-query'
import type { ListUsersResponse } from '@/types/user'
import { api } from '@/lib/api'

export const usersQueryOptions = queryOptions({
  queryKey: ['users'],
  queryFn: async () => (await api.get<ListUsersResponse>('/api/admin/users')).data,
})

export function useUsers() {
  return useQuery(usersQueryOptions)
}
