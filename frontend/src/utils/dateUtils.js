const LOCALE = 'es-GT';
const TZ = 'America/Guatemala'; // UTC-6, sin horario de verano

/**
 * Formatea una fecha como dd/mm/yyyy
 * Acepta string ISO (ej. "2026-04-02") o Date object
 */
export function formatDate(dateStr) {
    if (!dateStr) return '—';
    // Fechas sin hora (YYYY-MM-DD): anclar al mediodía UTC para evitar desfase
    const date = typeof dateStr === 'string' && dateStr.length === 10
        ? new Date(dateStr + 'T12:00:00Z')
        : new Date(dateStr);
    return date.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
}

/**
 * Formatea un timestamp como dd/mm/yyyy, HH:mm (hora Guatemala UTC-6)
 */
export function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString(LOCALE, {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: TZ
    });
}
