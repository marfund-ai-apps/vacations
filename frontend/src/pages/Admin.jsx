import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight, Download, FileBarChart2, Upload, CheckCircle, AlertCircle, X, PlusCircle } from 'lucide-react';
import CollaboratorDetailModal from '../components/CollaboratorDetailModal';
import { formatDateTime } from '../utils/dateUtils';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 'Todos'];

export default function Admin() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Edición en modal
    const [editModal, setEditModal] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editSaving, setEditSaving] = useState(false);

    // Creación inline
    const [isCreating, setIsCreating] = useState(false);
    const [newForm, setNewForm] = useState({ full_name: '', email: '', employee_number: '', position: '', base_vacation_days: 15, role: 'employee', manager_id: '', benefit_extra_day: false, benefit_extra_day_used: false });

    // Modal ajuste de días
    const [adjustModal, setAdjustModal] = useState(null);
    const [adjustForm, setAdjustForm] = useState({ days_added: '', reason: '' });

    // Modal resumen detallado del colaborador
    const [detailUserId, setDetailUserId] = useState(null);

    // Carga de saldos desde CSV — flujo de dos pasos: previsualizar → confirmar
    const [importInfoModal, setImportInfoModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importPreview, setImportPreview] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importConfirming, setImportConfirming] = useState(false);
    const [importResult, setImportResult] = useState(null);

    const handleImportFileSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setImportInfoModal(false);
        setImportFile(file);
        setImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/users/preview-balances', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportPreview({ ...res.data, filename: file.name });
        } catch (error) {
            toast.error(error.response?.data?.message || 'El archivo no cumple con el formato requerido.');
            setImportFile(null);
        } finally {
            setImporting(false);
        }
    };

    const handleImportConfirm = async () => {
        if (!importFile) return;
        setImportConfirming(true);
        try {
            const formData = new FormData();
            formData.append('file', importFile);
            const res = await api.post('/users/import-balances', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportPreview(null);
            setImportFile(null);
            setImportResult(res.data);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al procesar el archivo');
        } finally {
            setImportConfirming(false);
        }
    };

    const handleImportCancel = () => {
        setImportPreview(null);
        setImportFile(null);
    };

    // Filtros y paginación
    const [searchTerm, setSearchTerm] = useState('');
    const [filterManagerId, setFilterManagerId] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, managersRes] = await Promise.all([
                api.get('/users'),
                api.get('/users/managers')
            ]);
            setUsers(usersRes.data);
            setManagers(managersRes.data);
        } catch (error) {
            console.error("Error fetching admin data:", error);
            toast.error("Error al cargar la lista de usuarios.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Resetear página al cambiar filtros
    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterManagerId, pageSize]);

    // Filtrado derivado
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchSearch = searchTerm.trim() === '' ||
                u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchManager = filterManagerId === '' ||
                String(u.manager_id) === String(filterManagerId);
            return matchSearch && matchManager;
        });
    }, [users, searchTerm, filterManagerId]);

    // Paginación derivada
    const totalPages = pageSize === 'Todos' ? 1 : Math.ceil(filteredUsers.length / pageSize);
    const paginatedUsers = useMemo(() => {
        if (pageSize === 'Todos') return filteredUsers;
        const start = (currentPage - 1) * pageSize;
        return filteredUsers.slice(start, start + pageSize);
    }, [filteredUsers, pageSize, currentPage]);

    // Handlers edición en modal
    const handleOpenEdit = (u) => {
        setEditModal(u);
        setEditForm({
            full_name: u.full_name || '',
            employee_number: u.employee_number || '',
            position: u.position || '',
            role: u.role,
            manager_id: u.manager_id || '',
            base_vacation_days: u.base_vacation_days || 15,
            is_active: !!u.is_active,
            benefit_extra_day: !!u.benefit_extra_day,
            benefit_extra_day_used: !!u.benefit_extra_day_used,
        });
    };

    const handleSaveEdit = async () => {
        setEditSaving(true);
        try {
            await api.put(`/users/${editModal.id}`, {
                ...editForm,
                manager_id: editForm.manager_id || null
            });
            toast.success("Colaborador actualizado correctamente");
            setEditModal(null);
            fetchData();
        } catch (error) {
            console.error("Error updating user:", error);
            toast.error("Error al actualizar colaborador");
        } finally {
            setEditSaving(false);
        }
    };

    const handleCreate = async () => {
        try {
            await api.post('/users', { ...newForm, manager_id: newForm.manager_id || null });
            toast.success("Colaborador creado correctamente");
            setIsCreating(false);
            setNewForm({ full_name: '', email: '', employee_number: '', position: '', base_vacation_days: 15, role: 'employee', manager_id: '', benefit_extra_day: false, benefit_extra_day_used: false });
            fetchData();
        } catch (error) {
            console.error("Error creating user:", error);
            toast.error(error.response?.data?.message || "Error al crear colaborador");
        }
    };

    const openAdjustModal = (u) => {
        setAdjustModal({ userId: u.id, userName: u.full_name });
        setAdjustForm({ days_added: '', reason: '' });
    };

    const handleAdjustDays = async () => {
        if (!adjustForm.days_added || parseFloat(adjustForm.days_added) <= 0)
            return toast.error('La cantidad de días debe ser mayor a 0');
        if (!adjustForm.reason.trim())
            return toast.error('El motivo es obligatorio');
        try {
            const res = await api.post(`/users/${adjustModal.userId}/day-adjustments`, {
                days_added: parseFloat(adjustForm.days_added),
                reason: adjustForm.reason.trim()
            });
            toast.success(res.data.message);
            setAdjustModal(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al agregar días');
        }
    };

    const handleDeactivate = async (id, name) => {
        if (!window.confirm(`¿Estás seguro de que deseas desactivar a ${name}? Su historial se mantendrá pero ya no tendrá acceso al sistema.`)) return;
        try {
            await api.put(`/users/${id}/deactivate`);
            toast.success("Colaborador desactivado correctamente");
            fetchData();
        } catch (error) {
            console.error("Error deactivating user:", error);
            toast.error("Error al desactivar el colaborador");
        }
    };

    const handleExportCSV = () => {
        const label = filterManagerId
            ? `supervisor_${managers.find(m => String(m.id) === String(filterManagerId))?.full_name?.replace(/\s+/g, '_') || filterManagerId}`
            : 'todos';

        const headers = ['Código Colaborador', 'Nombre', 'Correo', 'Cargo', 'Rol', 'Supervisor Inmediato', 'Días Vac.'];
        const rows = filteredUsers.map(u => [
            u.employee_number || '',
            `"${u.full_name}"`,
            u.email,
            `"${u.position || ''}"`,
            u.role,
            `"${u.manager_name || ''}"`,
            u.base_vacation_days || 15
        ]);

        const csv = 'data:text/csv;charset=utf-8,'
            + headers.join(',') + '\n'
            + rows.map(r => r.join(',')).join('\n');

        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csv));
        link.setAttribute('download', `colaboradores_${label}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <>
        <div className="px-4 sm:px-6 lg:px-8">

            {/* Cabecera */}
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-xl font-semibold leading-6 text-gray-900">Administración de Usuarios</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Gestiona roles, puestos y asigna supervisores inmediatos a los colaboradores.
                    </p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex space-x-3">
                    {user?.role === 'super_admin' && (
                        <Link to="/admin/inactive" className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                            Ver Inactivos
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        title={`Exportar ${filterManagerId ? 'filtrados' : 'todos'} a CSV`}
                    >
                        <Download className="w-4 h-4 mr-2 text-gray-500" />
                        Exportar CSV
                        {filterManagerId && <span className="ml-1 text-xs text-indigo-600">(filtrado)</span>}
                    </button>
                    <button
                        type="button"
                        onClick={() => setImportInfoModal(true)}
                        disabled={importing}
                        className={`inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 ${importing ? 'opacity-60 pointer-events-none' : ''}`}
                        title="Cargar saldos iniciales desde CSV"
                    >
                        <Upload className="w-4 h-4 mr-2 text-gray-500" />
                        {importing ? 'Leyendo...' : 'Cargar Saldos'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCreating(true)}
                        className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                    >
                        Agregar Colaborador
                    </button>
                </div>
            </div>

            {/* Barra de filtros */}
            <div className="mt-6 flex flex-wrap gap-3 items-center">
                {/* Búsqueda por nombre */}
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre o correo..."
                        className="block w-full rounded-md border-0 py-1.5 pl-9 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    />
                </div>

                {/* Filtro por Supervisor */}
                <div className="min-w-[200px]">
                    <select
                        value={filterManagerId}
                        onChange={(e) => setFilterManagerId(e.target.value)}
                        className="block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    >
                        <option value="">— Todos los Supervisores —</option>
                        {managers.map(m => (
                            <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                    </select>
                </div>

                {/* Mostrar X por página */}
                <div className="flex items-center gap-2 ml-auto text-sm text-gray-600">
                    <span>Mostrar:</span>
                    {PAGE_SIZE_OPTIONS.map(size => (
                        <button
                            key={size}
                            onClick={() => setPageSize(size)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                                ${pageSize === size
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabla */}
            <div className="mt-4 flow-root">
                <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-24">Código</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-44">Colaborador</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-36">Cargo</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-28">Rol Sistema</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-40">Supervisor Inmediato</th>
                                        <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 w-20">Días Vac.</th>
                                        <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 w-28">Antigüedad</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 w-44">
                                            <span className="sr-only">Acciones</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {isCreating && (
                                        <tr className="bg-indigo-50">
                                            <td className="py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                <input type="text" placeholder="Código" value={newForm.employee_number}
                                                    onChange={(e) => setNewForm({ ...newForm, employee_number: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6" />
                                            </td>
                                            <td className="px-3 py-4 text-sm sm:pl-3 space-y-2">
                                                <input type="text" placeholder="Nombre Completo" value={newForm.full_name}
                                                    onChange={(e) => setNewForm({ ...newForm, full_name: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6" />
                                                <input type="email" placeholder="Correo Electrónico" value={newForm.email}
                                                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6" />
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500">
                                                <input type="text" placeholder="Puesto" value={newForm.position}
                                                    onChange={(e) => setNewForm({ ...newForm, position: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6" />
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500">
                                                <select value={newForm.role} onChange={(e) => setNewForm({ ...newForm, role: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6">
                                                    <option value="employee">Colaborador</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="hr_admin">RRHH Admin</option>
                                                    <option value="super_admin">Super Admin</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500">
                                                <select value={newForm.manager_id} onChange={(e) => setNewForm({ ...newForm, manager_id: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6">
                                                    <option value="">Ninguno</option>
                                                    {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500 text-center">
                                                <input type="number" value={newForm.base_vacation_days}
                                                    onChange={(e) => setNewForm({ ...newForm, base_vacation_days: e.target.value })}
                                                    className="block w-16 mx-auto rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6" />
                                            </td>
                                            <td className="px-3 py-4 text-sm text-center">
                                                <div className="flex flex-col items-start gap-1.5">
                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input type="checkbox" checked={newForm.benefit_extra_day}
                                                            onChange={(e) => setNewForm({ ...newForm, benefit_extra_day: e.target.checked })}
                                                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                                                        <span className="text-xs text-gray-600">Aplica</span>
                                                    </label>
                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input type="checkbox" checked={newForm.benefit_extra_day_used}
                                                            onChange={(e) => setNewForm({ ...newForm, benefit_extra_day_used: e.target.checked })}
                                                            className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                                        <span className="text-xs text-gray-600">Gozado</span>
                                                    </label>
                                                </div>
                                            </td>
                                            <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2">
                                                <button onClick={handleCreate} className="text-indigo-600 hover:text-indigo-900 block w-full text-right mb-2">Crear</button>
                                                <button onClick={() => setIsCreating(false)} className="text-gray-600 hover:text-gray-900 block w-full text-right">Cancelar</button>
                                            </td>
                                        </tr>
                                    )}

                                    {paginatedUsers.length === 0 && !isCreating ? (
                                        <tr>
                                            <td colSpan="8" className="py-10 text-center text-sm text-gray-500">
                                                No se encontraron colaboradores con los filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : paginatedUsers.map((u) => (
                                        <tr key={u.id} className="hover:bg-gray-50">
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                <span className="font-mono font-semibold text-indigo-600 text-xs">{u.employee_number || '—'}</span>
                                            </td>
                                            <td className="px-3 py-4 text-sm">
                                                <div className="font-medium text-gray-900">{u.full_name}</div>
                                                <div className="text-gray-500 text-xs">{u.email}</div>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500 max-w-[144px]">
                                                <span className="block break-words leading-snug">{u.position || '-'}</span>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap
                                                    ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                                                      u.role === 'hr_admin'    ? 'bg-blue-100 text-blue-800' :
                                                      u.role === 'manager'     ? 'bg-yellow-100 text-yellow-800' :
                                                                                 'bg-gray-100 text-gray-800'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500 max-w-[160px]">
                                                <span className="block break-words leading-snug">{u.manager_name || '-'}</span>
                                            </td>
                                            <td className="px-3 py-4 text-sm text-gray-500 text-center whitespace-nowrap">
                                                {u.base_vacation_days || 15}
                                            </td>
                                            <td className="px-3 py-4 text-sm text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    {u.benefit_extra_day ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">★ Aplica</span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">—</span>
                                                    )}
                                                    {u.benefit_extra_day && (
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${u.benefit_extra_day_used ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {u.benefit_extra_day_used ? 'Gozado' : 'Pendiente'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 whitespace-nowrap">
                                                <div className="flex justify-end gap-3">
                                                    <button onClick={() => openAdjustModal(u)} className="cursor-pointer text-green-600 hover:text-green-800 inline-flex items-center font-medium gap-1">
                                                        <PlusCircle className="w-3.5 h-3.5" /> Días
                                                    </button>
                                                    <button onClick={() => handleOpenEdit(u)} className="cursor-pointer text-indigo-600 hover:text-indigo-900 inline-flex items-center gap-1">
                                                        <Pencil className="w-3.5 h-3.5" /> Editar
                                                    </button>
                                                    <button onClick={() => setDetailUserId(u.id)} className="cursor-pointer text-violet-600 hover:text-violet-900 inline-flex items-center gap-1">
                                                        <FileBarChart2 className="w-3.5 h-3.5" /> Reporte
                                                    </button>
                                                    <button onClick={() => handleDeactivate(u.id, u.full_name)} className="cursor-pointer text-red-600 hover:text-red-900 inline-flex items-center gap-1">
                                                        <Trash2 className="w-3.5 h-3.5" /> Desactivar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Paginación */}
            {pageSize !== 'Todos' && filteredUsers.length > 0 && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                    <span>
                        Mostrando {Math.min((currentPage - 1) * pageSize + 1, filteredUsers.length)}–{Math.min(currentPage * pageSize, filteredUsers.length)} de {filteredUsers.length} colaboradores
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 rounded text-xs font-medium ${currentPage === page ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Modal: Instrucciones para Cargar Saldos */}
        {importInfoModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Cargar Saldos Iniciales</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Carga masiva desde archivo CSV o Excel</p>
                        </div>
                        <button onClick={() => setImportInfoModal(false)} className="cursor-pointer p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 space-y-4">

                        {/* Formato aceptado */}
                        <div className="flex items-start gap-3 rounded-lg bg-indigo-50 ring-1 ring-indigo-200 px-4 py-3">
                            <Upload className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-indigo-800">
                                <p className="font-semibold mb-0.5">Formato aceptado</p>
                                <p>Archivo <strong>.csv</strong> o <strong>.xlsx</strong> (Excel). Se recomienda exportar desde Excel como CSV.</p>
                            </div>
                        </div>

                        {/* Columnas requeridas */}
                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">Columnas requeridas</p>
                            <table className="w-full text-sm rounded-lg ring-1 ring-gray-200 overflow-hidden">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-2 pl-4 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Columna</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    <tr>
                                        <td className="py-2 pl-4 pr-3 font-mono text-xs text-indigo-700 font-semibold">No. Colaborador</td>
                                        <td className="px-3 py-2 text-gray-600 text-xs">Código del colaborador (también acepta <span className="font-mono">Código Colaborador</span>)</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 pl-4 pr-3 font-mono text-xs text-indigo-700 font-semibold">Saldo Inicial</td>
                                        <td className="px-3 py-2 text-gray-600 text-xs">Días de vacaciones a asignar (admite decimales: 7.5, 15.00)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Ejemplo */}
                        <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">Ejemplo de archivo</p>
                            <div className="rounded-lg bg-gray-900 text-green-400 font-mono text-xs px-4 py-3 space-y-1">
                                <p className="text-gray-400">No. Colaborador,Saldo Inicial</p>
                                <p>1110,15.00</p>
                                <p>1111,12.50</p>
                                <p>1142,7.50</p>
                            </div>
                        </div>

                        {/* Notas */}
                        <div className="text-xs text-gray-500 space-y-1">
                            <p>• El sistema mostrará una <strong>previsualización</strong> antes de guardar cualquier cambio.</p>
                            <p>• Los códigos que no coincidan con ningún colaborador se marcarán en <strong>amarillo</strong>.</p>
                            <p>• Los nombres de columna son sensibles a mayúsculas y espacios.</p>
                        </div>
                    </div>

                    {/* Footer con upload */}
                    <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                        <button onClick={() => setImportInfoModal(false)} className="cursor-pointer rounded-md px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                            Cancelar
                        </button>
                        <label className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                            <Upload className="w-4 h-4" />
                            Seleccionar archivo
                            <input type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportFileSelected} />
                        </label>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Ficha de edición del colaborador */}
        {editModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Ficha del Colaborador</h3>
                            <p className="text-xs text-gray-400 mt-0.5">{editModal.email}</p>
                        </div>
                        <button onClick={() => setEditModal(null)} className="cursor-pointer p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                        {/* Cabecera read-only */}
                        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                            {editModal.avatar_url ? (
                                <img src={editModal.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-200" />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xl font-bold">
                                    {editModal.full_name?.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {editModal.employee_number && (
                                        <span className="font-mono font-semibold text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{editModal.employee_number}</span>
                                    )}
                                    <span className="text-sm text-gray-500 truncate">{editModal.email}</span>
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                                    <span>Creado: {formatDateTime(editModal.created_at)}</span>
                                    <span>Actualizado: {formatDateTime(editModal.updated_at)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Información Personal */}
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Información Personal</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                                    <input type="text" value={editForm.full_name || ''}
                                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Código Colaborador</label>
                                    <input type="text" value={editForm.employee_number || ''}
                                        onChange={(e) => setEditForm({ ...editForm, employee_number: e.target.value })}
                                        className="block w-full rounded-md border-0 py-1.5 font-mono text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Puesto</label>
                                    <input type="text" value={editForm.position || ''}
                                        onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Días Base de Vacaciones</label>
                                    <input type="number" step="0.5" min="0" value={editForm.base_vacation_days || 0}
                                        onChange={(e) => setEditForm({ ...editForm, base_vacation_days: e.target.value })}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm" />
                                </div>
                            </div>
                        </div>

                        {/* Sistema */}
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sistema</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                                    <select value={editForm.role || 'employee'}
                                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm">
                                        <option value="employee">Colaborador</option>
                                        <option value="manager">Manager</option>
                                        <option value="hr_admin">RRHH Admin</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor Inmediato</label>
                                    <select value={editForm.manager_id || ''}
                                        onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value })}
                                        className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm">
                                        <option value="">Ninguno</option>
                                        {managers.map(m => m.id !== editModal.id && (
                                            <option key={m.id} value={m.id}>{m.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                        <input type="checkbox" checked={!!editForm.is_active}
                                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm font-medium text-gray-700">Colaborador activo en el sistema</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Beneficio Antigüedad */}
                        <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Beneficio Antigüedad</p>
                            <div className="space-y-3">
                                <label className="flex items-start gap-3 cursor-pointer select-none">
                                    <input type="checkbox" checked={!!editForm.benefit_extra_day}
                                        onChange={(e) => setEditForm({ ...editForm, benefit_extra_day: e.target.checked })}
                                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Aplica beneficio día adicional</p>
                                        <p className="text-xs text-gray-400">El colaborador es elegible para un día extra anual por antigüedad</p>
                                    </div>
                                </label>
                                <label className="flex items-start gap-3 cursor-pointer select-none">
                                    <input type="checkbox" checked={!!editForm.benefit_extra_day_used}
                                        onChange={(e) => setEditForm({ ...editForm, benefit_extra_day_used: e.target.checked })}
                                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Ya gozó el beneficio</p>
                                        <p className="text-xs text-gray-400">El día adicional ya fue otorgado en el período actual</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                        <button onClick={() => setEditModal(null)} disabled={editSaving}
                            className="cursor-pointer rounded-md px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                            Cancelar
                        </button>
                        <button onClick={handleSaveEdit} disabled={editSaving}
                            className="cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                            {editSaving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Previsualización de saldos antes de confirmar */}
        {importPreview && !importResult && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Previsualización de Carga de Saldos</h3>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{importPreview.filename}</p>
                    </div>

                    {/* Resumen */}
                    <div className="px-6 pt-4 flex gap-3">
                        <div className="flex-1 rounded-lg bg-green-50 ring-1 ring-green-200 px-3 py-2 text-center">
                            <p className="text-xs text-green-600 font-medium">Colaboradores encontrados</p>
                            <p className="text-xl font-bold text-green-700">{importPreview.total_found}</p>
                        </div>
                        <div className="flex-1 rounded-lg bg-yellow-50 ring-1 ring-yellow-200 px-3 py-2 text-center">
                            <p className="text-xs text-yellow-600 font-medium">No encontrados</p>
                            <p className="text-xl font-bold text-yellow-600">{importPreview.total_not_found}</p>
                        </div>
                        {importPreview.total_errors > 0 && (
                            <div className="flex-1 rounded-lg bg-red-50 ring-1 ring-red-200 px-3 py-2 text-center">
                                <p className="text-xs text-red-600 font-medium">Con errores</p>
                                <p className="text-xl font-bold text-red-600">{importPreview.total_errors}</p>
                            </div>
                        )}
                    </div>

                    {/* Tabla de previsualización */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        <table className="min-w-full text-sm divide-y divide-gray-200 rounded-lg ring-1 ring-gray-200 overflow-hidden">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Código</th>
                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Colaborador</th>
                                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo Actual</th>
                                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo Nuevo</th>
                                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {importPreview.rows.map((row, i) => (
                                    <tr key={i} className={
                                        row.error ? 'bg-red-50' :
                                        !row.found ? 'bg-yellow-50' :
                                        'bg-green-50'
                                    }>
                                        <td className="py-2.5 pl-4 pr-3 font-mono font-semibold text-xs text-indigo-600">{row.employee_number}</td>
                                        <td className="px-3 py-2.5 text-gray-700">
                                            {row.full_name || <span className="text-gray-400 italic">No encontrado</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-gray-500">
                                            {row.current_balance !== null ? row.current_balance : '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-center font-semibold text-gray-800">
                                            {row.new_balance !== null ? row.new_balance : <span className="text-red-500 text-xs">Inválido</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {row.error ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Error</span>
                                            ) : row.found ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">OK</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">No encontrado</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                        <p className="text-xs text-gray-400">
                            Solo se actualizarán los <strong>{importPreview.total_found}</strong> colaboradores encontrados y sin error.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleImportCancel}
                                disabled={importConfirming}
                                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleImportConfirm}
                                disabled={importConfirming || importPreview.total_found === 0}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                            >
                                {importConfirming ? 'Cargando...' : `Confirmar carga (${importPreview.total_found})`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Resultado de importación de saldos */}
        {importResult && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" /> Resultado de Carga
                    </h3>

                    <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            <span><strong>{importResult.procesados}</strong> colaborador(es) actualizados correctamente</span>
                        </div>

                        {importResult.no_encontrados?.length > 0 && (
                            <div className="bg-yellow-50 rounded-lg px-3 py-2">
                                <p className="font-medium text-yellow-700 flex items-center gap-1 mb-1">
                                    <AlertCircle className="w-4 h-4" /> Códigos no encontrados ({importResult.no_encontrados.length})
                                </p>
                                <ul className="text-yellow-600 list-disc list-inside text-xs space-y-0.5">
                                    {importResult.no_encontrados.map(c => <li key={c}>{c}</li>)}
                                </ul>
                            </div>
                        )}

                        {importResult.errores?.length > 0 && (
                            <div className="bg-red-50 rounded-lg px-3 py-2">
                                <p className="font-medium text-red-700 flex items-center gap-1 mb-1">
                                    <AlertCircle className="w-4 h-4" /> Errores ({importResult.errores.length})
                                </p>
                                <ul className="text-red-600 list-disc list-inside text-xs space-y-0.5">
                                    {importResult.errores.map((e, i) => <li key={i}>{e.codigo}: {e.motivo}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="mt-5 flex justify-end">
                        <button onClick={() => setImportResult(null)}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal: Resumen detallado del colaborador */}
        {detailUserId && (
            <CollaboratorDetailModal
                userId={detailUserId}
                onClose={() => setDetailUserId(null)}
            />
        )}

        {/* Modal: Agregar días manualmente */}
        {adjustModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Agregar Días de Vacaciones</h3>
                    <p className="text-sm text-gray-500 mb-5">
                        Colaborador: <span className="font-medium text-gray-700">{adjustModal.userName}</span>
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Días a agregar</label>
                            <input type="number" min="0.5" step="0.5" value={adjustForm.days_added}
                                onChange={(e) => setAdjustForm({ ...adjustForm, days_added: e.target.value })}
                                placeholder="Ej. 1.5"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                            <textarea rows={3} value={adjustForm.reason}
                                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                placeholder="Ej. Trabajo el sábado 29/03 y domingo 30/03"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-x-3">
                        <button onClick={() => setAdjustModal(null)}
                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button onClick={handleAdjustDays}
                            className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500">
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
