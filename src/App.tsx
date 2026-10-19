import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WizardLayout }   from './ui/WizardLayout'
import { DescribePage }   from './ui/pages/DescribePage'
import { ClarifyPage }    from './ui/pages/ClarifyPage'
import { DraftsPage }     from './ui/pages/DraftsPage'
import { EditorPage }     from './ui/pages/EditorPage'
import { DataPage }       from './ui/pages/DataPage'
import { ExportPage }     from './ui/pages/ExportPage'
import { HomePage }       from './ui/pages/HomePage'
import { LoginPage }      from './ui/pages/auth/LoginPage'
import { RegisterPage }   from './ui/pages/auth/RegisterPage'
import { VerifyOtpPage }  from './ui/pages/auth/VerifyOtpPage'
import { ProtectedRoute } from './ui/components/auth/ProtectedRoute'
import { PublicOnlyRoute } from './ui/components/auth/PublicOnlyRoute'
import { useAuthStore }   from './store/authStore'

export default function App() {
  // Initialize Supabase Auth and restore session on page mount
  useEffect(() => {
    useAuthStore.getState().initialize()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing (Public) */}
        <Route path="/" element={<HomePage />} />

        {/* Authentication Routes (Public Only) */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/verify-otp"
          element={
            <PublicOnlyRoute>
              <VerifyOtpPage />
            </PublicOnlyRoute>
          }
        />

        {/* Protected Studio Wizard */}
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <WizardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="describe" replace />} />
          <Route path="describe" element={<DescribePage />} />
          <Route path="clarify" element={<ClarifyPage />} />
          <Route path="drafts" element={<DraftsPage />} />
          <Route path="editor" element={<EditorPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
