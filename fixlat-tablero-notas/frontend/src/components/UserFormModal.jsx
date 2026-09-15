import { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { createUser, updateUser } from '../services/adminUsers';

const EMPTY_FORM = {
    name: '',
    email: '',
    role: 'user',
    password: '',
    is_active: true,
};

export default function UserFormModal({ user, onClose, onSaved }) {
    const isEdit = Boolean(user);
    const { error: toastError, success } = useToast();
    const [form, setForm] = useState(() =>
        user
            ? { name: user.name, email: user.email, role: user.role, is_active: user.is_active, password: '' }
            : EMPTY_FORM
    );
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    // Close on Escape
    useEffect(() => {
        function onKey(e) {
            if (e.key === 'Escape' && !submitting) onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, submitting]);

    function update(field, value) {
        setForm((f) => ({ ...f, [field]: value }));
        setErrors((e) => ({ ...e, [field]: null }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setErrors({});

        try {
            let saved;
            if (isEdit) {
                const payload = {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    role: form.role,
                    is_active: form.is_active,
                };
                saved = await updateUser(user.id, payload);
                success('Usuario actualizado');
            } else {
                const payload = {
                    name: form.name.trim(),
                    email: form.email.trim(),
                    role: form.role,
                    password: form.password,
                    is_active: form.is_active,
                };
                saved = await createUser(payload);
                success('Usuario creado');
            }
            onSaved(saved);
            onClose();
        } catch (err) {
            const status = err.response?.status;
            if (status === 422) {
                const fieldErrors = err.response?.data?.errors ?? {};
                setErrors(fieldErrors);
                // Surface first error as toast too
                const firstKey = Object.keys(fieldErrors)[0];
                if (firstKey) toastError(fieldErrors[firstKey][0]);
            } else {
                toastError('No se pudo guardar el usuario.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                    <h2 className="text-xl font-bold text-gray-800">
                        {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="text-2xl leading-none text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        aria-label="Cerrar"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <Field label="Nombre" error={errors.name?.[0]}>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => update('name', e.target.value)}
                            required
                            maxLength={255}
                            autoFocus
                            className={inputClass(errors.name)}
                        />
                    </Field>

                    <Field label="Email" error={errors.email?.[0]}>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => update('email', e.target.value.toLowerCase())}
                            required
                            maxLength={255}
                            className={inputClass(errors.email)}
                        />
                    </Field>

                    <Field label="Rol" error={errors.role?.[0]}>
                        <select
                            value={form.role}
                            onChange={(e) => update('role', e.target.value)}
                            className={inputClass(errors.role)}
                        >
                            <option value="user">Usuario</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </Field>

                    {!isEdit && (
                        <Field
                            label="Contraseña inicial"
                            error={errors.password?.[0]}
                            hint="Mínimo 8 caracteres. Se puede cambiar después."
                        >
                            <input
                                type="password"
                                value={form.password}
                                onChange={(e) => update('password', e.target.value)}
                                required
                                minLength={8}
                                maxLength={64}
                                autoComplete="new-password"
                                className={inputClass(errors.password)}
                            />
                        </Field>
                    )}

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(e) => update('is_active', e.target.checked)}
                            className="rounded"
                        />
                        Activo (puede iniciar sesión)
                    </label>

                    {errors.message && (
                        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                            {errors.message}
                        </div>
                    )}

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="flex-1 px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                            {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, error, hint, children }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            {children}
            {error && <span className="text-xs text-red-700">{error}</span>}
            {!error && hint && <span className="text-xs text-gray-500">{hint}</span>}
        </label>
    );
}

function inputClass(error) {
    const base = 'border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2';
    return error
        ? `${base} border-red-300 focus:ring-red-500`
        : `${base} border-gray-300 focus:ring-blue-500`;
}
