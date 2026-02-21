import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function NewRequest() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        request_type: 'vacation',
        manager_id: user?.manager_id || '',
        date_from: '',
        date_to: '',
        reason: '',
        notes: ''
    });

    useEffect(() => {
        const fetchManagers = async () => {
            try {
                const res = await api.get('/users/managers');
                setManagers(res.data);
            } catch (error) {
                console.error("Error fetching managers", error);
                toast.error("No se pudieron cargar los supervisores");
            }
        };
        fetchManagers();
    }, []);

    // Helper para calcular días hábiles excluyendo sábados y domingos (simplificado)
    const calculateBusinessDays = (start, end) => {
        let count = 0;
        let curDate = new Date(start);
        const endDate = new Date(end);

        // Ajuste por zona horaria
        curDate.setUTCHours(12, 0, 0, 0);
        endDate.setUTCHours(12, 0, 0, 0);

        if (curDate > endDate) return 0;

        while (curDate <= endDate) {
            const dayOfWeek = curDate.getUTCDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Domingo, 6 = Sábado
                count++;
            }
            curDate.setUTCDate(curDate.getUTCDate() + 1);
        }
        return count;
    };

    const businessDays = (formData.date_from && formData.date_to)
        ? calculateBusinessDays(formData.date_from, formData.date_to)
        : 0;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (businessDays <= 0) {
            return toast.error("El rango de fechas debe contener al menos 1 día hábil.");
        }

        if (!formData.manager_id) {
            return toast.error("Por favor, selecciona al jefe inmediato que aprobará la solicitud.");
        }

        setLoading(true);

        const payload = {
            request_type: formData.request_type,
            manager_id: formData.manager_id,
            reason: formData.reason,
            notes: formData.notes,
            date_ranges: [
                {
                    date_from: formData.date_from,
                    date_to: formData.date_to,
                    business_days: businessDays
                }
            ]
        };

        try {
            await api.post('/requests', payload);
            toast.success("Solicitud enviada correctamente. Tu jefe recibirá un correo.");
            navigate('/dashboard');
        } catch (error) {
            console.error("Error al enviar solicitud", error);
            toast.error(error.response?.data?.message || "Ocurrió un error al enviar la solicitud.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="md:flex md:items-center md:justify-between mb-8">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Nueva Solicitud
                    </h2>
                </div>
            </div>

            <div className="bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">

                        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">

                            <div className="sm:col-span-3">
                                <label htmlFor="request_type" className="block text-sm font-medium leading-6 text-gray-900">
                                    Tipo de Solicitud
                                </label>
                                <div className="mt-2">
                                    <select
                                        id="request_type"
                                        name="request_type"
                                        value={formData.request_type}
                                        onChange={handleChange}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6"
                                    >
                                        <option value="vacation">Vacaciones</option>
                                        <option value="permission">Permiso Personal</option>
                                        <option value="justified_absence">Ausencia Justificada</option>
                                    </select>
                                </div>
                            </div>

                            <div className="sm:col-span-3">
                                <label htmlFor="manager_id" className="block text-sm font-medium leading-6 text-gray-900">
                                    Aprobará (Jefe Inmediato)
                                </label>
                                <div className="mt-2">
                                    <select
                                        id="manager_id"
                                        name="manager_id"
                                        required
                                        value={formData.manager_id}
                                        onChange={handleChange}
                                        disabled={!!user?.manager_id}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6 disabled:bg-gray-100 disabled:text-gray-500"
                                    >
                                        <option value="">Seleccione una opción...</option>
                                        {managers.map(m => (
                                            <option key={m.id} value={m.id}>{m.full_name} ({m.position || 'Supervisor'})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="sm:col-span-3">
                                <label htmlFor="date_from" className="block text-sm font-medium leading-6 text-gray-900">
                                    Fecha de Inicio
                                </label>
                                <div className="mt-2">
                                    <input
                                        type="date"
                                        name="date_from"
                                        id="date_from"
                                        required
                                        value={formData.date_from}
                                        onChange={handleChange}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-3">
                                <label htmlFor="date_to" className="block text-sm font-medium leading-6 text-gray-900">
                                    Fecha de Fin
                                </label>
                                <div className="mt-2">
                                    <input
                                        type="date"
                                        name="date_to"
                                        id="date_to"
                                        required
                                        value={formData.date_to}
                                        onChange={handleChange}
                                        min={formData.date_from}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    />
                                </div>
                            </div>

                            {businessDays > 0 && (
                                <div className="sm:col-span-6 bg-blue-50 border-l-4 border-blue-400 p-4">
                                    <div className="flex">
                                        <div className="ml-3">
                                            <p className="text-sm text-blue-700">
                                                Días hábiles a descontar: <strong>{businessDays} días</strong> <br />
                                                <span className="text-xs text-blue-500">(Feriados deben descontarse manualmente en RRHH por el momento)</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="col-span-full">
                                <label htmlFor="reason" className="block text-sm font-medium leading-6 text-gray-900">
                                    Motivo / Justificación
                                </label>
                                <div className="mt-2">
                                    <textarea
                                        id="reason"
                                        name="reason"
                                        rows={3}
                                        required
                                        value={formData.reason}
                                        onChange={handleChange}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                                    />
                                </div>
                                <p className="mt-3 text-sm leading-6 text-gray-600">Escribe unas breves palabras sobre el motivo de la solicitud.</p>
                            </div>

                        </div>

                        <div className="mt-6 flex items-center justify-end gap-x-6">
                            <button type="button" onClick={() => navigate('/dashboard')} className="text-sm font-semibold leading-6 text-gray-900">
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                            >
                                {loading ? 'Enviando...' : 'Enviar Solicitud'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
