const axios = require('axios');

const N8N_BASE_URL = process.env.N8N_BASE_URL; // ej: https://n8n.tudominio.com

const WEBHOOKS = {
    NEW_REQUEST: process.env.N8N_WEBHOOK_NEW_REQUEST,
    DECISION: process.env.N8N_WEBHOOK_DECISION,
};

// Formatea el tipo de solicitud para mostrar en emails
const formatRequestType = (type) => ({
    vacation: 'Vacaciones',
    permission: 'Permiso',
    justified_absence: 'Ausencia Justificada'
}[type] || type);

// Formatea fechas legibles
const formatDate = (date) => new Date(date).toLocaleDateString('es-GT', {
    day: '2-digit', month: 'long', year: 'numeric'
});

// Genera tabla HTML de fechas para emails
const buildDatesTable = (dateRanges) => {
    const rows = dateRanges.map(r => `
    <tr>
      <td style="padding:8px; border:1px solid #ddd;">${formatDate(r.date_from)}</td>
      <td style="padding:8px; border:1px solid #ddd;">${formatDate(r.date_to)}</td>
      <td style="padding:8px; border:1px solid #ddd; text-align:center;">${r.business_days}</td>
    </tr>
  `).join('');

    return `
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <thead>
        <tr style="background:#374151; color:white;">
          <th style="padding:10px; border:1px solid #ddd;">Fecha Inicio</th>
          <th style="padding:10px; border:1px solid #ddd;">Fecha Fin</th>
          <th style="padding:10px; border:1px solid #ddd;">Días Hábiles</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

// ═══════════════════════════════════════════════════════════
// NOTIFICACIÓN 1: Nueva solicitud creada
// Envía a: empleado, jefe inmediato, RRHH
// ═══════════════════════════════════════════════════════════
exports.triggerNewRequest = async ({ request, dateRanges, totalDays, approveToken, rejectToken, appUrl }) => {
    const datesTable = buildDatesTable(dateRanges);
    const requestTypeLabel = formatRequestType(request.request_type);

    // Links de acción directa para el jefe (desde email)
    const approveUrl = `${appUrl}/api/requests/token/${approveToken}?action=approve`;
    const rejectUrl = `${appUrl}/api/requests/token/${rejectToken}?action=reject`;

    const payload = {
        // Metadatos de la solicitud
        request_number: request.request_number,
        request_type: requestTypeLabel,
        reason: request.reason,
        notes: request.notes,
        total_days: totalDays,
        created_at: formatDate(request.created_at),
        dates_table_html: datesTable,

        // Datos del empleado
        employee_name: request.employee_name,
        employee_email: request.employee_email,
        employee_position: request.employee_position,
        employee_number: request.employee_number,

        // Datos del jefe
        manager_name: request.manager_name,
        manager_email: request.manager_email,

        // Links de aprobación por email
        approve_url: approveUrl,
        reject_url: rejectUrl,
        app_url: appUrl,
    };

    try {
        if (WEBHOOKS.NEW_REQUEST) {
            await axios.post(WEBHOOKS.NEW_REQUEST, payload);
            console.log(`[n8n] Nueva solicitud ${request.request_number} notificada`);
        } else {
            console.warn('[n8n] Webhook de nueva solicitud no configurado en .env');
        }
    } catch (err) {
        console.error('[n8n] Error al disparar webhook nueva solicitud:', err.message);
    }
};

// ═══════════════════════════════════════════════════════════
// NOTIFICACIÓN 2: Decisión del jefe (aprobado/rechazado)
// Envía a: empleado, RRHH
// ═══════════════════════════════════════════════════════════
exports.triggerDecisionNotification = async ({ request, decision, comments, dateRanges, totalDays, hrUsers, appUrl }) => {
    const datesTable = buildDatesTable(dateRanges);
    const statusLabel = decision === 'approved' ? 'APROBADA ✅' : 'RECHAZADA ❌';
    const statusColor = decision === 'approved' ? '#059669' : '#DC2626';

    const payload = {
        request_number: request.request_number,
        request_type: formatRequestType(request.request_type),
        decision,
        decision_label: statusLabel,
        decision_color: statusColor,
        manager_comments: comments || 'Sin comentarios adicionales',
        total_days: totalDays,
        dates_table_html: datesTable,
        decision_date: formatDate(new Date()),

        employee_name: request.employee_name,
        employee_email: request.employee_email,
        manager_name: request.manager_name,
        manager_email: request.manager_email,

        // Lista de correos de RRHH para notificar
        hr_emails: hrUsers.map(u => u.email),
        hr_names: hrUsers.map(u => u.full_name),

        app_url: appUrl,
    };

    try {
        if (WEBHOOKS.DECISION) {
            await axios.post(WEBHOOKS.DECISION, payload);
            console.log(`[n8n] Decisión ${decision} de ${request.request_number} notificada`);
        } else {
            console.warn('[n8n] Webhook de decisión no configurado en .env');
        }
    } catch (err) {
        console.error('[n8n] Error al disparar webhook decisión:', err.message);
    }
};
