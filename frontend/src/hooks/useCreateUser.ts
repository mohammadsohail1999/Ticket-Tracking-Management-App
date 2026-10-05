import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateUserInput, CreateUserResponse } from '@/types/user'
import { api } from '@/lib/api'
import { usersQueryOptions } from '@/hooks/useUsers'

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateUserInput) =>
      (await api.post<CreateUserResponse>('/api/admin/users', input)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: usersQueryOptions.queryKey }),
  })
}
