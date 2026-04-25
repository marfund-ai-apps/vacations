import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 'Todos'];

export default function Admin() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Edición / creación
    const [editingUserId, setEditingUserId] = useState(null);
    const [editForm, setEditForm] = useState({ role: '', manager_id: '', position: '', base_vacation_days: 15 });
    const [isCreating, setIsCreating] = useState(false);
    const [newForm, setNewForm] = useState({ full_name: '', email: '', employee_number: '', position: '', base_vacation_days: 15, role: 'employee', manager_id: '' });

    // Modal ajuste de días
    const [adjustModal, setAdjustModal] = useState(null);
    const [adjustForm, setAdjustForm] = useState({ days_added: '', reason: '' });

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

    // Handlers edición
    const startEditing = (u) => {
        setEditingUserId(u.id);
        setEditForm({ role: u.role, manager_id: u.manager_id || '', position: u.position || '', base_vacation_days: u.base_vacation_days || 15 });
    };
    const cancelEditing = () => setEditingUserId(null);

    const handleSave = async (id) => {
        try {
            await api.put(`/users/${id}`, { ...editForm, manager_id: editForm.manager_id || null });
            toast.success("Usuario actualizado correctamente");
            setEditingUserId(null);
            fetchData();
        } catch (error) {
            console.error("Error updating user:", error);
            toast.error("Error al actualizar usuario");
        }
    };

    const handleCreate = async () => {
        try {
            await api.post('/users', { ...newForm, manager_id: newForm.manager_id || null });
            toast.success("Colaborador creado correctamente");
            setIsCreating(false);
            setNewForm({ full_name: '', email: '', employee_number: '', position: '', base_vacation_days: 15, role: 'employee', manager_id: '' });
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
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-48">Colaborador</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-36">Cargo</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-28">Rol Sistema</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-40">Supervisor Inmediato</th>
                                        <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 w-20">Días Vac.</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 w-44">
                                            <span className="sr-only">Acciones</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {isCreating && (
                                        <tr className="bg-indigo-50">
                                            <td className="py-4 pl-4 pr-3 text-sm sm:pl-6 space-y-2">
                                                <input type="text" placeholder="Nombre Completo" value={newForm.full_name}
                                                    onChange={(e) => setNewForm({ ...newForm, full_name: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6" />
                                                <input type="email" placeholder="Correo Electrónico" value={newForm.email}
                                                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6" />
                                                <input type="text" placeholder="No. Colaborador" value={newForm.employee_number}
                                                    onChange={(e) => setNewForm({ ...newForm, employee_number: e.target.value })}
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
                                            <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2">
                                                <button onClick={handleCreate} className="text-indigo-600 hover:text-indigo-900 block w-full text-right mb-2">Crear</button>
                                                <button onClick={() => setIsCreating(false)} className="text-gray-600 hover:text-gray-900 block w-full text-right">Cancelar</button>
                                            </td>
                                        </tr>
                                    )}

                                    {paginatedUsers.length === 0 && !isCreating ? (
                                        <tr>
                                            <td colSpan="6" className="py-10 text-center text-sm text-gray-500">
                                                No se encontraron colaboradores con los filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : paginatedUsers.map((u) => {
                                        const isEditing = editingUserId === u.id;
                                        return (
                                            <tr key={u.id} className="align-top">
                                                <td className="py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                    <div className="font-medium text-gray-900">{u.full_name}</div>
                                                    <div className="text-gray-500 text-xs">{u.email}</div>
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-500 max-w-[144px]">
                                                    {isEditing ? (
                                                        <input type="text" value={editForm.position}
                                                            onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                                                            className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                            placeholder="Ej. Oficial Legal" />
                                                    ) : (
                                                        <span className="block break-words leading-snug">{u.position || '-'}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-500">
                                                    {isEditing ? (
                                                        <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                                            className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6">
                                                            <option value="employee">Colaborador</option>
                                                            <option value="manager">Manager</option>
                                                            <option value="hr_admin">RRHH Admin</option>
                                                            <option value="super_admin">Super Admin</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap
                                                            ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                                                              u.role === 'hr_admin' ? 'bg-blue-100 text-blue-800' :
                                                              u.role === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                                                              'bg-gray-100 text-gray-800'}`}>
                                                            {u.role}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-500 max-w-[160px]">
                                                    {isEditing ? (
                                                        <select value={editForm.manager_id} onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value })}
                                                            className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6">
                                                            <option value="">Ninguno</option>
                                                            {managers.map(m => m.id !== u.id && (
                                                                <option key={m.id} value={m.id}>{m.full_name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="block break-words leading-snug">{u.manager_name || '-'}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4 text-sm text-gray-500 text-center whitespace-nowrap">
                                                    {isEditing ? (
                                                        <input type="number" value={editForm.base_vacation_days}
                                                            onChange={(e) => setEditForm({ ...editForm, base_vacation_days: e.target.value })}
                                                            className="block w-16 mx-auto rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6" />
                                                    ) : (u.base_vacation_days || 15)}
                                                </td>
                                                <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 whitespace-nowrap">
                                                    {isEditing ? (
                                                        <div className="space-x-2">
                                                            <button onClick={() => handleSave(u.id)} className="text-indigo-600 hover:text-indigo-900">Guardar</button>
                                                            <button onClick={cancelEditing} className="text-gray-600 hover:text-gray-900">Cancelar</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end space-x-3">
                                                            <button onClick={() => openAdjustModal(u)} className="text-green-600 hover:text-green-800 inline-flex items-center font-medium">
                                                                + Días
                                                            </button>
                                                            <button onClick={() => startEditing(u)} className="text-indigo-600 hover:text-indigo-900 inline-flex items-center">
                                                                <Pencil className="w-4 h-4 mr-1" /> Editar
                                                            </button>
                                                            <button onClick={() => handleDeactivate(u.id, u.full_name)} className="text-red-600 hover:text-red-900 inline-flex items-center">
                                                                <Trash2 className="w-4 h-4 mr-1" /> Desactivar
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
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
