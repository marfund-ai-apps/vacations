import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

export default function PendingApprovals() {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [processedRequests, setProcessedRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState(null);

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

    const handleDecision = async (id, decision) => {
        const comments = window.prompt(`¿Desea agregar algún comentario para ${decision === 'approved' ? 'aprobar' : 'rechazar'} esta solicitud? (Opcional)`);

        if (comments === null) return; // Canceló el prompt

        setSubmittingId(id);
        try {
            await api.put(`/requests/${id}/decision`, {
                decision,
                comments
            });
            toast.success(`Solicitud ${decision === 'approved' ? 'aprobada' : 'rechazada'} exitosamente`);
            fetchTeamRequests(); // Recargar la lista
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
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Empleado</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fechas</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Motivo</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right font-semibold text-gray-900">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {pendingRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="py-8 text-center text-sm text-gray-500">
                                                No tienes solicitudes pendientes de aprobación.
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingRequests.map((req) => (
                                            <tr key={req.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                    <div className="font-medium text-gray-900">{req.employee_name}</div>
                                                    <div className="text-gray-500">{req.employee_email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.total_days} días hábiles <br />
                                                    {req.date_ranges && req.date_ranges.length > 0 && (
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(req.date_ranges[0].date_from).toLocaleDateString()} a {new Date(req.date_ranges[0].date_to).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate" title={req.reason}>
                                                    {req.reason}
                                                </td>
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2">
                                                    <button
                                                        onClick={() => handleDecision(req.id, 'approved')}
                                                        disabled={submittingId === req.id}
                                                        className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 hover:bg-green-100 disabled:opacity-50"
                                                    >
                                                        <CheckCircle className="w-3 h-3 mr-1" /> Aprobar
                                                    </button>
                                                    <button
                                                        onClick={() => handleDecision(req.id, 'rejected')}
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

                        <h2 className="text-lg font-medium text-gray-900 mb-4 mt-8">Historial de Decisiones</h2>
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Empleado</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fechas</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {processedRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="py-8 text-center text-sm text-gray-500">
                                                No hay historial de solicitudes procesadas.
                                            </td>
                                        </tr>
                                    ) : (
                                        processedRequests.map((req) => (
                                            <tr key={req.id} className="opacity-75">
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                    <div className="font-medium text-gray-900">{req.employee_name}</div>
                                                    <div className="text-gray-500">{req.employee_email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.total_days} días hábiles <br />
                                                    {req.date_ranges && req.date_ranges.length > 0 && (
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(req.date_ranges[0].date_from).toLocaleDateString()} a {new Date(req.date_ranges[0].date_to).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                    {req.status === 'approved' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            Aprobado
                                                        </span>
                                                    )}
                                                    {req.status === 'rejected' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            Rechazado
                                                        </span>
                                                    )}
                                                    {req.status === 'cancelled' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                            Cancelado
                                                        </span>
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
        </div>
    );
}
