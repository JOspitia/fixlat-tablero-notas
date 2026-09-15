import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false }) {
    const { user, loading, inactivityMessage, clearInactivityMessage } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (inactivityMessage) {
            // Clear after 6s so the next mount doesn't replay it
            const t = setTimeout(clearInactivityMessage, 6000);
            return () => clearTimeout(t);
        }
    }, [inactivityMessage, clearInactivityMessage]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (inactivityMessage) {
        return <Navigate to="/login" state={{ inactivationMessage: inactivityMessage }} replace />;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requireAdmin && user.role !== 'admin') {
        return <Navigate to="/tablero" replace />;
    }

    return children;
}
