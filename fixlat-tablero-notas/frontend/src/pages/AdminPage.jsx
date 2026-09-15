import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { listUsers, toggleUserActive } from '../services/adminUsers';
import UserFormModal from '../components/UserFormModal';

const ROLE_LABEL = { admin: 'Administrador', user: 'Usuario' };

export default function AdminPage() {
    const { user: currentUser, isAdmin } = useAuth();
    const { error: toastError, success } = useToast();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // null | { type: 'new' | 'edit', user? }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const list = await listUsers();
            setUsers(list);
        } catch (err) {
            const status = err.response?.status;
            if (status !== 401 && status !== 403) {
                toastError('No se pudieron cargar los usuarios.');
            }
        } finally {
            setLoading(false);
        }
    }, [toastError]);

    useEffect(() => {
        load();
    }, [load]);

    async function handleToggleActive(targetUser) {
        const nextActive = !targetUser.is_active;
        const verb = nextActive ? 'reactivar' : 'desactivar';
        const ok = window.confirm(
            `¿${verb.charAt(0).toUpperCase() + verb.slice(1)} a ${targetUser.email}?`
        );
        if (!ok) return;

        try {
            const updated = await toggleUserActive(targetUser.id, nextActive);
            setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? updated : u)));
            success(`Usuario ${nextActive ? 'reactivado' : 'desactivado'}`);
        } catch (err) {
            const data = err.response?.data;
            if (data?.message) {
                toastError(data.message); // Includes the last-admin-invariant message verbatim
            } else {
                toastError('No se pudo cambiar el estado del usuario.');
            }
        }
    }

    function handleSaved(savedUser) {
        setUsers((prev) => {
            const idx = prev.findIndex((u) => u.id === savedUser.id);
            if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = savedUser;
                return copy;
            }
            return [...prev, savedUser];
        });
    }

    if (!isAdmin) {
        return (
            <div className="p-8">
                <p className="text-gray-700">No tienes permisos para acceder a este módulo.</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Administración de usuarios</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gestiona los usuarios y sus roles. La invariante del último admin se valida en el backend.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setEditing({ type: 'new' })}
                    className="bg-blue-600 text-white font-semibold px-4 py-2 rounded hover:bg-blue-700 transition"
                >
                    + Nuevo usuario
                </button>
            </div>

            {loading && users.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left">
                            <tr>
                                <th className="px-4 py-3 font-medium text-gray-600">Nombre</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Rol</th>
                                <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
                                <th className="px-4 py-3 font-medium text-gray-600 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3 text-gray-800">
                                        <div className="flex items-center gap-2">
                                            <span>{u.name}</span>
                                            {currentUser && currentUser.id === u.id && (
                                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                                    Tú
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{u.email}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded ${
                                                u.role === 'admin'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : 'bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            {ROLE_LABEL[u.role]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {u.is_active ? (
                                            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                                                Activo
                                            </span>
                                        ) : (
                                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                                                Inactivo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                                        <button
                                            type="button"
                                            onClick={() => setEditing({ type: 'edit', user: u })}
                                            className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleActive(u)}
                                            className={`text-xs px-2.5 py-1 rounded transition ${
                                                u.is_active
                                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                                            }`}
                                        >
                                            {u.is_active ? 'Desactivar' : 'Reactivar'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No hay usuarios. Crea el primero con "+ Nuevo usuario".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {editing && (
                <UserFormModal
                    user={editing.type === 'edit' ? editing.user : null}
                    onClose={() => setEditing(null)}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
