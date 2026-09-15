import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
    {
        to: '/tablero',
        label: 'Tablero',
        icon: (
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
            </svg>
        ),
    },
    {
        to: '/dashboard',
        label: 'Dashboard',
        icon: (
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
    },
];

export default function Sidebar() {
    const { user, isAdmin, logout } = useAuth();

    const items = [...NAV_ITEMS];
    if (isAdmin) {
        items.push({
            to: '/admin',
            label: 'Usuarios',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
        });
    }

    return (
        <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col justify-between p-4 shrink-0 select-none">
            {/* Top Section */}
            <div className="space-y-6">
                {/* User Information */}
                <div className="border-b border-gray-200 pb-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                        Sesión iniciada como
                    </p>
                    <p className="font-semibold text-gray-800 text-sm truncate mt-1">
                        {user?.name || user?.email || 'Usuario'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 truncate">{user?.email}</span>
                        {isAdmin && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200 rounded">
                                Admin
                            </span>
                        )}
                    </div>
                </div>

                {/* Navigation Menu */}
                <nav className="space-y-1">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                        Menú
                    </p>
                    {items.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                                }`
                            }
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* Logout Button */}
            <div className="pt-4 border-t border-gray-200">
                <button
                    type="button"
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Cerrar sesión</span>
                </button>
            </div>
        </aside>
    );
}
