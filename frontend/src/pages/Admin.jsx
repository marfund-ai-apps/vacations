import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Pencil, Trash2 } from 'lucide-react';

export default function Admin() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingUserId, setEditingUserId] = useState(null);
    const [editForm, setEditForm] = useState({ role: '', manager_id: '', position: '', base_vacation_days: 15 });
    const [isCreating, setIsCreating] = useState(false);
    const [newForm, setNewForm] = useState({ full_name: '', email: '', employee_number: '', position: '', base_vacation_days: 15, role: 'employee', manager_id: '' });

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

    useEffect(() => {
        fetchData();
    }, []);

    const startEditing = (user) => {
        setEditingUserId(user.id);
        setEditForm({
            role: user.role,
            manager_id: user.manager_id || '',
            position: user.position || '',
            base_vacation_days: user.base_vacation_days || 15
        });
    };

    const cancelEditing = () => {
        setEditingUserId(null);
    };

    const handleSave = async (id) => {
        try {
            await api.put(`/users/${id}`, {
                ...editForm,
                manager_id: editForm.manager_id || null
            });
            toast.success("Usuario actualizado correctamente");
            setEditingUserId(null);
            fetchData(); // Recargar datos
        } catch (error) {
            console.error("Error updating user:", error);
            toast.error("Error al actualizar usuario");
        }
    };

    const handleCreate = async () => {
        try {
            await api.post('/users', {
                ...newForm,
                manager_id: newForm.manager_id || null
            });
            toast.success("Empleado creado correctamente");
            setIsCreating(false);
            setNewForm({ full_name: '', email: '', employee_number: '', position: '', base_vacation_days: 15, role: 'employee', manager_id: '' });
            fetchData();
        } catch (error) {
            console.error("Error creating user:", error);
            toast.error(error.response?.data?.message || "Error al crear empleado");
        }
    };

    const handleDeactivate = async (id, name) => {
        if (!window.confirm(`¿Estás seguro de que deseas desactivar a ${name}? Su historial se mantendrá pero ya no tendrá acceso al sistema.`)) return;
        try {
            await api.put(`/users/${id}/deactivate`);
            toast.success("Empleado desactivado correctamente");
            fetchData();
        } catch (error) {
            console.error("Error deactivating user:", error);
            toast.error("Error al desactivar el empleado");
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
                    <h1 className="text-xl font-semibold leading-6 text-gray-900">Administración de Usuarios</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Gestiona roles, puestos y asigna jefes inmediatos a los empleados.
                    </p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex space-x-3">
                    {user?.role === 'super_admin' && (
                        <Link
                            to="/admin/inactive"
                            className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                            Ver Inactivos
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsCreating(true)}
                        className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        Agregar Empleado
                    </button>
                </div>
            </div>

            <div className="mt-8 flow-root">
                <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Empleado</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cargo</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Rol Sistema</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Jefe Inmediato</th>
                                        <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">Días Vac.</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                            <span className="sr-only">Editar</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {isCreating && (
                                        <tr className="bg-indigo-50">
                                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6 space-y-2">
                                                <input
                                                    type="text"
                                                    placeholder="Nombre Completo"
                                                    value={newForm.full_name}
                                                    onChange={(e) => setNewForm({ ...newForm, full_name: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                />
                                                <input
                                                    type="email"
                                                    placeholder="Correo Electrónico"
                                                    value={newForm.email}
                                                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="No. Empleado"
                                                    value={newForm.employee_number}
                                                    onChange={(e) => setNewForm({ ...newForm, employee_number: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                />
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                <input
                                                    type="text"
                                                    placeholder="Puesto"
                                                    value={newForm.position}
                                                    onChange={(e) => setNewForm({ ...newForm, position: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                />
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                <select
                                                    value={newForm.role}
                                                    onChange={(e) => setNewForm({ ...newForm, role: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                >
                                                    <option value="employee">Empleado</option>
                                                    <option value="manager">Manager</option>
                                                    <option value="hr_admin">RRHH Admin</option>
                                                    <option value="super_admin">Super Admin</option>
                                                </select>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                <select
                                                    value={newForm.manager_id}
                                                    onChange={(e) => setNewForm({ ...newForm, manager_id: e.target.value })}
                                                    className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                >
                                                    <option value="">Ninguno</option>
                                                    {managers.map(m => (
                                                        <option key={m.id} value={m.id}>{m.full_name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                                                <input
                                                    type="number"
                                                    value={newForm.base_vacation_days}
                                                    onChange={(e) => setNewForm({ ...newForm, base_vacation_days: e.target.value })}
                                                    className="block w-16 mx-auto rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                />
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2">
                                                <button onClick={handleCreate} className="text-indigo-600 hover:text-indigo-900 block w-full text-right mb-2">Crear</button>
                                                <button onClick={() => setIsCreating(false)} className="text-gray-600 hover:text-gray-900 block w-full text-right">Cancelar</button>
                                            </td>
                                        </tr>
                                    )}
                                    {users.map((u) => {
                                        const isEditing = editingUserId === u.id;

                                        return (
                                            <tr key={u.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                    <div className="font-medium text-gray-900">{u.full_name}</div>
                                                    <div className="text-gray-500">{u.email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={editForm.position}
                                                            onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                                                            className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                            placeholder="Ej. Oficial Legal"
                                                        />
                                                    ) : (u.position || '-')}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {isEditing ? (
                                                        <select
                                                            value={editForm.role}
                                                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                                            className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                        >
                                                            <option value="employee">Empleado</option>
                                                            <option value="manager">Manager</option>
                                                            <option value="hr_admin">RRHH Admin</option>
                                                            <option value="super_admin">Super Admin</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                                            ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                                                                u.role === 'hr_admin' ? 'bg-blue-100 text-blue-800' :
                                                                    u.role === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-gray-100 text-gray-800'}`}>
                                                            {u.role}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {isEditing ? (
                                                        <select
                                                            value={editForm.manager_id}
                                                            onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value })}
                                                            className="block w-full rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                        >
                                                            <option value="">Ninguno</option>
                                                            {managers.map(m => m.id !== u.id && ( // Para evitar que se ponga a sí mismo
                                                                <option key={m.id} value={m.id}>{m.full_name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        u.manager_name || '-'
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-center">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            value={editForm.base_vacation_days}
                                                            onChange={(e) => setEditForm({ ...editForm, base_vacation_days: e.target.value })}
                                                            className="block w-16 mx-auto rounded-md border-0 py-1 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-xs sm:leading-6"
                                                        />
                                                    ) : (
                                                        u.base_vacation_days || 15
                                                    )}
                                                </td>
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    {isEditing ? (
                                                        <div className="space-x-2">
                                                            <button onClick={() => handleSave(u.id)} className="text-indigo-600 hover:text-indigo-900">Guardar</button>
                                                            <button onClick={cancelEditing} className="text-gray-600 hover:text-gray-900">Cancelar</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end space-x-3">
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
        </div>
    );
}
