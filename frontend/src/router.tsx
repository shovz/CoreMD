import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { type ReactNode } from "react";

import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import ChaptersPage from "./pages/ChaptersPage";
import ChapterDetailPage from "./pages/ChapterDetailPage";
import SectionDetailPage from "./pages/SectionDetailPage";




function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            localStorage.getItem("access_token") ? (
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            ) : (
              <Home />
            )
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/chapters"
          element={
            <ProtectedRoute>
              <ChaptersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chapters/:chapterId"
          element={
            <ProtectedRoute>
              <ChapterDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chapters/:chapterId/sections/:sectionId"
          element={
            <ProtectedRoute>
              <SectionDetailPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
