import { useAuth } from '../context/AuthContext';
import { User, Briefcase, Calendar, Mail, FileText } from 'lucide-react';

export default function Profile() {
    const { user } = useAuth();

    if (!user) {
        return null;
    }

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="bg-white overflow-hidden shadow sm:rounded-lg">
                <div className="px-4 py-6 sm:px-6">
                    <div className="flex items-center">
                        {user.avatar_url ? (
                            <img src={user.avatar_url} alt="Profile" className="h-16 w-16 rounded-full" />
                        ) : (
                            <div className="bg-indigo-100 p-3 rounded-full h-16 w-16 flex items-center justify-center">
                                <User className="h-8 w-8 text-indigo-600" />
                            </div>
                        )}
                        <div className="ml-4">
                            <h3 className="text-xl font-bold leading-6 text-gray-900">{user.full_name}</h3>
                            <p className="mt-1 max-w-2xl text-sm text-gray-500">Ficha de Empleado (Solo Lectura)</p>
                        </div>
                    </div>
                </div>
                <div className="border-t border-gray-100">
                    <dl className="divide-y divide-gray-100">
                        <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-900 flex items-center">
                                <Mail className="w-4 h-4 mr-2 text-gray-400" /> Correo Electrónico
                            </dt>
                            <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">{user.email}</dd>
                        </div>
                        <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-900 flex items-center">
                                <FileText className="w-4 h-4 mr-2 text-gray-400" /> Número de Empleado
                            </dt>
                            <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                {user.employee_number || 'No asignado'}
                            </dd>
                        </div>
                        <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-900 flex items-center">
                                <Briefcase className="w-4 h-4 mr-2 text-gray-400" /> Posición / Puesto
                            </dt>
                            <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                {user.position || 'No asignada'}
                            </dd>
                        </div>
                        <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-900 flex items-center">
                                <User className="w-4 h-4 mr-2 text-gray-400" /> Rol en el Sistema
                            </dt>
                            <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                                    {user.role}
                                </span>
                            </dd>
                        </div>
                        <div className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-900 flex items-center">
                                <Calendar className="w-4 h-4 mr-2 text-gray-400" /> Días de Vacaciones Base
                            </dt>
                            <dd className="mt-1 text-sm leading-6 text-gray-700 sm:col-span-2 sm:mt-0">
                                {user.base_vacation_days} días anuales
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    );
}
