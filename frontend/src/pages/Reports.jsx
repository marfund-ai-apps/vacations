import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Download, Filter, X } from 'lucide-react';

const MONTHS = [
    { value: 0, label: 'Todos los meses' },
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
];

const MANAGER_ROLES = ['manager', 'hr_admin', 'super_admin'];

export default function Reports() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtros que van al backend
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(0);

    // Filtros client-side
    const [selectedManager, setSelectedManager] = useState('');
    const [typeFilters, setTypeFilters] = useState({ vacation: false, permission: false, absence: false, seniority: false });
    const [benefitFilter, setBenefitFilter] = useState(false);

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({ year });
                if (month > 0) params.append('month', month);
                const res = await api.get(`/reports/all?${params}`);
                setReportData(res.data.employees || []);
            } catch (error) {
                console.error("Error fetching reports:", error);
                toast.error("Error al cargar los reportes generales.");
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, [year, month]);

    // Lista de supervisores únicos (solo roles de supervisor)
    const managers = useMemo(() => {
        const map = new Map();
        reportData.forEach(e => {
            if (e.manager_id && e.manager_name && MANAGER_ROLES.includes(e.manager_role)) {
                map.set(e.manager_id, { id: e.manager_id, name: e.manager_name });
            }
        });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [reportData]);

    // Datos filtrados client-side
    const filteredData = useMemo(() => {
        const anyTypeChecked = Object.values(typeFilters).some(v => v);
        return reportData.filter(emp => {
            if (selectedManager && String(emp.manager_id) !== String(selectedManager)) return false;
            if (benefitFilter && !emp.benefit_extra_day) return false;
            if (anyTypeChecked) {
                const match =
                    (typeFilters.vacation  && parseFloat(emp.vacation_days) > 0) ||
                    (typeFilters.permission && parseFloat(emp.permission_days) > 0) ||
                    (typeFilters.absence   && parseFloat(emp.absence_days) > 0) ||
                    (typeFilters.seniority && parseFloat(emp.seniority_benefit_days) > 0);
                if (!match) return false;
            }
            return true;
        });
    }, [reportData, selectedManager, typeFilters, benefitFilter]);

    const activeFilterCount = [
        selectedManager !== '',
        benefitFilter,
        ...Object.values(typeFilters),
    ].filter(Boolean).length;

    const resetFilters = () => {
        setSelectedManager('');
        setTypeFilters({ vacation: false, permission: false, absence: false, seniority: false });
        setBenefitFilter(false);
    };

    const handleExportCSV = () => {
        if (!filteredData.length) return;
        const headers = ["Código Colaborador", "Nombre", "Email", "Posición", "Supervisor", "Días Base", "Vacaciones Consumidas", "Permisos (info)", "Ausencias (info)", "B. Antigüedad (info)", "Saldo Final"];
        const rows = filteredData.map(emp => {
            const vacDays = parseFloat(emp.vacation_days) || 0;
            const baseDays = parseFloat(emp.base_vacation_days) || 0;
            return [
                emp.employee_number || '',
                `"${emp.full_name}"`,
                emp.email,
                `"${emp.position || ''}"`,
                `"${emp.manager_name || ''}"`,
                baseDays,
                vacDays,
                parseFloat(emp.permission_days) || 0,
                parseFloat(emp.absence_days) || 0,
                parseFloat(emp.seniority_benefit_days) || 0,
                (baseDays - vacDays).toFixed(2),
            ];
        });
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `reporte_vacaciones_${year}${month > 0 ? `_${MONTHS[month].label}` : ''}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const monthLabel = month > 0 ? MONTHS[month].label : '';

    return (
        <div className="px-4 sm:px-6 lg:px-8">
            {/* Encabezado */}
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold leading-6 text-gray-900">Reportes Generales</h1>
                    <p className="mt-1 text-sm text-gray-700">
                        Resumen de días consumidos por todos los colaboradores
                        {monthLabel ? ` — ${monthLabel} ${year}` : ` — año ${year}`}.
                        {filteredData.length !== reportData.length && (
                            <span className="ml-2 text-indigo-600 font-medium">
                                Mostrando {filteredData.length} de {reportData.length}
                            </span>
                        )}
                    </p>
                </div>
                <div className="mt-4 sm:mt-0">
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={!filteredData.length}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Panel de filtros */}
            <div className="mt-4 rounded-lg bg-gray-50 ring-1 ring-gray-200 px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Filtros</span>
                    {activeFilterCount > 0 && (
                        <button onClick={resetFilters} className="ml-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
                            <X className="w-3 h-3" /> Limpiar filtros ({activeFilterCount})
                        </button>
                    )}
                </div>

                {/* Fila 1: Año / Mes / Supervisor / Beneficio */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
                        <select
                            value={year}
                            onChange={e => setYear(e.target.value)}
                            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 text-sm"
                        >
                            {[2023, 2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
                        <select
                            value={month}
                            onChange={e => setMonth(parseInt(e.target.value))}
                            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 text-sm"
                        >
                            {MONTHS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Supervisor / Coordinador</label>
                        <select
                            value={selectedManager}
                            onChange={e => setSelectedManager(e.target.value)}
                            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 text-sm min-w-48"
                        >
                            <option value="">Todos los supervisores</option>
                            {managers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 pb-1.5">
                        <input
                            id="benefitFilter"
                            type="checkbox"
                            checked={benefitFilter}
                            onChange={e => setBenefitFilter(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                        <label htmlFor="benefitFilter" className="text-sm text-gray-700 cursor-pointer select-none whitespace-nowrap">
                            Solo con Beneficio Antigüedad
                        </label>
                    </div>
                </div>

                {/* Fila 2: Filtrar por tipo */}
                <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Mostrar solo empleados con:</span>
                    {[
                        { key: 'vacation',   label: 'Vacaciones',      color: 'text-red-600'   },
                        { key: 'permission', label: 'Permisos',         color: 'text-gray-500'  },
                        { key: 'absence',    label: 'Ausencias',        color: 'text-gray-500'  },
                        { key: 'seniority',  label: 'B. Antigüedad',   color: 'text-amber-600' },
                    ].map(({ key, label, color }) => (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={typeFilters[key]}
                                onChange={e => setTypeFilters(prev => ({ ...prev, [key]: e.target.checked }))}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                            />
                            <span className={`text-sm font-medium ${color}`}>{label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Tabla */}
            <div className="mt-4 flow-root">
                <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            {loading ? (
                                <div className="flex justify-center items-center h-32">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-300">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-24">Código</th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Colaborador</th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-500">Supervisor</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 bg-blue-50">Días Base</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-red-700">Vacaciones</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-500">Permisos</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-500">Ausencias</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-amber-600">B. Antigüedad</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 bg-indigo-50">Saldo Final</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {filteredData.length === 0 ? (
                                            <tr>
                                                <td colSpan="9" className="py-8 text-center text-sm text-gray-500">
                                                    {reportData.length === 0
                                                        ? 'No hay datos para el período seleccionado.'
                                                        : 'Ningún colaborador coincide con los filtros aplicados.'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredData.map((emp) => {
                                                const vacDays = parseFloat(emp.vacation_days) || 0;
                                                const baseDays = parseFloat(emp.base_vacation_days) || 0;
                                                const saldoFinal = baseDays - vacDays;
                                                return (
                                                    <tr key={emp.id}>
                                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                            <span className="font-mono font-semibold text-indigo-600 text-xs">{emp.employee_number || '—'}</span>
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                            <div className="font-medium text-gray-900 flex items-center gap-2">
                                                                {emp.full_name}
                                                                {emp.benefit_extra_day ? (
                                                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${parseFloat(emp.seniority_benefit_days) > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                        {parseFloat(emp.seniority_benefit_days) > 0 ? 'Beneficio usado' : 'Beneficio disponible'}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                            <div className="text-gray-500 text-xs">{emp.email}</div>
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-xs text-gray-400">
                                                            {emp.manager_name || '—'}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-blue-700 text-center bg-blue-50">
                                                            {baseDays}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-red-600 text-center font-medium">
                                                            {vacDays > 0 ? `-${vacDays}` : '0'}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-400 text-center">
                                                            {parseFloat(emp.permission_days) || 0}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-400 text-center">
                                                            {parseFloat(emp.absence_days) || 0}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-amber-600 text-center font-medium">
                                                            {parseFloat(emp.seniority_benefit_days) > 0 ? parseFloat(emp.seniority_benefit_days) : '—'}
                                                        </td>
                                                        <td className={`whitespace-nowrap px-3 py-4 text-sm font-bold text-center bg-indigo-50 ${saldoFinal < 0 ? 'text-red-600' : 'text-indigo-600'}`}>
                                                            {saldoFinal.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
