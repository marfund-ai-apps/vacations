import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';

export default function Reports() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetchReports = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/reports/all?year=${year}`);
                setReportData(res.data.employees || []);
            } catch (error) {
                console.error("Error fetching reports:", error);
                toast.error("Error al cargar los reportes generales.");
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [year]);

    const handleExportCSV = () => {
        if (!reportData.length) return;

        const headers = ["ID", "Nombre", "Email", "Posición", "Días Vacaciones", "Días Permiso", "Días Ausencia", "Total Días", "Total Solicitudes"];
        const rows = reportData.map(emp => [
            emp.id,
            `"${emp.full_name}"`,
            emp.email,
            `"${emp.position || ''}"`,
            emp.vacation_days,
            emp.permission_days,
            emp.absence_days,
            emp.total_days,
            emp.total_requests
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_vacaciones_${year}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-xl font-semibold leading-6 text-gray-900">Reportes Generales</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Resumen de días consumidos por todos los empleados en el año {year}.
                    </p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex space-x-4 items-center">
                    <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    >
                        <option value={2023}>2023</option>
                        <option value={2024}>2024</option>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                    </select>
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Exportar CSV
                    </button>
                </div>
            </div>

            <div className="mt-8 flow-root">
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
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Empleado</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Vacaciones</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Permisos</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Ausencias</th>
                                            <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 bg-indigo-50">Total Consumido</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {reportData.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="py-8 text-center text-sm text-gray-500">
                                                    No hay datos para el año seleccionado.
                                                </td>
                                            </tr>
                                        ) : (
                                            reportData.map((emp) => (
                                                <tr key={emp.id}>
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                        <div className="font-medium text-gray-900">{emp.full_name}</div>
                                                        <div className="text-gray-500">{emp.email}</div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                                                        {parseFloat(emp.vacation_days)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                                                        {parseFloat(emp.permission_days)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                                                        {parseFloat(emp.absence_days)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-indigo-600 text-center bg-indigo-50">
                                                        {parseFloat(emp.total_days)}
                                                    </td>
                                                </tr>
                                            ))
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
