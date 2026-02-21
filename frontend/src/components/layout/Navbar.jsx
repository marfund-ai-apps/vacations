import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Home,
    CalendarPlus,
    List,
    CheckSquare,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    X,
    User
} from 'lucide-react';

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [isRequestsDropdownOpen, setIsRequestsDropdownOpen] = useState(false);

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['employee', 'manager', 'hr_admin', 'super_admin'], showTextOnDesktop: false },
        // Componentes ocultos para roles básicos; los dropdowns se manejan aparte
    ];

    const filteredNavigation = navigation.filter(item => item.roles.includes(user?.role));
    const showRequestsMenu = ['manager', 'hr_admin', 'super_admin'].includes(user?.role);
    const showAdminMenu = ['hr_admin', 'super_admin'].includes(user?.role);

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="bg-white border-b border-gray-200 relative z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex overflow-visible">
                        <div className="flex-shrink-0 flex items-center pr-2 lg:pr-6">
                            <img
                                src="https://marfund.org/en/wp-content/uploads/2017/07/logo-marfund-200.png"
                                alt="MAR Fund"
                                className="h-16 py-1 w-auto"
                            />
                            <span className="ml-2 text-sm font-semibold text-gray-500 hidden xl:block border-l pl-2 border-gray-300">Vacaciones</span>
                        </div>
                        <div className="hidden md:-my-px md:ml-2 lg:ml-6 md:flex md:space-x-2 lg:space-x-4 overflow-visible">
                            {filteredNavigation.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.href}
                                        title={item.name}
                                        className={`${isActive(item.href)
                                            ? 'border-indigo-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                            } inline-flex items-center px-2 pt-1 border-b-2 text-sm font-medium whitespace-nowrap`}
                                    >
                                        <Icon className={`w-5 h-5 ${item.showTextOnDesktop === false ? '' : 'mr-1.5 hidden lg:block'}`} />
                                        {item.showTextOnDesktop !== false && item.name}
                                    </Link>
                                );
                            })}

                            {showRequestsMenu && (
                                <div className="relative inline-flex items-center h-full">
                                    <button
                                        type="button"
                                        onClick={() => setIsRequestsDropdownOpen(!isRequestsDropdownOpen)}
                                        className={`${location.pathname.includes('/my-requests') || location.pathname.includes('/pending-approvals')
                                            ? 'border-indigo-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                            } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium whitespace-nowrap focus:outline-none`}
                                    >
                                        <List className="w-5 h-5 mr-1.5 hidden lg:block" />
                                        Solicitudes
                                    </button>

                                    {isRequestsDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsRequestsDropdownOpen(false)}></div>
                                            <div className="absolute left-0 top-14 z-20 mt-2 w-56 origin-top-left rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                                <Link
                                                    to="/my-requests"
                                                    onClick={() => setIsRequestsDropdownOpen(false)}
                                                    className={`${isActive('/my-requests') ? 'bg-gray-100' : ''} block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center`}
                                                >
                                                    <List className="w-4 h-4 mr-2" /> Mis Solicitudes
                                                </Link>
                                                <Link
                                                    to="/pending-approvals"
                                                    onClick={() => setIsRequestsDropdownOpen(false)}
                                                    className={`${isActive('/pending-approvals') ? 'bg-gray-100' : ''} block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center`}
                                                >
                                                    <CheckSquare className="w-4 h-4 mr-2" /> De mi equipo
                                                </Link>
                                                {user?.role === 'super_admin' && (
                                                    <Link
                                                        to="/all-requests"
                                                        onClick={() => setIsRequestsDropdownOpen(false)}
                                                        className={`${isActive('/all-requests') ? 'bg-gray-100' : ''} block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center`}
                                                    >
                                                        <List className="w-4 h-4 mr-2" /> Toda Organización
                                                    </Link>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {showAdminMenu && (
                                <div className="relative inline-flex items-center h-full">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
                                        className={`${location.pathname.includes('/admin') || location.pathname.includes('/reports')
                                            ? 'border-indigo-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                            } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium whitespace-nowrap focus:outline-none`}
                                    >
                                        <Settings className="w-5 h-5 mr-1.5 hidden lg:block" />
                                        Admin
                                    </button>

                                    {isAdminDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsAdminDropdownOpen(false)}></div>
                                            <div className="absolute right-0 top-14 z-20 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                                <Link
                                                    to="/reports"
                                                    onClick={() => setIsAdminDropdownOpen(false)}
                                                    className={`${isActive('/reports') ? 'bg-gray-100' : ''} block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center`}
                                                >
                                                    <BarChart3 className="w-4 h-4 mr-2" /> Reportes
                                                </Link>
                                                <Link
                                                    to="/admin"
                                                    onClick={() => setIsAdminDropdownOpen(false)}
                                                    className={`${isActive('/admin') ? 'bg-gray-100' : ''} block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center`}
                                                >
                                                    <User className="w-4 h-4 mr-2" /> Empleados
                                                </Link>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="hidden md:ml-4 md:flex md:items-center overflow-visible">
                        <div className="ml-1 md:ml-3 relative flex items-center">

                            <div className="relative">
                                <button
                                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                    className="flex items-center text-sm font-medium text-gray-700 whitespace-nowrap focus:outline-none hover:bg-gray-50 px-2 py-1 rounded-md"
                                >
                                    <User className="w-5 h-5 mr-2 text-gray-400" />
                                    <span className="hidden lg:block truncate max-w-[150px]">{user?.full_name}</span>
                                    <span className="ml-2 px-2 inline-flex text-[10px] leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                                        {user?.role.replace('_', ' ')}
                                    </span>
                                </button>

                                {isUserDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsUserDropdownOpen(false)}></div>
                                        <div className="absolute right-0 top-10 z-20 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                            <Link
                                                to="/profile"
                                                onClick={() => setIsUserDropdownOpen(false)}
                                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                            >
                                                <User className="w-4 h-4 mr-2 text-gray-400" /> Ficha de Empleado
                                            </Link>
                                            {showAdminMenu && (
                                                <Link
                                                    to="/admin"
                                                    onClick={() => setIsUserDropdownOpen(false)}
                                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                                >
                                                    <Settings className="w-4 h-4 mr-2 text-gray-400" /> Editar Empleado
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setIsUserDropdownOpen(false);
                                                    logout();
                                                }}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                            >
                                                <LogOut className="w-4 h-4 mr-2 text-gray-400" /> Cerrar sesión
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                        </div>
                    </div>

                    <div className="-mr-2 flex items-center md:hidden">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="bg-white inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <span className="sr-only">Abrir menú principal</span>
                            {isMobileMenuOpen ? (
                                <X className="block h-6 w-6" aria-hidden="true" />
                            ) : (
                                <Menu className="block h-6 w-6" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isMobileMenuOpen && (
                <div className="sm:hidden pb-4">
                    <div className="pt-2 pb-3 space-y-1">
                        {filteredNavigation.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`${isActive(item.href)
                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                                        } block pl-3 pr-4 py-2 border-l-4 text-base font-medium flex items-center`}
                                >
                                    <Icon className="w-5 h-5 mr-3" />
                                    {item.name}
                                </Link>
                            );
                        })}
                        {showRequestsMenu && (
                            <>
                                <div className="pl-3 pr-4 py-2 text-base font-medium text-gray-800 flex items-center border-l-4 border-transparent">
                                    <List className="w-5 h-5 mr-3 text-gray-400" /> Solicitudes
                                </div>
                                <div className="pl-12">
                                    <Link
                                        to="/my-requests"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`${isActive('/my-requests') ? 'text-indigo-700 font-medium' : 'text-gray-500 hover:text-gray-800'} block py-2 text-sm`}
                                    >
                                        Mis Solicitudes
                                    </Link>
                                    <Link
                                        to="/pending-approvals"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`${isActive('/pending-approvals') ? 'text-indigo-700 font-medium' : 'text-gray-500 hover:text-gray-800'} block py-2 text-sm`}
                                    >
                                        De mi equipo
                                    </Link>
                                    {user?.role === 'super_admin' && (
                                        <Link
                                            to="/all-requests"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className={`${isActive('/all-requests') ? 'text-indigo-700 font-medium' : 'text-gray-500 hover:text-gray-800'} block py-2 text-sm`}
                                        >
                                            Toda Organización
                                        </Link>
                                    )}
                                </div>
                            </>
                        )}
                        {showAdminMenu && (
                            <>
                                <Link
                                    to="/reports"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`${isActive('/reports') ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-transparent text-gray-600 hover:bg-gray-50'} block pl-3 pr-4 py-2 border-l-4 text-base font-medium flex items-center`}
                                >
                                    <BarChart3 className="w-5 h-5 mr-3" /> Reportes
                                </Link>
                                <Link
                                    to="/admin"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`${isActive('/admin') ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'border-transparent text-gray-600 hover:bg-gray-50'} block pl-3 pr-4 py-2 border-l-4 text-base font-medium flex items-center`}
                                >
                                    <Settings className="w-5 h-5 mr-3" /> Admin Empleados
                                </Link>
                            </>
                        )}
                    </div>
                    <div className="pt-4 pb-3 border-t border-gray-200">
                        <div className="flex items-center px-4">
                            <div className="flex-shrink-0">
                                <User className="h-10 w-10 rounded-full text-gray-400 bg-gray-100 p-2" />
                            </div>
                            <div className="ml-3">
                                <div className="text-base font-medium text-gray-800">{user?.full_name}</div>
                                <div className="text-sm font-medium text-gray-500">{user?.email}</div>
                            </div>
                        </div>
                        <div className="mt-3 space-y-1">
                            <Link
                                to="/profile"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 flex items-center"
                            >
                                <User className="w-5 h-5 mr-3" /> Ficha de Empleado
                            </Link>
                            {showAdminMenu && (
                                <Link
                                    to="/admin"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 flex items-center"
                                >
                                    <Settings className="w-5 h-5 mr-3" /> Editar Empleado
                                </Link>
                            )}
                            <button
                                onClick={logout}
                                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 flex items-center"
                            >
                                <LogOut className="w-5 h-5 mr-3" /> Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
