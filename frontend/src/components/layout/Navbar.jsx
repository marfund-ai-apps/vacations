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

const NAV_ITEMS = [
    { name: 'Home',                 href: '/dashboard',         icon: Home,      roles: ['employee', 'manager', 'hr_admin', 'super_admin'] },
    { name: 'Mis Solicitudes',      href: '/my-requests',       icon: List,      roles: ['employee', 'manager', 'hr_admin', 'super_admin'] },
    { name: 'De mi Equipo',         href: '/pending-approvals', icon: Users,     roles: ['manager', 'hr_admin', 'super_admin'] },
    { name: 'Toda la Organización', href: '/all-requests',      icon: Building2, roles: ['hr_admin', 'super_admin'] },
    { name: 'Admin',                href: '/admin',             icon: Settings,  roles: ['hr_admin', 'super_admin'] },
];

const REPORT_ITEMS = [
    { name: 'Reporte General', href: '/reports', icon: FileBarChart2, description: 'Resumen de todos los colaboradores', roles: ['hr_admin', 'super_admin'] },
    { name: 'Reporte de Equipo', href: '/reports/team', icon: FileBarChart2, description: 'Resumen de tu equipo', roles: ['manager'] },
];

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [isReportsDropdownOpen, setIsReportsDropdownOpen] = useState(false);

    const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user?.role));
    const showReportsMenu = ['manager', 'hr_admin', 'super_admin'].includes(user?.role);
    const isActive = (href) => location.pathname === href || location.pathname.startsWith(href + '/');

    const navLinkClass = (href) =>
        `inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
            isActive(href)
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
        }`;

    return (
        <nav className="bg-white border-b border-gray-200 relative z-50">

            {/* Fila 1: Logo + Usuario */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-14 border-b border-gray-100">

                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <img
                            src="https://marfund.org/en/wp-content/uploads/2017/07/logo-marfund-200.png"
                            alt="MAR Fund"
                            className="h-12 py-1 w-auto"
                        />
                        <span className="text-sm font-semibold text-gray-400 hidden sm:block border-l pl-3 border-gray-200">
                            Sistema de Vacaciones
                        </span>
                    </div>

                    {/* Usuario (desktop) */}
                    <div className="hidden md:flex items-center gap-3">
                        <div className="relative">
                            <button
                                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors focus:outline-none"
                            >
                                <User className="w-5 h-5 text-gray-400" />
                                <span className="hidden lg:block max-w-[160px] truncate">{user?.full_name}</span>
                                <span className="px-2 py-0.5 text-[10px] leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wide whitespace-nowrap">
                                    {user?.role.replace('_', ' ')}
                                </span>
                            </button>

                            {isUserDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsUserDropdownOpen(false)} />
                                    <div className="absolute right-0 top-10 z-20 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 py-1">
                                        <Link to="/profile" onClick={() => setIsUserDropdownOpen(false)}
                                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                                            <User className="w-4 h-4 text-gray-400" /> Ficha de Colaborador
                                        </Link>
                                        <button onClick={() => { setIsUserDropdownOpen(false); logout(); }}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors">
                                            <LogOut className="w-4 h-4 text-gray-400" /> Cerrar sesión
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Hamburguesa (mobile) */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
                        >
                            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Fila 2: Navegación (desktop) */}
            <div className="hidden md:block bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-1 h-11">
                        {visibleItems.map(({ name, href, icon: Icon }) => (
                            <Link key={href} to={href} className={navLinkClass(href)}>
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span>{name}</span>
                            </Link>
                        ))}

                        {/* Dropdown Reportes */}
                        {showReportsMenu && (
                            <div className="relative flex items-center h-full">
                                <button
                                    type="button"
                                    onClick={() => setIsReportsDropdownOpen(!isReportsDropdownOpen)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none ${
                                        location.pathname.startsWith('/reports')
                                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                            : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                                    }`}
                                >
                                    <BarChart3 className="w-4 h-4 flex-shrink-0" />
                                    <span>Reportes</span>
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isReportsDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isReportsDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsReportsDropdownOpen(false)} />
                                        <div className="absolute left-0 top-10 z-20 w-64 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 py-1 overflow-hidden">
                                            <div className="px-3 py-2 border-b border-gray-100">
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reportes</p>
                                            </div>
                                            {REPORT_ITEMS.filter(item => item.roles.includes(user?.role)).map(({ name, href, icon: Icon, description }) => (
                                                <Link key={href} to={href} onClick={() => setIsReportsDropdownOpen(false)}
                                                    className={`flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-indigo-50 ${isActive(href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}>
                                                    <Icon className="w-4 h-4 mt-0.5 text-indigo-500 flex-shrink-0" />
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
            </div>

            {/* Mobile menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t border-gray-100 pb-4">
                    <div className="pt-2 space-y-0.5 px-2">
                        {visibleItems.map(({ name, href, icon: Icon }) => (
                            <Link key={href} to={href} onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                                    isActive(href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                                }`}>
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {name}
                            </Link>
                        ))}

                        {showReportsMenu && (
                            <>
                                <div className="px-3 pt-3 pb-1">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Reportes</p>
                                </div>
                                {REPORT_ITEMS.filter(item => item.roles.includes(user?.role)).map(({ name, href, icon: Icon }) => (
                                    <Link key={href} to={href} onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 pl-6 pr-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                                            isActive(href) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                                        }`}>
                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                        {name}
                                    </Link>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Usuario mobile */}
                    <div className="mt-4 pt-4 border-t border-gray-200 px-4">
                        <div className="flex items-center gap-3 mb-3">
                            <User className="h-9 w-9 rounded-full text-gray-400 bg-gray-100 p-2" />
                            <div>
                                <p className="text-sm font-medium text-gray-800">{user?.full_name}</p>
                                <p className="text-xs text-gray-500">{user?.email}</p>
                            </div>
                        </div>
                        <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors">
                            <User className="w-4 h-4" /> Ficha de Colaborador
                        </Link>
                        <button onClick={logout}
                            className="flex w-full items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors mt-0.5">
                            <LogOut className="w-4 h-4" /> Cerrar Sesión
                        </button>
                    </div>
                </div>
            )}
        </nav>
    );
}
