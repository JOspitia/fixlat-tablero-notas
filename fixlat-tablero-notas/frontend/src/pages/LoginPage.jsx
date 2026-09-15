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

    // Clear inactivation toast on unmount so it doesn't persist.
    useEffect(() => {
        return () => {
            if (fromInactivation) clearInactivityMessage();
        };
    }, [fromInactivation, clearInactivityMessage]);

    // If already authenticated (e.g. coming back to /login), redirect away.
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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <form
                onSubmit={handleSubmit}
                className="bg-white rounded-lg shadow-md w-full max-w-md p-8 flex flex-col gap-4"
            >
                <h1 className="text-2xl font-bold text-center text-gray-800">Iniciar sesión</h1>

                {inactivationNotice && (
                    <div role="alert" className="px-4 py-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">
                        {inactivationNotice}
                    </div>
                )}

                <div className="flex flex-col gap-1">
                    <label htmlFor="email" className="text-sm font-medium text-gray-700">
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
                        className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label htmlFor="password" className="text-sm font-medium text-gray-700">
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
                        className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                </div>

                {error && (
                    <div role="alert" className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded border border-red-200">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 text-white font-semibold rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {submitting ? 'Ingresando…' : 'Iniciar sesión'}
                </button>
            </form>
        </div>
    );
}
