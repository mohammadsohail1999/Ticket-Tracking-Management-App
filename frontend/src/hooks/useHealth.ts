import { queryOptions, useQuery } from '@tanstack/react-query'
import type { HealthResponse } from '@/types/health'
import { api } from '@/lib/api'

export const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: async () => (await api.get<HealthResponse>('/api/health')).data,
})

export function useHealth() {
  return useQuery(healthQueryOptions)
}
