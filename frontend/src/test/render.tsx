import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

// Renders `ui` inside the providers the real app supplies in main.tsx, so
// components that call useQuery() work in tests. Add more providers here
// (e.g. a MemoryRouter) once a component needs them.
export function renderWithProviders(ui: ReactElement) {
  // New client per call so cached data never leaks between tests. retry: false
  // makes a failed request surface immediately; the app's shared client retries.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  }
}
