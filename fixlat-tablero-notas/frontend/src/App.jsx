import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ToastViewport from './components/ToastViewport';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import AdminPage from './pages/AdminPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import TableroPage from './pages/TableroPage';

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />

                        <Route
                            element={
                                <ProtectedRoute>
                                    <Layout />
                                </ProtectedRoute>
                            }
                        >
                            <Route path="/tablero" element={<TableroPage />} />
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
                            <Route
                                path="/admin/usuarios"
                                element={
                                    <ProtectedRoute requireAdmin>
                                        <AdminPage />
                                    </ProtectedRoute>
                                }
                            />
                        </Route>

                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                    <ToastViewport />
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
