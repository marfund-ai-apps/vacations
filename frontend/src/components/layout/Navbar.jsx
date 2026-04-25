import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    Home,
    List,
    Users,
    Building2,
    Settings,
    LogOut,
    Menu,
    X,
    User,
    BarChart3,
    FileBarChart2,
    ChevronDown
} from 'lucide-react';

// Definición de items de navegación con control de roles
const NAV_ITEMS = [
    { name: 'Home',                 href: '/dashboard',         icon: Home,      roles: ['employee', 'manager', 'hr_admin', 'super_admin'] },
    { name: 'Mis Solicitudes',      href: '/my-requests',       icon: List,      roles: ['employee', 'manager', 'hr_admin', 'super_admin'] },
    { name: 'De mi Equipo',         href: '/pending-approvals', icon: Users,     roles: ['manager', 'hr_admin', 'super_admin'] },
    { name: 'Toda la Organización', href: '/all-requests',      icon: Building2, roles: ['hr_admin', 'super_admin'] },
    { name: 'Admin',                href: '/admin',             icon: Settings,  roles: ['hr_admin', 'super_admin'] },
];

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [isReportsDropdownOpen, setIsReportsDropdownOpen] = useState(false);

    const showReportsMenu = ['hr_admin', 'super_admin'].includes(user?.role);

    // Submenú de Reportes
    const REPORT_ITEMS = [
        { name: 'Reporte General', href: '/reports', icon: FileBarChart2, description: 'Resumen de todos los colaboradores' },
    ];

    const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user?.role));
    const isActive = (href) => location.pathname === href || location.pathname.startsWith(href + '/');

    const linkClass = (href) =>
        `inline-flex items-center gap-1.5 px-2 pt-1 pb-0.5 border-b-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
            isActive(href)
                ? 'border-indigo-600 text-indigo-700 font-semibold'
                : 'border-transparent text-gray-500 hover:text-indigo-600 hover:border-indigo-400'
        }`;

    return (
        <nav className="bg-white border-b border-gray-200 relative z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">

                    {/* Logo + nav items */}
                    <div className="flex items-center gap-1 lg:gap-2 overflow-visible">
                        {/* Logo */}
                        <div className="flex-shrink-0 flex items-center pr-2 lg:pr-4">
                            <img
                                src="https://marfund.org/en/wp-content/uploads/2017/07/logo-marfund-200.png"
                                alt="MAR Fund"
                                className="h-16 py-1 w-auto"
                            />
                            <span className="ml-2 text-sm font-semibold text-gray-500 hidden xl:block border-l pl-2 border-gray-300">
                                Vacaciones
                            </span>
                        </div>

                        {/* Desktop nav */}
                        <div className="hidden md:flex md:items-center md:h-full md:gap-1 lg:gap-2">
                            {visibleItems.map(({ name, href, icon: Icon }) => (
                                <Link key={href} to={href} className={linkClass(href)}>
                                    <Icon className="w-4 h-4 flex-shrink-0" />
                                    <span className="hidden lg:inline">{name}</span>
                                </Link>
                            ))}

                            {/* Dropdown Reportes */}
                            {showReportsMenu && (
                                <div className="relative flex items-center h-full">
                                    <button
                                        type="button"
                                        onClick={() => setIsReportsDropdownOpen(!isReportsDropdownOpen)}
                                        className={`inline-flex items-center gap-1.5 px-2 pt-1 pb-0.5 border-b-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus:outline-none ${
                                            location.pathname.startsWith('/reports')
                                                ? 'border-indigo-600 text-indigo-700 font-semibold'
                                                : 'border-transparent text-gray-500 hover:text-indigo-600 hover:border-indigo-400'
                                        }`}
                                    >
                                        <BarChart3 className="w-4 h-4 flex-shrink-0" />
                                        <span className="hidden lg:inline">Reportes</span>
                                        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isReportsDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isReportsDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsReportsDropdownOpen(false)} />
                                            <div className="absolute left-0 top-14 z-20 w-64 origin-top-left rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 py-1 overflow-hidden">
                                                <div className="px-3 py-2 border-b border-gray-100">
                                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reportes</p>
                                                </div>
                                                {REPORT_ITEMS.map(({ name, href, icon: Icon, description }) => (
                                                    <Link
                                                        key={href}
                                                        to={href}
                                                        onClick={() => setIsReportsDropdownOpen(false)}
                                                        className={`flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-indigo-50 ${
                                                            isActive(href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                                                        }`}
                                                    >
                                                        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" />
                                                        <div>
                                                            <p className="font-medium leading-tight">{name}</p>
                                                            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Perfil de usuario (desktop) */}
                    <div className="hidden md:flex md:items-center">
                        <div className="relative">
                            <button
                                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                className="flex items-center text-sm font-medium text-gray-700 whitespace-nowrap focus:outline-none hover:bg-gray-50 px-2 py-1 rounded-md transition-colors duration-150"
                            >
                                <User className="w-5 h-5 mr-2 text-gray-400" />
                                <span className="hidden lg:block truncate max-w-[150px]">{user?.full_name}</span>
                                <span className="ml-2 px-2 inline-flex text-[10px] leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                                    {user?.role.replace('_', ' ')}
                                </span>
                            </button>

                            {isUserDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsUserDropdownOpen(false)} />
                                    <div className="absolute right-0 top-10 z-20 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                                        <Link
                                            to="/profile"
                                            onClick={() => setIsUserDropdownOpen(false)}
                                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center transition-colors"
                                        >
                                            <User className="w-4 h-4 mr-2 text-gray-400" /> Ficha de Colaborador
                                        </Link>
                                        <button
                                            onClick={() => { setIsUserDropdownOpen(false); logout(); }}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center transition-colors"
                                        >
                                            <LogOut className="w-4 h-4 mr-2 text-gray-400" /> Cerrar sesión
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Botón hamburguesa (mobile) */}
                    <div className="-mr-2 flex items-center md:hidden">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="bg-white inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <span className="sr-only">Abrir menú</span>
                            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden pb-4 border-t border-gray-100">
                    <div className="pt-2 pb-3 space-y-0.5">
                        {visibleItems.map(({ name, href, icon: Icon }) => (
                            <Link
                                key={href}
                                to={href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 pl-4 pr-4 py-2.5 border-l-4 text-sm font-medium transition-colors ${
                                    isActive(href)
                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                        : 'border-transparent text-gray-600 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600'
                                }`}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {name}
                            </Link>
                        ))}

                        {/* Reportes en móvil */}
                        {showReportsMenu && (
                            <>
                                <div className="pl-4 pr-4 pt-3 pb-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reportes</p>
                                </div>
                                {REPORT_ITEMS.map(({ name, href, icon: Icon }) => (
                                    <Link
                                        key={href}
                                        to={href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 pl-8 pr-4 py-2.5 border-l-4 text-sm font-medium transition-colors ${
                                            isActive(href)
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-transparent text-gray-600 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                        {name}
                                    </Link>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Usuario en mobile */}
                    <div className="pt-4 pb-1 border-t border-gray-200">
                        <div className="flex items-center px-4 mb-2">
                            <User className="h-9 w-9 rounded-full text-gray-400 bg-gray-100 p-2 flex-shrink-0" />
                            <div className="ml-3">
                                <div className="text-sm font-medium text-gray-800">{user?.full_name}</div>
                                <div className="text-xs text-gray-500">{user?.email}</div>
                            </div>
                        </div>
                        <Link
                            to="/profile"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        >
                            <User className="w-5 h-5" /> Ficha de Colaborador
                        </Link>
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                            <LogOut className="w-5 h-5" /> Cerrar Sesión
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}
