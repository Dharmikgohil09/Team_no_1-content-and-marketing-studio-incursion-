import React from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'
import { AUTH_CONFIG } from '../../../config/auth'

interface ProtectedRouteProps {
  children?: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, session, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-xs font-medium text-muted">Checking authentication...</span>
        </div>
      </div>
    )
  }

  if (!user || !session) {
    return <Navigate to={AUTH_CONFIG.routes.login} state={{ from: location }} replace />
  }

  return children ? <>{children}</> : <Outlet />
}
