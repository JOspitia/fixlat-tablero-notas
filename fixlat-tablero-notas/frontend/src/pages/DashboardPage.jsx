import { useCallback, useEffect, useState } from 'react';
import { fetchMetrics } from '../services/metrics';
import { useToast } from '../contexts/ToastContext';

const STATUS_CONFIG = {
    Pendiente: {
        label: 'Pendiente',
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        border: 'border-yellow-200',
    },
    'En curso': {
        label: 'En curso',
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        border: 'border-blue-200',
    },
    Hecho: {
        label: 'Hecho',
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-200',
    },
};

const STATUS_ORDER = ['Pendiente', 'En curso', 'Hecho'];

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
                toastError(err.response?.data?.message || 'Sesión inválida.');
            } else if (status === 503) {
                setError('No se pudieron cargar las métricas. La función Lambda de métricas no responde.');
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
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
                        {metrics && (
                            <p className="text-xs text-gray-500 mt-1">
                                Última actualización: <span className="font-semibold text-gray-700">{formatTime(metrics.last_updated)}</span>
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setReloadKey((k) => k + 1)}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md shadow-sm transition-colors disabled:opacity-50"
                    >
                        <span>{loading ? 'Cargando...' : 'Reintentar'}</span>
                    </button>
                </div>

                {/* Loading State */}
                {loading && !metrics && (
                    <div className="flex items-center justify-center h-64 bg-white rounded-md border border-gray-200 shadow-sm">
                        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Error State */}
                {error && !metrics && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-6 text-red-800">
                        <h4 className="text-sm font-bold">Error de conexión</h4>
                        <p className="text-xs mt-1">{error}</p>
                        <button
                            type="button"
                            onClick={load}
                            className="mt-3 text-xs px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-semibold transition"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {/* Metrics Content */}
                {metrics && (
                    <div className="space-y-6">
                        {/* Total Card */}
                        <div className="bg-white rounded-md p-6 border border-gray-200 shadow-md">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Total de notas en el tablero
                            </p>
                            <p className="text-5xl font-extrabold text-gray-900 mt-2 font-mono">
                                {metrics.total}
                            </p>
                        </div>

                        {/* Status Grid */}
                        {metrics.total === 0 ? (
                            <div className="bg-white rounded-md border border-gray-200 p-8 text-center shadow-sm">
                                <p className="text-gray-700 font-bold text-base">No hay notas todavía</p>
                                <p className="text-xs text-gray-500 mt-1">Crea la primera nota en el Tablero para ver métricas.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {STATUS_ORDER.map((statusKey) => {
                                    const count = metrics.by_status?.[statusKey] ?? 0;
                                    const cfg = STATUS_CONFIG[statusKey];
                                    return (
                                        <div
                                            key={statusKey}
                                            className={`rounded-md p-6 border ${cfg.bg} ${cfg.border} shadow-md flex flex-col justify-between`}
                                        >
                                            <div>
                                                <p className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>
                                                    {cfg.label}
                                                </p>
                                                <p className="text-4xl font-extrabold text-gray-900 mt-2 font-mono">
                                                    {count}
                                                </p>
                                            </div>
                                            <p className="text-xs font-medium text-gray-700 mt-4 pt-2 border-t border-gray-200/50">
                                                {formatPercent(count, metrics.total)} del total
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
