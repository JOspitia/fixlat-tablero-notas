import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const show = useCallback((message, type = 'info', durationMs = 4000) => {
        const id = Date.now() + Math.random();
        const toast = { id, message, type };
        setToasts((prev) => [...prev, toast]);
        if (durationMs > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, durationMs);
        }
        return id;
    }, []);

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider
            value={{
                toasts,
                success: (msg) => show(msg, 'success'),
                error: (msg) => show(msg, 'error', 6000),
                info: (msg) => show(msg, 'info'),
                dismiss,
            }}
        >
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used inside ToastProvider');
    }
    return ctx;
}
