import { useToast } from '../contexts/ToastContext';

const TYPES = {
    success: 'bg-green-100 text-green-800 border-green-300',
    error: 'bg-red-100 text-red-800 border-red-300',
    info: 'bg-blue-100 text-blue-800 border-blue-300',
};

export default function ToastViewport() {
    const { toasts, dismiss } = useToast();

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    role="alert"
                    className={`pointer-events-auto px-4 py-2 rounded shadow border ${
                        TYPES[t.type] || TYPES.info
                    } flex items-start gap-3 max-w-sm`}
                >
                    <span className="flex-1 text-sm">{t.message}</span>
                    <button
                        type="button"
                        onClick={() => dismiss(t.id)}
                        className="text-lg leading-none opacity-60 hover:opacity-100"
                        aria-label="Cerrar"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
