import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { MainLayout } from '@/components/layout/MainLayout'
import LoginPage from '@/pages/LoginPage'
import CharactersPage from '@/pages/CharactersPage'
import ChatPage from '@/pages/ChatPage'
import SettingsPage from '@/pages/SettingsPage'
import WorldsPage from '@/pages/WorldsPage'
import PresetsPage from '@/pages/PresetsPage'
import RegexPage from '@/pages/RegexPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <MainLayout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/characters" replace />} />
        <Route path="characters" element={<CharactersPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="chat/:characterId" element={<ChatPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="worlds" element={<WorldsPage />} />
        <Route path="presets" element={<PresetsPage />} />
        <Route path="regex" element={<RegexPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
