import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Calendar, Clock, CheckCircle, XCircle, TrendingUp, Ban } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import FechaSolicitud from '../components/FechaSolicitud';

export default function Dashboard() {
    const { user } = useAuth();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const response = await api.get('/reports/employee-report');
                setReport(response.data);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
                toast.error("Error al cargar la información del dashboard");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const summary = report?.summary || { total_base_days: 0, total_extra_days: 0, total_consumed_days: 0, total_available_days: 0, total_permission_days: 0, total_absence_days: 0 };
    const history = report?.history || [];
    const adjustments = report?.adjustments || [];
    const showBono = ['super_admin', 'hr_admin'].includes(user?.role); // visibilidad del bono

    const pendingHistory = history.filter(req => req.status === 'pending');
    const processedHistory = history.filter(req => req.status !== 'pending');

    // Combinar solicitudes aprobadas (rojo) y ajustes de días (verde) en un solo timeline
    const approvedRequests = history
        .filter(req => req.status === 'approved' && (req.request_type === 'vacation' || req.request_type === 'seniority_benefit'))
        .map(req => ({
            id: `req-${req.id}`,
            type: req.request_type === 'vacation' ? 'debit' : 'seniority',
            number: req.request_number,
            date: req.manager_decision_date || req.created_at,
            description: req.request_type === 'vacation' ? 'Vacaciones aprobadas' :
                req.request_type === 'seniority_benefit' ? 'Beneficio Antigüedad' : 'Ausencia justificada aprobada',
            detail: req.request_number,
            days: parseFloat(req.total_days) || 0,
        }));

    const adjustmentMovements = adjustments.map(adj => ({
        id: `adj-${adj.id}`,
        type: 'credit',
        number: adj.adjustment_number || '—',
        date: adj.created_at,
        description: adj.adjustment_type === 'monthly_auto'
            ? 'Incremento mensual automático'
            : `Días agregados por ${adj.adjusted_by_name || 'supervisor'}`,
        detail: adj.reason,
        days: parseFloat(adj.days_added) || 0,
    }));

    const movements = [...approvedRequests, ...adjustmentMovements]
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Aprobado</span>;
            case 'rejected':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Rechazado</span>;
            case 'annulled':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600"><Ban className="w-3 h-3 mr-1" />Anulada</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pendiente</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="md:flex md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Hola, {user?.full_name?.split(' ')[0]} 👋
                    </h2>
                </div>
                <div className="mt-4 flex md:ml-4 md:mt-0">
                    <Link
                        to="/new-request"
                        className="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        <Calendar className="w-4 h-4 mr-2" />
                        Nueva Solicitud
                    </Link>
                </div>
            </div>

            {/* Stats — fila principal */}
            <dl className={`mt-5 grid grid-cols-2 gap-5 ${showBono ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
                    <dt className="truncate text-sm font-medium text-gray-500">Saldo Inicial</dt>
                    <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{summary.total_base_days}</dd>
                </div>
                <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 ring-1 ring-green-400">
                    <dt className="truncate text-sm font-medium text-green-600 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Días Agregados
                    </dt>
                    <dd className="mt-1 text-3xl font-semibold tracking-tight text-green-700">+{summary.total_extra_days}</dd>
                </div>
                {showBono && (
                    <div className="overflow-hidden rounded-lg bg-amber-50 px-4 py-5 shadow sm:p-6 ring-1 ring-amber-300">
                        <dt className="truncate text-sm font-medium text-amber-700">Días Beneficio disponibles</dt>
                        <dd className="mt-1 text-3xl font-semibold tracking-tight text-amber-700">{Number(summary.bono_avail ?? 0).toFixed(2)}</dd>
                    </div>
                )}
                <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 ring-1 ring-red-300">
                    <dt className="truncate text-sm font-medium text-red-500">Días Consumidos</dt>
                    <dd className="mt-1 text-3xl font-semibold tracking-tight text-red-600">-{summary.total_consumed_days}</dd>
                </div>
                <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 ring-1 ring-indigo-500">
                    <dt className="truncate text-sm font-medium text-indigo-600">Días Disponibles Hoy</dt>
                    <dd className="mt-1 text-3xl font-semibold tracking-tight text-indigo-700">{summary.total_available_days}</dd>
                </div>
            </dl>

            {/* Fila secundaria: bono (super_admin/hr_admin) + informativos */}
            <dl className={`grid grid-cols-2 gap-5 ${showBono ? 'sm:grid-cols-4' : 'sm:grid-cols-2 sm:max-w-lg'}`}>
                {showBono && (
                    <div className="overflow-hidden rounded-lg bg-amber-50 px-4 py-5 shadow sm:p-6 ring-1 ring-amber-200">
                        <dt className="truncate text-sm font-medium text-amber-700">Bono por antigüedad</dt>
                        <dd className="mt-1 text-2xl font-semibold tracking-tight text-amber-700">{Number(summary.bono_allot ?? 0)}</dd>
                        <p className="text-xs text-amber-600 mt-1">Asignado este año (tope 10)</p>
                    </div>
                )}
                {showBono && (
                    <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 ring-1 ring-gray-200">
                        <dt className="truncate text-sm font-medium text-gray-400">Bono usado (año)</dt>
                        <dd className="mt-1 text-2xl font-semibold tracking-tight text-gray-600">{Number(summary.bono_used ?? 0).toFixed(2)}</dd>
                        <p className="text-xs text-gray-400 mt-1">Vacaciones que tomaron del bono</p>
                    </div>
                )}
                <div className="overflow-hidden rounded-lg bg-sky-50 px-4 py-5 shadow sm:p-6 ring-1 ring-sky-200">
                    <dt className="truncate text-sm font-medium text-sky-700">Permisos Personales</dt>
                    <dd className="mt-1 text-2xl font-semibold tracking-tight text-sky-700">{summary.total_permission_days} <span className="text-sm font-normal">días</span></dd>
                    <p className="text-xs text-sky-600 mt-1">Solo informativo</p>
                </div>
                <div className="overflow-hidden rounded-lg bg-violet-50 px-4 py-5 shadow sm:p-6 ring-1 ring-violet-200">
                    <dt className="truncate text-sm font-medium text-violet-700">Ausencia Justificada</dt>
                    <dd className="mt-1 text-2xl font-semibold tracking-tight text-violet-700">{summary.total_absence_days} <span className="text-sm font-normal">días</span></dd>
                    <p className="text-xs text-violet-600 mt-1">Solo informativo</p>
                </div>
            </dl>

            {/* Solicitudes pendientes de autorización */}
            <div className="mt-8">
                <h3 className="text-md font-medium text-gray-900 mb-1">Pendientes de Autorización</h3>
                <p className="text-xs text-gray-500 mb-4">
                    <span className="font-medium">V/PP/AJ</span> = Vacaciones / Permiso Personal / Ausencia Justificada
                </p>
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg mb-8">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 sm:pl-6">Fecha Solicitud</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">No. Solicitud</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Tipo</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Fecha V/PP/AJ</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Días Hábiles</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Supervisor Inmediato</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {pendingHistory.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-8 text-center text-sm text-gray-500">
                                        No tienes solicitudes recientes pendientes de autorización.
                                    </td>
                                </tr>
                            ) : (
                                pendingHistory.slice(0, 5).map((req) => (
                                    <tr key={req.id}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-xs text-sky-600 sm:pl-6">
                                            <FechaSolicitud ts={req.created_at} />
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs font-medium text-gray-900">
                                            {req.request_number}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">
                                            {req.request_type === 'vacation' ? 'Vacaciones' :
                                                req.request_type === 'permission' ? 'Permiso' :
                                                req.request_type === 'seniority_benefit' ? 'Beneficio Antigüedad' : 'Ausencia'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">
                                            {req.date_ranges && req.date_ranges.length > 0 ? (
                                                <span>
                                                    {formatDate(req.date_ranges[0].date_from)} a{' '}
                                                    {formatDate(req.date_ranges[0].date_to)}
                                                </span>
                                            ) : 'N/A'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">
                                            {req.total_days}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">
                                            {req.manager_name || 'Desconocido'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Historial de solicitudes cerradas */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-medium text-gray-900">Historial de Solicitudes</h3>
                    <Link to="/my-requests" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">Ver todo</Link>
                </div>
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg mb-8">
                    <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 sm:pl-6">Fecha Solicitud</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">No. Solicitud</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Tipo</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Fecha V/PP/AJ</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Días Hábiles</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Supervisor</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Estado</th>
                                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Nota del Supervisor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {processedHistory.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-8 text-center text-sm text-gray-500">
                                        No tienes historial reciente de solicitudes cerradas.
                                    </td>
                                </tr>
                            ) : (
                                processedHistory.slice(0, 5).map((req) => (
                                    <tr key={req.id} className="opacity-75">
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-xs text-sky-600 sm:pl-6"><FechaSolicitud ts={req.created_at} /></td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs font-medium text-gray-900">{req.request_number}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">
                                            {req.request_type === 'vacation' ? 'Vacaciones' :
                                                req.request_type === 'permission' ? 'Permiso' :
                                                req.request_type === 'seniority_benefit' ? 'Beneficio Antigüedad' : 'Ausencia'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">
                                            {req.date_ranges && req.date_ranges.length > 0 ? (
                                                <span>
                                                    {formatDate(req.date_ranges[0].date_from)} a{' '}
                                                    {formatDate(req.date_ranges[0].date_to)}
                                                </span>
                                            ) : 'N/A'}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">{req.total_days}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">{req.manager_name || 'Desconocido'}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-500">{getStatusBadge(req.status)}</td>
                                        <td className="px-3 py-4 text-xs text-gray-700 max-w-xs">
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

            {/* Movimientos de días — timeline con colores */}
            <div>
                <h3 className="text-md font-medium text-gray-900 mb-4">Movimientos de Días (año actual)</h3>
                {movements.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay movimientos registrados este año.</p>
                ) : (
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-900 sm:pl-6">#</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Fecha</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Descripción</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-gray-900">Detalle</th>
                                    <th scope="col" className="px-3 py-3.5 text-right text-xs font-semibold text-gray-900 pr-6">Días</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {movements.map((mov) => {
                                    const rowBg = mov.type === 'credit' ? 'bg-green-50' : mov.type === 'seniority' ? 'bg-amber-50' : 'bg-red-50';
                                    const textColor = mov.type === 'credit' ? 'text-green-700' : mov.type === 'seniority' ? 'text-amber-600' : 'text-red-700';
                                    const sign = mov.type === 'credit' ? '+' : mov.type === 'seniority' ? '' : '-';
                                    return (
                                    <tr key={mov.id} className={rowBg}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-xs font-semibold sm:pl-6">
                                            <span className={textColor}>{mov.number}</span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-600">
                                            {formatDateTime(mov.date)}
                                        </td>
                                        <td className={`whitespace-nowrap px-3 py-4 text-xs font-medium ${textColor}`}>
                                            {mov.description}
                                        </td>
                                        <td className="px-3 py-4 text-xs text-gray-500 max-w-xs truncate" title={mov.detail}>
                                            {mov.detail}
                                        </td>
                                        <td className={`whitespace-nowrap px-3 py-4 text-xs font-bold text-right pr-6 ${textColor}`}>
                                            {sign}{mov.days}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
