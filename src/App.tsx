import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WizardLayout }   from './ui/WizardLayout'
import { DescribePage }   from './ui/pages/DescribePage'
import { ClarifyPage }    from './ui/pages/ClarifyPage'
import { DraftsPage }     from './ui/pages/DraftsPage'
import { EditorPage }     from './ui/pages/EditorPage'
import { DataPage }       from './ui/pages/DataPage'
import { ExportPage }     from './ui/pages/ExportPage'
import { HomePage }       from './ui/pages/HomePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route path="/"               element={<HomePage />} />

        {/* Wizard */}
        <Route path="/studio"         element={<WizardLayout />}>
          <Route index                element={<Navigate to="describe" replace />} />
          <Route path="describe"      element={<DescribePage />} />
          <Route path="clarify"       element={<ClarifyPage />} />
          <Route path="drafts"        element={<DraftsPage />} />
          <Route path="editor"        element={<EditorPage />} />
          <Route path="data"          element={<DataPage />} />
          <Route path="export"        element={<ExportPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
