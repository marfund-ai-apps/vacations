import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

export default function AllRequests() {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [processedRequests, setProcessedRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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

        fetchRequests();
    }, []);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Aprobado</span>;
            case 'rejected':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rechazado</span>;
            case 'cancelled':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><XCircle className="w-3 h-3 mr-1" />Cancelado</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pendiente</span>;
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
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Empleado</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fechas</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Días</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Apoderado</th>
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
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                    {req.request_number}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                                    {req.employee_name}
                                                    <div className="text-xs text-gray-500">{req.employee_email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.request_type === 'vacation' ? 'Vacaciones' :
                                                        req.request_type === 'permission' ? 'Permiso' : 'Ausencia'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.date_ranges && req.date_ranges.length > 0 ? (
                                                        <span>
                                                            {new Date(req.date_ranges[0].date_from).toLocaleDateString()} a <br />
                                                            {new Date(req.date_ranges[0].date_to).toLocaleDateString()}
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

                        <h2 className="text-lg font-medium text-gray-900 mb-4 mt-8">Historial de Decisiones</h2>
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Número</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Empleado</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Fechas</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Días</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Apoderado</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {processedRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-8 text-center text-sm text-gray-500">
                                                Aún no se ha procesado ninguna solicitud en la organización.
                                            </td>
                                        </tr>
                                    ) : (
                                        processedRequests.map((req) => (
                                            <tr key={req.id} className="opacity-75">
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                    {req.request_number}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                                                    {req.employee_name}
                                                    <div className="text-xs text-gray-500">{req.employee_email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.request_type === 'vacation' ? 'Vacaciones' :
                                                        req.request_type === 'permission' ? 'Permiso' : 'Ausencia'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.date_ranges && req.date_ranges.length > 0 ? (
                                                        <span>
                                                            {new Date(req.date_ranges[0].date_from).toLocaleDateString()} a <br />
                                                            {new Date(req.date_ranges[0].date_to).toLocaleDateString()}
                                                        </span>
                                                    ) : 'N/A'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.total_days}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {req.manager_name || 'Desconocido'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {getStatusBadge(req.status)}
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
