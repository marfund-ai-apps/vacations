import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, XCircle, Ban } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/dateUtils';

export default function PendingApprovals() {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [processedRequests, setProcessedRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState(null);
    const [decisionModal, setDecisionModal] = useState({ isOpen: false, requestId: null, decision: null, requestInfo: null });
    const [rejectComment, setRejectComment] = useState('');

    const fetchTeamRequests = async () => {
        try {
            const res = await api.get('/requests?scope=team');
            setPendingRequests(res.data.filter(req => req.status === 'pending'));
            setProcessedRequests(res.data.filter(req => req.status !== 'pending'));
        } catch (error) {
            console.error("Error fetching pending requests:", error);
            toast.error("Ocurrió un error al cargar las solicitudes pendientes.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeamRequests();
    }, []);

    const openDecisionModal = (id, decision, requestInfo) => {
        setDecisionModal({ isOpen: true, requestId: id, decision, requestInfo });
        setRejectComment('');
    };

    const closeDecisionModal = () => {
        setDecisionModal({ isOpen: false, requestId: null, decision: null, requestInfo: null });
        setRejectComment('');
    };

    const confirmDecision = async () => {
        if (decisionModal.decision === 'rejected' && !rejectComment.trim()) {
            return toast.error('El motivo de rechazo es obligatorio');
        }

        setSubmittingId(decisionModal.requestId);
        try {
            await api.put(`/requests/${decisionModal.requestId}/decision`, {
                decision: decisionModal.decision,
                comments: rejectComment || ''
            });
            toast.success(`Solicitud ${decisionModal.decision === 'approved' ? 'aprobada' : 'rechazada'} exitosamente`);
            closeDecisionModal();
            fetchTeamRequests();
        } catch (error) {
            console.error("Error processing decision:", error);
            toast.error(error.response?.data?.message || "Error al procesar la decisión");
        } finally {
            setSubmittingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-xl font-semibold leading-6 text-gray-900">Solicitudes de mi Equipo</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Gestiona y revisa las solicitudes de vacaciones y permisos de las personas a tu cargo.
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                        <span className="font-medium">V/PP/AJ</span> = Vacaciones / Permiso Personal / Ausencia Justificada
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
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Fecha Solicitud</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Número</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Colaborador</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha V/PP/AJ</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Días Hábiles</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right font-semibold text-gray-900">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {pendingRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-8 text-center text-sm text-gray-500">
                                                No tienes solicitudes pendientes de aprobación.
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingRequests.map((req) => (
                                            <tr key={req.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                                                    {formatDateTime(req.created_at)}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                                                    {req.request_number}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm sm:pl-6">
                                                    {req.employee_number && <div className="text-xs font-mono font-semibold text-indigo-600 mb-0.5">{req.employee_number}</div>}
                                                    <div className="font-medium text-gray-900">{req.employee_name}</div>
                                                    <div className="text-xs text-gray-500">{req.employee_email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                                                    {req.request_type === 'vacation' ? 'Vacaciones' :
                                                        req.request_type === 'permission' ? 'Permiso' :
                                                        req.request_type === 'seniority_benefit' ? 'Beneficio Antigüedad' : 'Ausencia'}
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
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2">
                                                    <button
                                                        onClick={() => openDecisionModal(req.id, 'approved', req)}
                                                        disabled={submittingId === req.id}
                                                        className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 hover:bg-green-100 disabled:opacity-50"
                                                    >
                                                        <CheckCircle className="w-3 h-3 mr-1" /> Aprobar
                                                    </button>
                                                    <button
                                                        onClick={() => openDecisionModal(req.id, 'rejected', req)}
                                                        disabled={submittingId === req.id}
                                                        className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 hover:bg-red-100 disabled:opacity-50"
                                                    >
                                                        <XCircle className="w-3 h-3 mr-1" /> Rechazar
                                                    </button>
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
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Fecha Solicitud</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Número</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Colaborador</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fecha V/PP/AJ</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Días Hábiles</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Nota del Supervisor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {processedRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="py-8 text-center text-sm text-gray-500">
                                                No hay historial de solicitudes procesadas.
                                            </td>
                                        </tr>
                                    ) : (
                                        processedRequests.map((req) => (
                                            <tr key={req.id} className="opacity-75">
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                                                    {formatDateTime(req.created_at)}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                                                    {req.request_number}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm sm:pl-6">
                                                    {req.employee_number && <div className="text-xs font-mono font-semibold text-indigo-600 mb-0.5">{req.employee_number}</div>}
                                                    <div className="font-medium text-gray-900">{req.employee_name}</div>
                                                    <div className="text-xs text-gray-500">{req.employee_email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                                                    {req.request_type === 'vacation' ? 'Vacaciones' :
                                                        req.request_type === 'permission' ? 'Permiso' :
                                                        req.request_type === 'seniority_benefit' ? 'Beneficio Antigüedad' : 'Ausencia'}
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
                                                <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                    {req.status === 'approved' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            <CheckCircle className="w-3 h-3 mr-1" />Aprobado
                                                        </span>
                                                    )}
                                                    {req.status === 'rejected' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            <XCircle className="w-3 h-3 mr-1" />Rechazado
                                                        </span>
                                                    )}
                                                    {req.status === 'cancelled' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                            <XCircle className="w-3 h-3 mr-1" />Cancelado
                                                        </span>
                                                    )}
                                                    {req.status === 'annulled' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                                                            <Ban className="w-3 h-3 mr-1" />Anulada
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-700 max-w-xs">
                                                    {req.status === 'rejected' && req.manager_comments ? (
                                                        <span className="whitespace-normal">{req.manager_comments}</span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Decisión */}
            {decisionModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Overlay */}
                    <div
                        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                        onClick={closeDecisionModal}
                    ></div>

                    {/* Modal Container */}
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
                            {/* Header */}
                            <div className={`px-6 py-4 border-b ${decisionModal.decision === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <h3 className={`text-lg font-semibold ${decisionModal.decision === 'approved' ? 'text-green-900' : 'text-red-900'}`}>
                                    {decisionModal.decision === 'approved' ? '✅ Confirmar Aprobación' : '❌ Confirmar Rechazo'}
                                </h3>
                            </div>

                            {/* Content */}
                            <div className="px-6 py-4">
                                {/* Solicitud Info */}
                                {decisionModal.requestInfo && (
                                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Solicitud de {decisionModal.requestInfo.request_type === 'vacation' ? 'Vacaciones' :
                                            decisionModal.requestInfo.request_type === 'permission' ? 'Permiso' :
                                            decisionModal.requestInfo.request_type === 'seniority_benefit' ? 'Beneficio Antigüedad' : 'Ausencia'}</p>
                                        <p className="font-semibold text-gray-800">{decisionModal.requestInfo.employee_name}</p>
                                        <p className="text-xs text-gray-600">{decisionModal.requestInfo.total_days} días hábiles</p>
                                    </div>
                                )}

                                {/* Confirmation Message */}
                                <p className={`text-sm mb-6 ${decisionModal.decision === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
                                    {decisionModal.decision === 'approved'
                                        ? '¿Deseas aprobar esta solicitud?'
                                        : '¿Deseas rechazar esta solicitud?'}
                                </p>

                                {/* Comment Field (only for rejection) */}
                                {decisionModal.decision === 'rejected' && (
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Motivo de Rechazo *
                                        </label>
                                        <textarea
                                            value={rejectComment}
                                            onChange={(e) => setRejectComment(e.target.value)}
                                            placeholder="Ej: No hay cobertura en ese período, falta aprobación presupuestaria, etc."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                                            rows="3"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            El colaborador recibirá este motivo en la notificación
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
                                <button
                                    onClick={closeDecisionModal}
                                    disabled={submittingId !== null}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDecision}
                                    disabled={submittingId !== null || (decisionModal.decision === 'rejected' && !rejectComment.trim())}
                                    className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${
                                        decisionModal.decision === 'approved'
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {submittingId ? 'Procesando...' : (decisionModal.decision === 'approved' ? 'Aprobar' : 'Rechazar')}
                                </button>
                            </div>
                        </div>
                    </div>
            )}
        </div>
    );
}
