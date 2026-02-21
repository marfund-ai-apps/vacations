import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function MainLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Aquí se renderizarán los componentes hijos según la ruta */}
                <Outlet />
            </main>
        </div>
    );
}
