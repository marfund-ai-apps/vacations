import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (user) navigate('/dashboard');

        // Handle error query parameter
        const params = new URLSearchParams(location.search);
        const errorParam = params.get('error');
        if (errorParam === 'unregistered') {
            setErrorMsg('Solo usuarios registrados de MAR Fund pueden ingresar al sistema.');
        } else if (errorParam) {
            setErrorMsg('Ocurrió un error al iniciar sesión. Por favor, intenta de nuevo.');
        }
    }, [user, navigate, location]);

    const handleGoogleLogin = () => {
        window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <img
                        src="https://marfund.org/en/wp-content/uploads/2017/07/logo-marfund-200.png"
                        alt="MAR Fund Logo"
                        className="h-24 w-auto object-contain"
                    />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Sistema de Vacaciones</h1>
                <p className="text-gray-500 mb-8">Solicitud y gestión de permisos y vacaciones</p>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 
                     hover:border-indigo-400 hover:bg-indigo-50 text-gray-700 font-medium py-3 px-6 
                     rounded-xl transition-all duration-200 shadow-sm hover:shadow"
                >
                    {/* Logo SVG genérico de Google */}
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                    Iniciar sesión con Gmail
                </button>

                {errorMsg && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                        {errorMsg}
                    </div>
                )}

                <p className="mt-6 text-xs text-gray-400">
                    Solo usuarios autorizados de MAR Fund
                </p>
            </div>
        </div>
    );
}
