import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as authApi from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => sessionStorage.getItem('auth.token'));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [inactivityMessage, setInactivityMessage] = useState(null);

    // On mount: validate session by calling /api/auth/me.
    // Per HU-01 Happy Path Flow 4.
    useEffect(() => {
        let cancelled = false;

        async function init() {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const profile = await authApi.me();
                if (!cancelled) setUser(profile);
            } catch (err) {
                const status = err.response?.status;
                if (status === 401) {
                    // Token invalid or expired — interceptor already cleared it
                    if (!cancelled) setToken(null);
                } else if (status === 403) {
                    // User deactivated mid-session
                    if (!cancelled) {
                        setInactivityMessage(err.response?.data?.message || 'Tu cuenta está inactiva.');
                        setToken(null);
                    }
                }
                // Network errors: keep token, let user retry
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        init();
        return () => {
            cancelled = true;
        };
    }, [token]);

    // Login: stores token, fetches profile, surfaces errors.
    const login = useCallback(async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            const { user: profile, token: newToken } = await authApi.login(email, password);
            sessionStorage.setItem('auth.token', newToken);
            setToken(newToken);
            setUser(profile);
            return profile;
        } catch (err) {
            const status = err.response?.status;
            if (status === 422) {
                // Validation error: email not found / wrong password / inactive
                const errors = err.response?.data?.errors;
                const firstError = errors ? Object.values(errors)[0]?.[0] : null;
                setError(firstError || 'No se pudo iniciar sesión.');
            } else if (status === 429) {
                setError('Demasiados intentos. Intenta nuevamente en un minuto.');
            } else {
                setError('No se pudo contactar al servidor. Verifica tu conexión.');
            }
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Logout: revokes token server-side, clears local state.
    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            // Server logout can fail if token is invalid; still clear locally.
        }
        sessionStorage.removeItem('auth.token');
        setToken(null);
        setUser(null);
        window.location.href = '/login';
    }, []);

    const clearInactivityMessage = useCallback(() => setInactivityMessage(null), []);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                error,
                inactivityMessage,
                login,
                logout,
                clearInactivityMessage,
                isAuthenticated: !!user,
                isAdmin: user?.role === 'admin',
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used inside AuthProvider');
    }
    return ctx;
}
