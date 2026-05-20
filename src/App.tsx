import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage.tsx";
import ProjectPage from "./pages/ProjectPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import LlmManagementPage from "./pages/LlmManagementPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import MembersPage from "./pages/MembersPage.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import SupportPage from "./pages/SupportPage.tsx";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/lib/auth";

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-bold uppercase tracking-widest text-slate-400">Authenticating...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "Admin") return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <LandingPage />
            </ProtectedRoute>
          } />
          
          <Route path="/project/:id" element={
            <ProtectedRoute>
              <ProjectPage />
            </ProtectedRoute>
          } />
          
          <Route path="/settings/tavily" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />
          
          <Route path="/settings/llm" element={
            <ProtectedRoute>
              <LlmManagementPage />
            </ProtectedRoute>
          } />
          
          <Route path="/members" element={
            <ProtectedRoute adminOnly>
              <MembersPage />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />

          <Route path="/support" element={
            <ProtectedRoute>
              <SupportPage />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}
