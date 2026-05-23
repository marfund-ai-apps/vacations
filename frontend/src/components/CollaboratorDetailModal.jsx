import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../services/api';
import { formatDateTime } from '../utils/dateUtils';

export default function CollaboratorDetailModal({ userId, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/reports/employee/${userId}/detail`)
            .then(res => setData(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [userId]);

    const colorClass = (type) => {
        if (type === 'credit')   return { row: 'bg-green-50',  number: 'text-green-700', days: 'text-green-700 font-bold', sign: '+' };
        if (type === 'debit')    return { row: 'bg-red-50',    number: 'text-red-600',   days: 'text-red-600 font-bold',   sign: '-' };
        if (type === 'seniority') return { row: 'bg-amber-50', number: 'text-amber-600', days: 'text-amber-600 font-bold', sign: '' };
        return                           { row: 'bg-gray-50',  number: 'text-gray-500',  days: 'text-gray-500',            sign: '' };
    };

    const Icon = ({ type }) => {
        if (type === 'credit')   return <TrendingUp className="w-3.5 h-3.5 text-green-600 inline mr-1" />;
        if (type === 'debit')    return <TrendingDown className="w-3.5 h-3.5 text-red-500 inline mr-1" />;
        if (type === 'seniority') return <TrendingUp className="w-3.5 h-3.5 text-amber-500 inline mr-1" />;
        return <Minus className="w-3.5 h-3.5 text-gray-400 inline mr-1" />;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Resumen del Colaborador</h2>
                    <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    </div>
                ) : !data ? (
                    <div className="flex-1 flex items-center justify-center text-gray-500 py-16">
                        No se pudo cargar la información.
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                        {/* Info del colaborador */}
                        <div className="flex items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {data.user.employee_number && (
                                        <span className="font-mono font-semibold text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                                            {data.user.employee_number}
                                        </span>
                                    )}
                                    <h3 className="text-xl font-bold text-gray-900">{data.user.full_name}</h3>
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5">{data.user.email}</p>
                                <p className="text-sm text-gray-500">{data.user.position || '—'}</p>
                                {data.user.manager_name && (
                                    <p className="text-xs text-gray-400 mt-1">Supervisor: {data.user.manager_name}</p>
                                )}
                            </div>
                        </div>

                        {/* Widgets de resumen */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-lg bg-blue-50 ring-1 ring-blue-200 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-blue-600">Días Base Actuales</p>
                                <p className="text-2xl font-bold text-blue-700 mt-1">{data.summary.base_days}</p>
                            </div>
                            <div className="rounded-lg bg-red-50 ring-1 ring-red-200 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-red-600">Vacaciones Consumidas</p>
                                <p className="text-2xl font-bold text-red-600 mt-1">-{data.summary.consumed_days}</p>
                            </div>
                            <div className="rounded-lg bg-indigo-50 ring-1 ring-indigo-400 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-indigo-600">Disponibles Hoy</p>
                                <p className={`text-2xl font-bold mt-1 ${data.summary.available_days < 0 ? 'text-red-600' : 'text-indigo-700'}`}>
                                    {data.summary.available_days.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {/* Tabla de movimientos */}
                        <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Historial de Movimientos</h4>
                            <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Fecha</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"># Número</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Tipo</th>
                                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Días</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Motivo / Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {data.movements.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="py-8 text-center text-gray-400">
                                                    Sin movimientos registrados.
                                                </td>
                                            </tr>
                                        ) : data.movements.map(mov => {
                                            const c = colorClass(mov.color_type);
                                            return (
                                                <tr key={mov.id} className={c.row}>
                                                    <td className="whitespace-nowrap py-3 pl-4 pr-3 text-gray-600">
                                                        {formatDateTime(mov.date)}
                                                    </td>
                                                    <td className={`whitespace-nowrap px-3 py-3 font-mono font-semibold text-xs ${c.number}`}>
                                                        {mov.number}
                                                    </td>
                                                    <td className="px-3 py-3 text-gray-700">
                                                        <Icon type={mov.color_type} />
                                                        {mov.type_label}
                                                    </td>
                                                    <td className={`whitespace-nowrap px-3 py-3 text-center ${c.days}`}>
                                                        {c.sign}{mov.days}
                                                    </td>
                                                    <td className="px-3 py-3 text-gray-500 max-w-xs">
                                                        <p className="truncate" title={mov.reason}>{mov.reason || '—'}</p>
                                                        {mov.detail && <p className="text-xs text-gray-400">{mov.detail}</p>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
                    <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
