import { Navigate, Route, Routes } from 'react-router-dom'
import GuestOnlyRoute from './routes/GuestOnlyRoute'
import ProtectedRoute from './routes/ProtectedRoute'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnlyRoute>
            <LoginPage />
          </GuestOnlyRoute>
        }
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
