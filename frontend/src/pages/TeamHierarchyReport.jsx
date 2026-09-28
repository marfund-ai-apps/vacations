import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Download, Filter, ShieldCheck, Users } from 'lucide-react';
import { REPORT_YEARS, isFutureYear } from '../utils/reportYears';

const MONTHS = [
    { value: 0, label: 'Todos los meses' },
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
];

export default function TeamHierarchyReport() {
    const [reportData, setReportData] = useState([]);
    const [rootManager, setRootManager] = useState(null);
    const [loading, setLoading] = useState(true);

    // Filtros que van al backend
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(0);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({ year });
                if (month > 0) params.append('month', month);
                const res = await api.get(`/reports/team-hierarchy?${params}`);
                // Defensa extra: un colaborador aparece una sola vez
                const seen = new Set();
                const unique = (res.data.employees || []).filter(emp => {
                    if (seen.has(emp.id)) return false;
                    seen.add(emp.id);
                    return true;
                });
                setReportData(unique);
                setRootManager(res.data.root_manager || null);
            } catch (error) {
                console.error("Error fetching hierarchy report:", error);
                toast.error("Error al cargar el reporte de equipos.");
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [year, month]);

    // Agrupar por supervisor inmediato (equipo directo primero)
    const groups = useMemo(() => {
        const map = new Map();
        for (const emp of reportData) {
            const key = emp.manager_id ?? 'sin';
            if (!map.has(key)) {
                map.set(key, { managerId: emp.manager_id, supervisor: emp.manager_name || '—', rows: [] });
            }
            map.get(key).rows.push(emp);
        }
        const arr = [...map.values()];
        const rootId = rootManager?.id;
        arr.sort((a, b) => {
            if (rootId != null) {
                if (a.managerId === rootId) return -1;
                if (b.managerId === rootId) return 1;
            }
            return String(a.supervisor).localeCompare(String(b.supervisor), 'es', { sensitivity: 'base' });
        });
        return arr;
    }, [reportData, rootManager]);

    const handleExportCSV = () => {
        if (!reportData.length) return;
        const headers = ["Equipo de", "Código Colaborador", "Nombre", "Email", "Posición", "Es Supervisor", "Días Base", "Incrementos", "Vacaciones Consumidas", "Permisos (info)", "Ausencias (info)", "B. Antigüedad (info)", "Saldo Final"];
        const rows = reportData.map(emp => {
            const vacDays = parseFloat(emp.vacation_days) || 0;
            const baseDays = parseFloat(emp.base_vacation_days) || 0;
            const extraDays = parseFloat(emp.extra_days) || 0;
            return [
                `"${emp.manager_name || ''}"`,
                emp.employee_number || '',
                `"${emp.full_name}"`,
                emp.email,
                `"${emp.position || ''}"`,
                emp.is_supervisor ? 'Sí' : 'No',
                baseDays,
                extraDays,
                vacDays,
                parseFloat(emp.permission_days) || 0,
                parseFloat(emp.absence_days) || 0,
                parseFloat(emp.seniority_benefit_days) || 0,
                (baseDays + extraDays - vacDays).toFixed(2),
            ];
        });
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `reporte_equipos_subsupervision_${year}${month > 0 ? `_${MONTHS[month].label}` : ''}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const monthLabel = month > 0 ? MONTHS[month].label : '';

    const renderRow = (emp) => {
        const vacDays = parseFloat(emp.vacation_days) || 0;
        const baseDays = parseFloat(emp.base_vacation_days) || 0;
        const extraDays = parseFloat(emp.extra_days) || 0;
        const saldoFinal = baseDays + extraDays - vacDays;
        return (
            <tr key={emp.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <span className="font-mono font-semibold text-indigo-600 text-xs">{emp.employee_number || '—'}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                        {emp.full_name}
                        {emp.is_supervisor ? (
                            <span
                                title="Supervisor — tiene colaboradores a su cargo"
                                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium bg-indigo-100 text-indigo-700"
                            >
                                <ShieldCheck className="w-3 h-3" /> Supervisor
                            </span>
                        ) : null}
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
                <td className="whitespace-nowrap px-3 py-4 text-sm text-green-700 text-center font-medium bg-green-50">
                    {extraDays > 0 ? `+${extraDays}` : '0'}
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
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8">
            {/* Encabezado */}
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold leading-6 text-gray-900">Reporte de Equipos (Sub-supervisión)</h1>
                    <p className="mt-1 text-sm text-gray-700">
                        Tu equipo directo y los equipos a cargo de tus supervisores
                        {monthLabel ? ` — ${monthLabel} ${year}` : ` — año ${year}`}.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0">
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={!reportData.length}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Panel de filtros: Año / Mes */}
            <div className="mt-4 rounded-lg bg-gray-50 ring-1 ring-gray-200 px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Filtros</span>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
                        <select
                            value={year}
                            onChange={e => setYear(e.target.value)}
                            className="rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 text-sm"
                        >
                            {REPORT_YEARS.map(y => (
                                <option key={y} value={y} disabled={isFutureYear(y)}>{y}</option>
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
                </div>
            </div>

            {/* Contenido: secciones por sub-equipo */}
            {loading ? (
                <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : reportData.length === 0 ? (
                <div className="mt-6 rounded-lg ring-1 ring-gray-200 bg-white py-10 text-center text-sm text-gray-500">
                    No tienes colaboradores a tu cargo para el período seleccionado.
                </div>
            ) : (
                <div className="mt-6 space-y-8">
                    {groups.map((group) => {
                        const isRoot = rootManager?.id != null && group.managerId === rootManager.id;
                        return (
                            <div key={group.managerId ?? 'sin'}>
                                {/* Encabezado de la sección */}
                                <div className="flex items-center gap-2 mb-2">
                                    <Users className="w-4 h-4 text-indigo-600" />
                                    <h2 className="text-sm font-semibold text-gray-900">
                                        Equipo de {group.supervisor}
                                    </h2>
                                    <span className="text-xs text-gray-400">
                                        ({isRoot ? 'equipo directo' : 'sub-supervisión'} · {group.rows.length} {group.rows.length === 1 ? 'colaborador' : 'colaboradores'})
                                    </span>
                                </div>

                                <div className="flow-root">
                                    <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                                        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                                                <table className="min-w-full divide-y divide-gray-300">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-24">Código</th>
                                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Colaborador</th>
                                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-500">Supervisor</th>
                                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 bg-blue-50">Días Base</th>
                                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-green-700 bg-green-50">Incrementos</th>
                                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-red-700">Vacaciones</th>
                                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-500">Permisos</th>
                                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-500">Ausencias</th>
                                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-amber-600">B. Antigüedad</th>
                                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 bg-indigo-50">Saldo Final</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200 bg-white">
                                                        {group.rows.map(renderRow)}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-indigo-600" />
                        = Colaborador que además es supervisor (tiene equipo a su cargo).
                    </p>
                </div>
            )}
        </div>
    );
}
