import { useCallback, useEffect, useState } from 'react';
import { fetchMetrics } from '../services/metrics';
import { useToast } from '../contexts/ToastContext';

const STATUS_ORDER = ['Pendiente', 'En curso', 'Hecho'];
const COLOR_BY_STATUS = {
    Pendiente: '#FFF275', // yellow
    'En curso': '#90E0EF', // blue
    Hecho: '#80ED99',     // green
};

function formatPercent(n, total) {
    if (!total) return '0%';
    return `${((n / total) * 100).toFixed(1)}%`;
}

function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function DashboardPage() {
    const { error: toastError } = useToast();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMetrics();
            setMetrics(data);
        } catch (err) {
            const status = err.response?.status;
            if (status === 401 || status === 403) {
                // Interceptor handles 401 -> /login. 403 likely means user inactive.
                toastError(err.response?.data?.message || 'Sesión inválida.');
            } else if (status === 503) {
                setError('No se pudieron cargar las métricas. La Lambda no responde.');
            } else {
                setError('No se pudieron cargar las métricas.');
            }
        } finally {
            setLoading(false);
        }
    }, [toastError]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-end justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                    {metrics && (
                        <p className="text-sm text-gray-500 mt-1">
                            Última actualización: <span className="font-medium">{formatTime(metrics.last_updated)}</span>
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    disabled={loading}
                    className="text-sm px-4 py-2 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {loading ? 'Cargando…' : 'Reintentar'}
                </button>
            </div>

            {loading && !metrics && (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                </div>
            )}

            {error && !metrics && (
                <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
                    <p className="mb-3">{error}</p>
                    <button
                        type="button"
                        onClick={load}
                        className="text-sm px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {metrics && (
                <>
                    <div className="mb-8">
                        <p className="text-sm text-gray-500 uppercase tracking-wide">Total de notas</p>
                        <p className="text-6xl font-bold text-gray-800 mt-1">{metrics.total}</p>
                    </div>

                    {metrics.total === 0 ? (
                        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                            <p className="text-gray-500 text-lg">No hay notas todavía</p>
                            <p className="text-gray-400 text-sm mt-2">Crea la primera nota en el Tablero para ver las métricas.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {STATUS_ORDER.map((status) => {
                                const count = metrics.by_status?.[status] ?? 0;
                                return (
                                    <div
                                        key={status}
                                        className="rounded-lg p-6 shadow-sm border border-gray-200"
                                        style={{ background: COLOR_BY_STATUS[status] }}
                                    >
                                        <p className="text-sm text-gray-800 font-medium uppercase tracking-wide">{status}</p>
                                        <p className="text-4xl font-bold text-gray-900 mt-2">{count}</p>
                                        <p className="text-sm text-gray-700 mt-2">
                                            {formatPercent(count, metrics.total)} del total
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
