import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, UserCheck } from 'lucide-react';

export default function InactiveUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const usersRes = await api.get('/users/inactive');
            setUsers(usersRes.data);
        } catch (error) {
            console.error("Error fetching inactive users:", error);
            toast.error("Error al cargar la lista de usuarios inactivos.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleActivate = async (id, name) => {
        if (!window.confirm(`¿Estás seguro de que deseas reactivar a ${name}? Volverá a tener acceso al sistema y aparecerá en los listados activos.`)) return;
        try {
            await api.put(`/users/${id}/activate`);
            toast.success("Empleado reactivado correctamente");
            fetchData();
        } catch (error) {
            console.error("Error activating user:", error);
            toast.error("Error al reactivar el empleado");
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
                    <div className="flex items-center mb-2">
                        <Link to="/admin" className="text-gray-500 hover:text-gray-700 mr-2">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-xl font-semibold leading-6 text-gray-900">Empleados Desactivados</h1>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">
                        Historial de empleados que ya no laboran en la organización.
                    </p>
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
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cargo Anterior</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Rol Sistema</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                            <span className="sr-only">Acciones</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="py-8 text-center text-sm text-gray-500">
                                                No hay empleados desactivados.
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((u) => (
                                            <tr key={u.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6 opacity-75">
                                                    <div className="font-medium text-gray-900 strikethrough">{u.full_name}</div>
                                                    <div className="text-gray-500">{u.email}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 opacity-75">
                                                    {u.position || '-'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 opacity-75">
                                                    {u.role}
                                                </td>
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    <button onClick={() => handleActivate(u.id, u.full_name)} className="text-green-600 hover:text-green-900 inline-flex items-center">
                                                        <UserCheck className="w-4 h-4 mr-1" /> Reactivar
                                                    </button>
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
