import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, XCircle, Ban, Info } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

const TYPE_LABEL = (type) =>
    type === 'vacation' ? 'Vacaciones' :
    type === 'permission' ? 'Permiso' :
    type === 'seniority_benefit' ? 'Beneficio Antigüedad' : 'Ausencia';

export default function AllRequests() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'super_admin';

    const [pendingRequests, setPendingRequests] = useState([]);
    const [processedRequests, setProcessedRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const [annulModal, setAnnulModal] = useState(null); // { id, request_number, request_type, status, employee_name }
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
            setPendingRequests(res.data.filter(req => req.status === 'pending'));
            setProcessedRequests(res.data.filter(req => req.status !== 'pending'));
        } catch (error) {
            console.error("Error fetching all requests:", error);
            toast.error("Ocurrió un error al cargar las solicitudes de la organización.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRequests(); }, []);

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

    const histColSpan = isSuperAdmin ? 8 : 7;

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

            <div className="mt-8 flow-root">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Pendientes de Aprobación</h2>
                <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg mb-8">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Número</th>
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
                                            <td colSpan="6" className="py-8 text-center text-sm text-gray-500">
                                                No hay ninguna solicitud pendiente de aprobación en la organización.
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingRequests.map((req) => (
                                            <tr key={req.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-500 sm:pl-6">
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

                        <h2 className="text-lg font-medium text-gray-900 mb-4 mt-8">Historial de Solicitudes</h2>
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Número</th>
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
                                                Aún no se ha procesado ninguna solicitud en la organización.
                                            </td>
                                        </tr>
                                    ) : (
                                        processedRequests.map((req) => (
                                            <tr key={req.id} className={req.status === 'annulled' ? 'opacity-50' : 'opacity-75'}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-6">
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
