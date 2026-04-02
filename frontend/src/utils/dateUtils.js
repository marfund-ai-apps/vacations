const LOCALE = 'es-GT';

/**
 * Formatea una fecha como dd/mm/yyyy
 * Acepta string ISO (ej. "2026-04-02") o Date object
 */
export function formatDate(dateStr) {
    if (!dateStr) return '—';
    // Parsear como UTC para evitar desfase de zona horaria en fechas sin hora
    const date = typeof dateStr === 'string' && dateStr.length === 10
        ? new Date(dateStr + 'T12:00:00Z')
        : new Date(dateStr);
    return date.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formatea un timestamp como dd/mm/yyyy, HH:mm
 */
export function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ', ' + date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}
