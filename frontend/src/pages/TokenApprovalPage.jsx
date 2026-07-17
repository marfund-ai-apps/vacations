import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function TokenApprovalPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [requestData, setRequestData] = useState(null);
  const [action, setAction] = useState(null); // 'approve' o 'reject'
  const [comment, setComment] = useState('');

  // Validar token al montar
  useEffect(() => {
    const validateToken = async () => {
      try {
        const res = await api.get(`/api/requests/token/${token}/validate`);
        setRequestData(res.data);
        setAction(res.data.action);
        setIsLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Token inválido o expirado');
        setIsLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await api.post(`/api/requests/token/${token}/approve`);
      setSuccess('✅ Solicitud aprobada exitosamente');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al aprobar la solicitud');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      setError('Por favor escribe un motivo de rechazo');
      return;
    }

    setIsProcessing(true);
    try {
      await api.post(`/api/requests/token/${token}/reject`, { comment });
      setSuccess('❌ Solicitud rechazada con comentario');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al rechazar la solicitud');
    } finally {
      setIsProcessing(false);
    }
  };

  // Estado de carga
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validando token...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error && !requestData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center gap-3 mb-4 text-red-600">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <h2 className="text-lg font-semibold">Error</h2>
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition-colors"
          >
            Volver a Inicio
          </button>
        </div>
      </div>
    );
  }

  // Éxito
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">{success.includes('aprobada') ? '✅' : '❌'}</div>
          <p className="text-gray-600">{success}</p>
          <p className="text-sm text-gray-500 mt-4">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  // Formulario de aprobación/rechazo
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">

        {/* Encabezado */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Solicitud #{requestData?.request_number}
          </h1>
          <p className="text-sm text-gray-500">Toma una decisión sobre esta solicitud</p>
        </div>

        {/* Datos de la solicitud */}
        <div className="space-y-3 bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Colaborador</p>
            <p className="text-gray-800 font-medium">{requestData?.employee_name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Tipo de Solicitud</p>
            <p className="text-gray-800 font-medium">{requestData?.request_type}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Total de Días</p>
            <p className="text-gray-800 font-medium">{requestData?.total_days} días</p>
          </div>
        </div>

        {/* Error local */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Contenido según la acción */}
        {action === 'approve' ? (
          // Vista de Aprobación
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">
                ¿Deseas <strong>aprobar</strong> esta solicitud?
              </p>
            </div>
            <button
              onClick={handleApprove}
              disabled={isProcessing}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-green-100"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Sí, Aprobar Solicitud
                </>
              )}
            </button>
          </div>
        ) : (
          // Vista de Rechazo
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                ¿Deseas <strong>rechazar</strong> esta solicitud?
              </p>
            </div>

            <label className="block">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Motivo del Rechazo *
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ej: No hay cobertura en ese período, o no hay presupuesto disponible..."
                className="w-full border-2 border-gray-300 rounded-lg p-3 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 resize-none"
                rows="4"
                disabled={isProcessing}
              />
              <p className="text-xs text-gray-500 mt-1">
                El colaborador recibirá este motivo en su notificación
              </p>
            </label>

            <button
              onClick={handleReject}
              disabled={isProcessing || !comment.trim()}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-red-100"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  Rechazar con Comentario
                </>
              )}
            </button>
          </div>
        )}

        {/* Pie de página */}
        <p className="text-xs text-gray-500 text-center mt-6 pt-4 border-t border-gray-200">
          Este enlace expira en 7 días
        </p>
      </div>
    </div>
  );
}
