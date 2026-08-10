// ============================================================
// Bono por antigüedad (Días Beneficio por Años Laborales)
// ============================================================
// El bono se asigna en ENERO, por año calendario (no en el aniversario).
// Regla oficial: el derecho se adquiere a los 3 años continuos; el primer día
// se otorga en el 1.er enero POSTERIOR al 3.er aniversario (inicio del 4.º año),
// y aumenta 1 día cada enero subsiguiente, con tope de 10.
//
// Como es por año calendario, el cálculo solo depende del AÑO de ingreso y del
// año de referencia:  dias = min( max(anioRef - anioIngreso - 3, 0), 10 )
//
// Ej. (anioRef = 2026): ingreso 2022 -> 1 · 2020 -> 3 · 2013 o antes -> 10 · 2023+ -> 0

/**
 * @param {string|Date|null} fechaIngreso  fecha de ingreso ('YYYY-MM-DD' o Date)
 * @param {number} anioRef  año calendario de referencia (default: año actual)
 * @returns {number} días de beneficio (0..10)
 */
function calcDiasBeneficioBono(fechaIngreso, anioRef = new Date().getFullYear()) {
    if (!fechaIngreso) return 0;
    // Tomar el año directo del string 'YYYY-MM-DD' evita corrimientos de zona horaria.
    const s = String(fechaIngreso);
    const anioIngreso = parseInt(s.slice(0, 4), 10);
    if (!anioIngreso) return 0;
    const dias = anioRef - anioIngreso - 3;
    return Math.min(Math.max(dias, 0), 10);
}

module.exports = { calcDiasBeneficioBono };
