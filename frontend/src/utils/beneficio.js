// Espejo de backend/utils/beneficioAnios.js — solo para preview en vivo en la Ficha.
// El valor real siempre lo calcula y persiste el backend.
// dias = min( max(anioRef - anioIngreso - 3, 0), 10 )  (bono asignado en enero, por año calendario)
export function calcDiasBeneficioBono(fechaIngreso, anioRef = new Date().getFullYear()) {
    if (!fechaIngreso) return 0;
    const anioIngreso = parseInt(String(fechaIngreso).slice(0, 4), 10);
    if (!anioIngreso) return 0;
    return Math.min(Math.max(anioRef - anioIngreso - 3, 0), 10);
}
