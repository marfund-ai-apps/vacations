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
    const [halfDay, setHalfDay] = useState(false);

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

    const rawBusinessDays = (formData.date_from && formData.date_to)
        ? calculateBusinessDays(formData.date_from, formData.date_to)
        : 0;
    const businessDays = halfDay ? Math.max(0, rawBusinessDays - 0.5) : rawBusinessDays;
    const isVacation = formData.request_type === 'vacation';
    const isSeniorityBenefit = formData.request_type === 'seniority_benefit';
    const showSeniorityOption = user?.benefit_extra_day && !user?.benefit_extra_day_used;
    const reasonDisabled = isVacation || isSeniorityBenefit;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (businessDays <= 0) {
            return toast.error("El rango de fechas debe contener al menos 0.5 días hábiles.");
        }

        if (!formData.manager_id) {
            return toast.error("Por favor, selecciona al supervisor inmediato que aprobará la solicitud.");
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
            toast.success("Solicitud enviada correctamente. Tu supervisor recibirá un correo.");
            navigate('/dashboard');
        } catch (error) {
            console.error("Error al enviar solicitud", error);
            toast.error(error.response?.data?.message || "Ocurrió un error al enviar la solicitud.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'request_type') {
            if (value === 'vacation' || value === 'seniority_benefit') {
                setFormData({ ...formData, request_type: value, reason: '' });
                if (value === 'seniority_benefit') {
                    setHalfDay(false);
                    if (formData.date_from) setFormData(prev => ({ ...prev, request_type: value, reason: '', date_to: prev.date_from }));
                }
            } else {
                setFormData({ ...formData, [name]: value });
            }
            return;
        }
        if (name === 'date_from' && isSeniorityBenefit) {
            setFormData({ ...formData, date_from: value, date_to: value });
            return;
        }
        setFormData({ ...formData, [name]: value });
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
                                        {showSeniorityOption && (
                                            <option value="seniority_benefit">Beneficio Antigüedad</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="sm:col-span-3">
                                <label htmlFor="manager_id" className="block text-sm font-medium leading-6 text-gray-900">
                                    Aprobará (Supervisor Inmediato)
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
                                    {isSeniorityBenefit && <span className="ml-2 text-xs font-normal text-amber-600">(1 día completo)</span>}
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
                                        disabled={isSeniorityBenefit}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 disabled:bg-gray-100 disabled:text-gray-500"
                                    />
                                </div>
                            </div>

                            {formData.date_from && formData.date_to && (
                                <div className="sm:col-span-6">
                                    <div className="flex items-center gap-x-3">
                                        <input
                                            id="half_day"
                                            name="half_day"
                                            type="checkbox"
                                            checked={halfDay}
                                            disabled={isSeniorityBenefit}
                                            onChange={(e) => setHalfDay(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                        <label htmlFor="half_day" className={`text-sm font-medium cursor-pointer ${isSeniorityBenefit ? 'text-gray-400' : 'text-gray-700'}`}>
                                            Solo medio día — el último día del rango cuenta como <strong>0.5</strong>
                                            {isSeniorityBenefit && <span className="ml-2 text-xs font-normal">(no aplica para Beneficio Antigüedad)</span>}
                                        </label>
                                    </div>
                                </div>
                            )}

                            {(businessDays > 0 || isSeniorityBenefit) && formData.date_from && (
                                <div className={`sm:col-span-6 border-l-4 p-4 ${isSeniorityBenefit ? 'bg-amber-50 border-amber-400' : 'bg-blue-50 border-blue-400'}`}>
                                    <div className="flex">
                                        <div className="ml-3">
                                            {isSeniorityBenefit ? (
                                                <p className="text-sm text-amber-700">
                                                    Beneficio Antigüedad: <strong>1 día completo</strong>
                                                    <br />
                                                    <span className="text-xs text-amber-600">Este día no descuenta de tu saldo de vacaciones.</span>
                                                </p>
                                            ) : (
                                                <p className="text-sm text-blue-700">
                                                    Días hábiles a descontar: <strong>{businessDays} {businessDays === 1 ? 'día' : 'días'}</strong>
                                                    {halfDay && <span className="ml-2 text-blue-500">(incluye medio día final)</span>}
                                                    <br />
                                                    <span className="text-xs text-blue-500">(Feriados deben descontarse manualmente en RRHH por el momento)</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="col-span-full">
                                <label htmlFor="reason" className={`block text-sm font-medium leading-6 ${reasonDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                                    Motivo / Justificación
                                    {isVacation && <span className="ml-2 text-xs font-normal text-gray-400">(no aplica para vacaciones)</span>}
                                    {isSeniorityBenefit && <span className="ml-2 text-xs font-normal text-gray-400">(no aplica para Beneficio Antigüedad)</span>}
                                </label>
                                <div className="mt-2">
                                    <textarea
                                        id="reason"
                                        name="reason"
                                        rows={3}
                                        required={!reasonDisabled}
                                        disabled={reasonDisabled}
                                        value={formData.reason}
                                        onChange={handleChange}
                                        placeholder={reasonDisabled ? 'No aplica para este tipo de solicitud' : 'Escribe unas breves palabras sobre el motivo...'}
                                        className={`block w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset sm:text-sm sm:leading-6
                                            ${reasonDisabled
                                                ? 'bg-gray-100 text-gray-400 ring-gray-200 cursor-not-allowed'
                                                : 'text-gray-900 ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600'}`}
                                    />
                                </div>
                                {!reasonDisabled && (
                                    <p className="mt-3 text-sm leading-6 text-gray-600">Escribe unas breves palabras sobre el motivo de la solicitud.</p>
                                )}
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
