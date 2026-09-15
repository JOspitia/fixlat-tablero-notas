import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const { user, loading, login, error, inactivityMessage, clearInactivityMessage } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const fromLocation = location.state?.from;
    const fromInactivation = location.state?.inactivationMessage;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Clear inactivation notice on unmount so it doesn't persist.
    useEffect(() => {
        return () => {
            if (fromInactivation) clearInactivityMessage();
        };
    }, [fromInactivation, clearInactivityMessage]);

    // If already authenticated, redirect away.
    useEffect(() => {
        if (!loading && user) {
            navigate(fromLocation?.pathname || '/tablero', { replace: true });
        }
    }, [user, loading, navigate, fromLocation]);

    async function handleSubmit(e) {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const profile = await login(email.trim(), password);
            const target = fromLocation?.pathname || '/tablero';
            navigate(target, { replace: true });
            return profile;
        } catch {
            // Error already set in AuthContext; UI displays it inline.
        } finally {
            setSubmitting(false);
        }
    }

    const inactivationNotice = fromInactivation || inactivityMessage;

    return (
        <div className="min-h-screen relative flex items-center justify-center bg-gray-50 px-4">
            <div className="canvas-dot-grid absolute inset-0 pointer-events-none" />

            <div className="w-full max-w-md relative z-10 animate-fade-in">
                {/* Title */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Tablero de Notas</h1>
                    <p className="text-xs text-gray-500 mt-1">Inicia sesión para acceder a tus notas</p>
                </div>

                {/* Login Card */}
                <form
                    onSubmit={handleSubmit}
                    className="bg-white rounded-md shadow-md border border-gray-200 p-8 flex flex-col gap-4"
                >
                    <h2 className="text-lg font-bold text-gray-800">Iniciar sesión</h2>

                    {inactivationNotice && (
                        <div role="alert" className="p-3 rounded bg-red-50 border border-red-200 text-red-800 text-xs">
                            {inactivationNotice}
                        </div>
                    )}

                    <div className="flex flex-col gap-1">
                        <label htmlFor="email" className="text-xs font-semibold text-gray-700">
                            Correo electrónico
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={submitting}
                            placeholder="usuario@ejemplo.com"
                            className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 placeholder-gray-400 font-medium"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="password" className="text-xs font-semibold text-gray-700">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            minLength={8}
                            maxLength={64}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={submitting}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 placeholder-gray-400 font-medium"
                        />
                    </div>

                    {error && (
                        <div role="alert" className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="mt-2 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-md shadow-sm transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Ingresando...' : 'Iniciar sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}
