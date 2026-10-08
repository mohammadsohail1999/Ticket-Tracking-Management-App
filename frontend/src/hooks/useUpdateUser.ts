import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateUserInput, UpdateUserResponse } from '@/types/user'
import { api } from '@/lib/api'
import { usersQueryOptions } from '@/hooks/useUsers'

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateUserInput & { id: string }) =>
      (await api.patch<UpdateUserResponse>(`/api/admin/users/${id}`, input)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: usersQueryOptions.queryKey }),
  })
}
