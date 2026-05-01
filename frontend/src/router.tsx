import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import ChaptersPage from "./pages/ChaptersPage";
import ChapterDetailPage from "./pages/ChapterDetailPage";
import SectionDetailPage from "./pages/SectionDetailPage";
import QuestionsPage from "./pages/QuestionsPage";
import QuestionDetailPage from "./pages/QuestionDetailPage";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import HistoryPage from "./pages/HistoryPage";
import BookmarksPage from "./pages/BookmarksPage";
import NotesPage from "./pages/NotesPage";
import AppShell from "./components/AppShell";
import { AiContextProvider } from "./context/AiContext";
import { AuthProvider, useAuthContext } from "./context/AuthContext";

function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuthContext();

  if (isInitializing) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function RootRoute() {
  const { isAuthenticated, isInitializing } = useAuthContext();
  if (isInitializing) {
    return null;
  }
  return isAuthenticated ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Home />
  );
}

export default function AppRouter() {
  return (
    <AuthProvider>
    <AiContextProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/chapters" element={<ChaptersPage />} />
            <Route path="/chapters/:chapterId" element={<ChapterDetailPage />} />
            <Route
              path="/chapters/:chapterId/sections/:sectionId"
              element={<SectionDetailPage />}
            />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/questions/:id" element={<QuestionDetailPage />} />
            <Route path="/cases" element={<CasesPage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/notes" element={<NotesPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </AiContextProvider>
    </AuthProvider>
  );
}
