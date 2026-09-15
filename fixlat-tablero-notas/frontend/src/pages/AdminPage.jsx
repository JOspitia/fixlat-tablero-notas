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
    const [searchTerm, setSearchTerm] = useState('');

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
                toastError(data.message);
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

    const filteredUsers = users.filter(
        (u) =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
                <div className="bg-white p-6 rounded-md border border-gray-200 shadow-md text-center max-w-md">
                    <h2 className="text-base font-bold text-gray-900">Acceso denegado</h2>
                    <p className="text-xs text-gray-500 mt-1">No tienes permisos para acceder a la administración de usuarios.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 sm:p-10">
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Administración de usuarios</h1>
                        <p className="text-xs text-gray-500 mt-1">
                            Gestiona las cuentas, roles y estado de activación de los usuarios.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setEditing({ type: 'new' })}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-md shadow-sm transition-colors"
                    >
                        + Nuevo usuario
                    </button>
                </div>

                {/* Search Bar */}
                <div className="flex items-center justify-between gap-4">
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full max-w-xs px-3 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-500 font-medium">
                        Total: {filteredUsers.length} usuarios
                    </span>
                </div>

                {/* Table */}
                {loading && users.length === 0 ? (
                    <div className="flex items-center justify-center h-48 bg-white rounded-md border border-gray-200 shadow-sm">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="bg-white rounded-md border border-gray-200 shadow-md overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase font-semibold">
                                <tr>
                                    <th className="px-4 py-3">Nombre</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Rol</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredUsers.map((u) => {
                                    const isSelf = currentUser && currentUser.id === u.id;
                                    return (
                                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-semibold text-gray-800">
                                                <div className="flex items-center gap-2">
                                                    <span>{u.name}</span>
                                                    {isSelf && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-semibold">
                                                            Tú
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{u.email}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                        u.role === 'admin'
                                                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                                                    }`}
                                                >
                                                    {ROLE_LABEL[u.role] || u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {u.is_active ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
                                                        Activo
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                                        Inactivo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditing({ type: 'edit', user: u })}
                                                    className="px-2.5 py-1 rounded bg-white text-gray-700 font-semibold border border-gray-200 hover:bg-gray-100 transition"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(u)}
                                                    className={`px-2.5 py-1 rounded font-semibold border border-gray-200 transition ${
                                                        u.is_active
                                                            ? 'bg-white text-red-600 hover:bg-red-50'
                                                            : 'bg-white text-green-600 hover:bg-green-50'
                                                    }`}
                                                >
                                                    {u.is_active ? 'Desactivar' : 'Reactivar'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredUsers.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                            No se encontraron usuarios.
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
        </div>
    );
}
