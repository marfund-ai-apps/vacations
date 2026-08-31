const axios = require('axios');

const WEBHOOK_URL = 'https://marfund-ia-n8n.9867lv.easypanel.host/webhook-test/decision-final';

const mockPayload = {
  request_number: 'VAC-2026-0001',
  request_type: 'Vacaciones',
  decision: 'approved',
  decision_label: 'APROBADA ✅',
  decision_color: '#059669',
  manager_comments: '¡Que disfrutes tu viaje!',
  total_days: 5,
  dates_table_html: `
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <thead>
        <tr style="background:#374151; color:white;">
          <th style="padding:10px; border:1px solid #ddd;">Fecha Inicio</th>
          <th style="padding:10px; border:1px solid #ddd;">Fecha Fin</th>
          <th style="padding:10px; border:1px solid #ddd;">Días Hábiles</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">23 de febrero de 2026</td>
          <td style="padding:8px; border:1px solid #ddd;">27 de febrero de 2026</td>
          <td style="padding:8px; border:1px solid #ddd; text-align:center;">5</td>
        </tr>
      </tbody>
    </table>
    `,
  decision_date: '21 de febrero de 2026',
  employee_name: 'Juan Pérez',
  employee_email: 'jperez@marfund.org',
  manager_name: 'María García (Jefa)',
  manager_email: 'mgarcia@marfund.org',
  hr_emails: ['rrhh1@marfund.org', 'rrhh2@marfund.org'],
  hr_names: ['Admin HR', 'Directora HR'],
  app_url: 'https://app-vacations.marfund.org'
};

console.log('Enviando payload de DECISIÓN (PRUEBA) a n8n...');

axios.post(WEBHOOK_URL, mockPayload)
  .then(res => console.log('✅ Éxito! n8n respondió para decisión:', res.data))
  .catch(err => console.error('❌ Error enviando a n8n:', err.message));
