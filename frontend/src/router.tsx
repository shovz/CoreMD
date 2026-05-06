import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import ChaptersPage from "./pages/ChaptersPage";
import QuestionsPage from "./pages/QuestionsPage";
import QuestionDetailPage from "./pages/QuestionDetailPage";
import CasesPage from "./pages/CasesPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import HistoryPage from "./pages/HistoryPage";
import BookmarksPage from "./pages/BookmarksPage";
import NotesPage from "./pages/NotesPage";
import ExamsPage from "./pages/ExamsPage";
import StageBExamPage from "./pages/StageBExamPage";
import AppShell from "./components/AppShell";
import { AiContextProvider } from "./context/AiContext";
import { AuthProvider, useAuthContext } from "./context/AuthContext";
import { ExamGuardProvider } from "./context/ExamGuardContext";

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
    <ExamGuardProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/chapters" element={<ChaptersPage />} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/exams" element={<ExamsPage />} />
            <Route path="/questions/:id" element={<QuestionDetailPage />} />
            <Route path="/cases" element={<CasesPage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/bookmarks" element={<BookmarksPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/stage-b" element={<StageBExamPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </ExamGuardProvider>
    </AiContextProvider>
    </AuthProvider>
  );
}
