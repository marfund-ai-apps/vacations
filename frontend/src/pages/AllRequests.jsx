import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, XCircle, Ban, Info, Filter, X } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

const TYPE_LABEL = (type) =>
    type === 'vacation' ? 'Vacaciones' :
    type === 'permission' ? 'Permiso' :
    type === 'seniority_benefit' ? 'Beneficio Antigüedad' : 'Ausencia';

const MONTHS = [
    { value: 0, label: 'Todos los meses' },
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
];

export default function AllRequests() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';

    const [allRequests, setAllRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [filterMonth, setFilterMonth] = useState(0);
    const [filterManager, setFilterManager] = useState('');
    const [searchEmployee, setSearchEmployee] = useState('');

    const [annulModal, setAnnulModal] = useState(null);
    const [annulReason, setAnnulReason] = useState('');
    const [submittingAnnul, setSubmittingAnnul] = useState(false);
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });

    const showTooltip = (e, text) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({ visible: true, x: rect.left, y: rect.bottom + 6, text });
    };
    const hideTooltip = () => setTooltip({ visible: false, x: 0, y: 0, text: '' });

    const fetchRequests = async () => {
        try {
            const res = await api.get('/requests?scope=all');
            setAllRequests(res.data);
        } catch (error) {
            console.error("Error fetching all requests:", error);
            toast.error("Ocurrió un error al cargar las solicitudes de la organización.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRequests(); }, []);

    // Años disponibles según los datos (desc), incluyendo el año actual
    const years = useMemo(() => {
        const set = new Set([new Date().getFullYear()]);
        allRequests.forEach(r => { if (r.created_at) set.add(new Date(r.created_at).getFullYear()); });
        return [...set].sort((a, b) => b - a);
    }, [allRequests]);

    // Supervisores únicos presentes en las solicitudes
    const managers = useMemo(() => {
        const map = new Map();
        allRequests.forEach(r => {
            if (r.manager_id && r.manager_name) map.set(r.manager_id, { id: r.manager_id, name: r.manager_name });
        });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [allRequests]);

    // Aplica filtros comunes y ordena de más reciente a más antiguo
    const applyFilters = (list) => list
        .filter(req => {
            const d = req.created_at ? new Date(req.created_at) : null;
            if (filterYear && d && d.getFullYear() !== Number(filterYear)) return false;
            if (filterMonth > 0 && d && (d.getMonth() + 1) !== Number(filterMonth)) return false;
            if (filterManager && String(req.manager_id) !== String(filterManager)) return false;
            if (searchEmployee.trim()) {
                const q = searchEmployee.trim().toLowerCase();
                const hay = `${req.employee_name || ''} ${req.employee_email || ''} ${req.employee_number || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const pendingRequests = useMemo(
        () => applyFilters(allRequests.filter(r => r.status === 'pending')),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allRequests, filterYear, filterMonth, filterManager, searchEmployee]
    );
    const processedRequests = useMemo(
        () => applyFilters(allRequests.filter(r => r.status !== 'pending')),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allRequests, filterYear, filterMonth, filterManager, searchEmployee]
    );

    const activeFilterCount = [
        filterMonth > 0,
        filterManager !== '',
        searchEmployee.trim() !== '',
    ].filter(Boolean).length;

    const resetFilters = () => {
        setFilterMonth(0);
        setFilterManager('');
        setSearchEmployee('');
    };

    const openAnnulModal = (req) => {
        setAnnulReason('');
        setAnnulModal({
            id: req.id,
            request_number: req.request_number,
            request_type: req.request_type,
            status: req.status,
            employee_name: req.employee_name,
        });
    };

    const confirmAnnul = async () => {
        if (!annulReason.trim()) {
            toast.error('Debes ingresar un motivo de anulación.');
            return;
        }
        setSubmittingAnnul(true);
        try {
            await api.put(`/requests/${annulModal.id}/annul`, { reason: annulReason.trim() });
            toast.success(`Solicitud ${annulModal.request_number} anulada correctamente.`);
            setAnnulModal(null);
            fetchRequests();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al anular la solicitud.');
        } finally {
            setSubmittingAnnul(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Aprobado</span>;
            case 'rejected':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rechazado</span>;
            case 'cancelled':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><XCircle className="w-3 h-3 mr-1" />Cancelado</span>;
            case 'annulled':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600"><Ban className="w-3 h-3 mr-1" />Anulada</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pendiente</span>;
        }
    };

    const daysWillReturn = (req) =>
        req.status === 'approved' &&
        (req.request_type === 'vacation' || req.request_type === 'seniority_benefit');

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const pendingColSpan = 7;
    const histColSpan = isSuperAdmin ? 9 : 8;

    return (
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-xl font-semibold leading-6 text-gray-900">Toda Organización</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Listado completo de todas las solicitudes realizadas en la organización.
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div className="mt-6 rounded-lg bg-white ring-1 ring-gray-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Filtros</span>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={resetFilters}
                            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        >
                            <X className="w-3 h-3" /> Limpiar filtros ({activeFilterCount})
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
                        <select
                            value={filterYear}
                            onChange={e => setFilterYear(Number(e.target.value))}
                            className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
                        <select
                            value={filterMonth}
                            onChange={e => setFilterMonth(Number(e.target.value))}
                            className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                        >
                            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Supervisor</label>
                        <select
                            value={filterManager}
                            onChange={e => setFilterManager(e.target.value)}
                            className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                        >
                            <option value="">Todos los supervisores</option>
                            {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Colaborador</label>
                        <input
                            type="text"
                            value={searchEmployee}
                            onChange={e => setSearchEmployee(e.target.value)}
                            placeholder="Nombre, correo o código..."
                            className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

            <div className="mt-8 flow-root">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Pendientes de Aprobación</h2>
                <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg mb-8">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Fecha Solicitud</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Número</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Colaborador</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fechas</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Días</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Supervisor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {pendingRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={pendingColSpan} className="py-8 text-center text-sm text-gray-500">
                                                No hay ninguna solicitud pendiente de aprobación con los filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingRequests.map((req) => (
                                            <tr key={req.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                                                    {formatDateTime(req.created_at)}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-500">
                                                    {req.request_number}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                                    {req.employee_number && <div className="text-xs font-mono font-semibold text-indigo-600 mb-0.5">{req.employee_number}</div>}
                                                    {req.employee_name}
                                                    <div className="text-xs text-gray-500">{req.employee_email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {TYPE_LABEL(req.request_type)}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.date_ranges && req.date_ranges.length > 0 ? (
                                                        <span>
                                                            {formatDate(req.date_ranges[0].date_from)} a <br />
                                                            {formatDate(req.date_ranges[0].date_to)}
                                                        </span>
                                                    ) : 'N/A'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.total_days}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.manager_name || 'Desconocido'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between mb-4 mt-8">
                            <h2 className="text-lg font-medium text-gray-900">Historial de Solicitudes</h2>
                            <span className="text-sm text-gray-500">
                                Mostrando {processedRequests.length} solicitud{processedRequests.length === 1 ? '' : 'es'}
                            </span>
                        </div>
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Fecha Solicitud</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Número</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Colaborador</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fechas</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Días</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Supervisor</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                                        {isSuperAdmin && (
                                            <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Acciones</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {processedRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={histColSpan} className="py-8 text-center text-sm text-gray-500">
                                                No hay solicitudes procesadas con los filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        processedRequests.map((req) => (
                                            <tr key={req.id} className={req.status === 'annulled' ? 'opacity-50' : 'opacity-75'}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                                                    {formatDateTime(req.created_at)}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium">
                                                    <span className={req.status === 'approved' ? 'text-red-600' : 'text-gray-500'}>
                                                        {req.request_number}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                                    {req.employee_number && <div className="text-xs font-mono font-semibold text-indigo-600 mb-0.5">{req.employee_number}</div>}
                                                    {req.employee_name}
                                                    <div className="text-xs text-gray-500">{req.employee_email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {TYPE_LABEL(req.request_type)}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.date_ranges && req.date_ranges.length > 0 ? (
                                                        <span>
                                                            {formatDate(req.date_ranges[0].date_from)} a <br />
                                                            {formatDate(req.date_ranges[0].date_to)}
                                                        </span>
                                                    ) : 'N/A'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.total_days}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.manager_name || 'Desconocido'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        {getStatusBadge(req.status)}
                                                        {req.status === 'annulled' && req.annulment_reason && (
                                                            <span
                                                                onMouseEnter={e => showTooltip(e, req.annulment_reason)}
                                                                onMouseLeave={hideTooltip}
                                                                className="cursor-help inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white flex-shrink-0"
                                                            >
                                                                <Info className="w-3 h-3" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                {isSuperAdmin && (
                                                    <td className="whitespace-nowrap px-3 py-4 text-right">
                                                        {req.status !== 'annulled' && req.status !== 'cancelled' && (
                                                            <button
                                                                onClick={() => openAnnulModal(req)}
                                                                className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-100"
                                                            >
                                                                <Ban className="w-3 h-3 mr-1" /> Anular
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tooltip global de motivo de anulación */}
            {tooltip.visible && (
                <div
                    className="fixed z-[9999] max-w-xs rounded-lg bg-gray-900 text-white text-xs px-3 py-2 shadow-xl pointer-events-none"
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    {tooltip.text}
                </div>
            )}

            {/* Modal de anulación */}
            {annulModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-base font-semibold text-gray-900">Anular Solicitud</h3>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-1">
                                <p><span className="font-medium">Solicitud:</span> {annulModal.request_number}</p>
                                <p><span className="font-medium">Tipo:</span> {TYPE_LABEL(annulModal.request_type)}</p>
                                <p><span className="font-medium">Colaborador:</span> {annulModal.employee_name}</p>
                            </div>

                            {daysWillReturn(annulModal) && (
                                <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-sm text-amber-700">
                                    <strong>Aviso:</strong> Esta solicitud está aprobada.
                                    {annulModal.request_type === 'vacation'
                                        ? ' Los días de vacaciones serán devueltos automáticamente al saldo del colaborador.'
                                        : ' El Beneficio Antigüedad volverá a estar disponible para el colaborador.'}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Motivo de anulación <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={annulReason}
                                    onChange={e => setAnnulReason(e.target.value)}
                                    placeholder="Describe el motivo por el que se anula esta solicitud..."
                                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setAnnulModal(null)}
                                disabled={submittingAnnul}
                                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAnnul}
                                disabled={submittingAnnul || !annulReason.trim()}
                                className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                                <Ban className="w-4 h-4 mr-1.5" />
                                {submittingAnnul ? 'Anulando...' : 'Confirmar Anulación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
