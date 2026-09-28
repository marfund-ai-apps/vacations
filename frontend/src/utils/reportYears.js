// Años disponibles en los filtros de reportes.
// El sistema inició en 2026; se listan hasta 2030, pero solo se habilitan
// los años que ya ocurrieron (≤ año actual). Los futuros se muestran deshabilitados.
export const REPORT_START_YEAR = 2026;
export const REPORT_END_YEAR = 2030;

export const REPORT_YEARS = Array.from(
    { length: REPORT_END_YEAR - REPORT_START_YEAR + 1 },
    (_, i) => REPORT_START_YEAR + i
);

export const isFutureYear = (year) => Number(year) > new Date().getFullYear();
