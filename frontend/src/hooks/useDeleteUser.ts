import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { DeleteUserResponse } from '@/types/user'
import { api } from '@/lib/api'
import { usersQueryOptions } from '@/hooks/useUsers'

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete<DeleteUserResponse>(`/api/admin/users/${id}`)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: usersQueryOptions.queryKey }),
  })
}
