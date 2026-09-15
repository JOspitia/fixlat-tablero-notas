import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
    const { user, logout } = useAuth();

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-2 rounded transition ${
            isActive ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-gray-700 hover:bg-gray-100'
        }`;

    return (
        <aside className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col h-screen">
            <div className="p-4 border-b border-gray-200">
                <p className="text-sm text-gray-500">Sesión iniciada como</p>
                <p className="font-semibold text-gray-800 truncate" title={user?.email}>
                    {user?.name || user?.email}
                </p>
                {user?.role === 'admin' && (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                        admin
                    </span>
                )}
            </div>

            <nav className="flex-1 p-3 flex flex-col gap-1">
                <NavLink to="/tablero" className={linkClass}>
                    <span>Tablero</span>
                </NavLink>
                <NavLink to="/dashboard" className={linkClass}>
                    <span>Dashboard</span>
                </NavLink>
                {user?.role === 'admin' && (
                    <NavLink to="/admin/usuarios" className={linkClass}>
                        <span>Administración</span>
                    </NavLink>
                )}
            </nav>

            <div className="p-3 border-t border-gray-200">
                <button
                    type="button"
                    onClick={logout}
                    className="w-full text-left px-4 py-2 rounded text-red-700 hover:bg-red-50 transition"
                >
                    Cerrar sesión
                </button>
            </div>
        </aside>
    );
}
