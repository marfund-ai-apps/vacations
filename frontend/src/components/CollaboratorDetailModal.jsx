import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Ban, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';
import { formatDateTime } from '../utils/dateUtils';

export default function CollaboratorDetailModal({ userId, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    // Filtro por tipo de movimiento (los incrementos/saldo inicial siempre se muestran)
    const [filters, setFilters] = useState({
        vacation: true,
        permission: true,
        absence: true,
        seniority: true,
    });
    const toggleFilter = (key) => setFilters(f => ({ ...f, [key]: !f[key] }));

    const FILTER_DEFS = [
        { key: 'vacation', label: 'Vacaciones' },
        { key: 'permission', label: 'Permisos' },
        { key: 'absence', label: 'Ausencias' },
        { key: 'seniority', label: 'Bono Beneficio' },
    ];

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
        if (type === 'annulled') return  { row: 'bg-gray-50 opacity-60', number: 'text-gray-400', days: 'text-gray-400 line-through', sign: '' };
        return                           { row: 'bg-gray-50',  number: 'text-gray-500',  days: 'text-gray-500',            sign: '' };
    };

    const Icon = ({ type }) => {
        if (type === 'credit')   return <TrendingUp className="w-3.5 h-3.5 text-green-600 inline mr-1" />;
        if (type === 'debit')    return <TrendingDown className="w-3.5 h-3.5 text-red-500 inline mr-1" />;
        if (type === 'seniority') return <TrendingUp className="w-3.5 h-3.5 text-amber-500 inline mr-1" />;
        if (type === 'annulled') return  <Ban className="w-3.5 h-3.5 text-gray-400 inline mr-1" />;
        return <Minus className="w-3.5 h-3.5 text-gray-400 inline mr-1" />;
    };

    // Deriva la categoría del movimiento; con fallback por color_type si el backend
    // aún no envía `category` (evita esconder todo el historial durante un deploy parcial).
    const catOf = (m) => {
        if (m.category) return m.category;
        if (m.color_type === 'credit') return 'credit';
        if (m.color_type === 'debit') return 'vacation';
        if (m.color_type === 'seniority') return 'seniority';
        return null; // info/annulled sin category: no distinguible → siempre visible
    };
    // Etiqueta "Tipo de Solicitud" (como el dropdown de Nueva Solicitud)
    const SOLICITUD_LABEL = {
        vacation: 'Vacaciones',
        permission: 'Permiso Personal',
        absence: 'Ausencia Justificada',
        seniority: 'Bono Beneficio',
    };
    const solicitudLabel = (m) => SOLICITUD_LABEL[catOf(m)] || '—';
    // Los créditos (saldo inicial e incrementos) siempre se muestran; el resto según los checks
    const visibleMovements = data
        ? data.movements.filter(m => {
            const c = catOf(m);
            return c === 'credit' || c == null || filters[c];
        })
        : [];

    // Exporta el historial visible (respeta los filtros activos) a Excel (.xlsx)
    const generateExcel = async () => {
        if (!data) return;
        const XLSX = await import('xlsx'); // carga on-demand para no inflar el bundle
        const header = ['Fecha', '# Número', 'Ref.', 'Tipo de Solicitud', 'Días', 'Motivo / Detalle'];
        const rows = visibleMovements.map(m => {
            const c = colorClass(m.color_type);
            const motivo = [m.reason || '—', m.detail || ''].filter(Boolean).join(' — ');
            return [
                formatDateTime(m.date),
                m.number || '—',
                m.type_label || '',
                solicitudLabel(m),
                `${c.sign}${m.days}`,
                motivo,
            ];
        });

        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 8 }, { wch: 50 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');

        const codigo = data.user.employee_number || data.user.id;
        const nombre = (data.user.full_name || 'colaborador').replace(/[^\w\sáéíóúñ]/gi, '').replace(/\s+/g, '_');
        XLSX.writeFile(wb, `Historial_${codigo}_${nombre}.xlsx`);
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
                        <div className="flex items-start justify-between gap-4">
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
                            <button
                                onClick={generateExcel}
                                className="shrink-0 inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                Generar Excel
                            </button>
                        </div>

                        {/* Widgets de resumen — mismas tarjetas que el Dashboard */}
                        {/* Fila 1: solo vacaciones */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="rounded-lg bg-white ring-1 ring-gray-200 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-gray-500">Saldo Inicial</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.base_days}</p>
                            </div>
                            <div className="rounded-lg bg-green-50 ring-1 ring-green-300 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-green-600">Días Vacaciones Agregados</p>
                                <p className="text-2xl font-bold text-green-700 mt-1">+{(parseFloat(data.summary.extra_days) || 0).toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg bg-red-50 ring-1 ring-red-300 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-red-600">Días Consumidos</p>
                                <p className="text-2xl font-bold text-red-600 mt-1">-{data.summary.consumed_days}</p>
                            </div>
                            <div className="rounded-lg bg-indigo-50 ring-1 ring-indigo-400 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-indigo-600">Días Vacaciones Disponibles Hoy</p>
                                <p className={`text-2xl font-bold mt-1 ${data.summary.available_days < 0 ? 'text-red-600' : 'text-indigo-700'}`}>
                                    {data.summary.available_days.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        {/* Fila 2: bono + informativos */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-amber-700">Bono por antigüedad</p>
                                <p className="text-2xl font-bold text-amber-700 mt-1">{Number(data.summary.bono_allot ?? 0)}</p>
                            </div>
                            <div className="rounded-lg bg-white ring-1 ring-gray-200 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-gray-400">Bono usado (año)</p>
                                <p className="text-2xl font-bold text-gray-600 mt-1">{Number(data.summary.bono_used ?? 0).toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg bg-amber-50 ring-1 ring-amber-300 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-amber-700">Días Beneficio disponibles</p>
                                <p className="text-2xl font-bold text-amber-700 mt-1">{Number(data.summary.bono_avail ?? 0).toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg bg-sky-50 ring-1 ring-sky-200 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-sky-700">Permisos Personales</p>
                                <p className="text-2xl font-bold text-sky-700 mt-1">{Number(data.summary.permission_days ?? 0)}</p>
                            </div>
                            <div className="rounded-lg bg-violet-50 ring-1 ring-violet-200 px-4 py-3 text-center">
                                <p className="text-xs font-medium text-violet-700">Ausencia Justificada</p>
                                <p className="text-2xl font-bold text-violet-700 mt-1">{Number(data.summary.absence_days ?? 0)}</p>
                            </div>
                        </div>

                        {/* Tabla de movimientos */}
                        <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                                <h4 className="text-sm font-semibold text-gray-700">Historial de Movimientos</h4>
                                <div className="flex flex-wrap items-center gap-3">
                                    {FILTER_DEFS.map(f => (
                                        <label key={f.key} className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={filters[f.key]}
                                                onChange={() => toggleFilter(f.key)}
                                                className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            {f.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Fecha</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"># Número</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Ref.</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Tipo de Solicitud</th>
                                            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Días</th>
                                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-2/5">Motivo / Detalle</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {visibleMovements.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="py-8 text-center text-gray-400">
                                                    Sin movimientos para los filtros seleccionados.
                                                </td>
                                            </tr>
                                        ) : visibleMovements.map(mov => {
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
                                                    <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                                                        {solicitudLabel(mov)}
                                                    </td>
                                                    <td className={`whitespace-nowrap px-3 py-3 text-center ${c.days}`}>
                                                        {c.sign}{mov.days}
                                                    </td>
                                                    <td className="px-3 py-3 text-gray-500 w-2/5 align-top">
                                                        <p className="whitespace-normal break-words">{mov.reason || '—'}</p>
                                                        {mov.detail && <p className="text-xs text-gray-400 whitespace-normal break-words">{mov.detail}</p>}
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
