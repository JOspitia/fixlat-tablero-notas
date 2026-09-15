import { Link } from 'react-router-dom';

export default function NotFoundPage() {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
            <p className="text-xl text-gray-700 mb-6">Página no encontrada</p>
            <Link
                to="/tablero"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            >
                Ir al Tablero
            </Link>
        </div>
    );
}
