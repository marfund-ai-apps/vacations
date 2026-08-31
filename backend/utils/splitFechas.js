// ============================================================
// Split de un rango de vacaciones en dos partidas por días hábiles:
//   base (días más tempranos)  +  bono (días finales)
// El corte se hace en `baseUsed` días hábiles. Permite corte fraccionario
// (medio día) cuando la base disponible no es entera.
// ============================================================

const iso = (d) => d.toISOString().slice(0, 10);

// Lista de días hábiles (Lun–Vie) entre from y to (inclusive), 'YYYY-MM-DD'
function enumerateWeekdays(from, to) {
    const out = [];
    const d = new Date(from + 'T12:00:00Z');
    const end = new Date(to + 'T12:00:00Z');
    while (d <= end) {
        const dow = d.getUTCDay();
        if (dow !== 0 && dow !== 6) out.push(iso(new Date(d)));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

// Convierte los rangos en una lista plana de unidades { date, frac }.
// El medio día (si business_days = hábiles − 0.5) recae en el último día del rango.
function toDayUnits(dateRanges) {
    const units = [];
    for (const r of dateRanges) {
        const days = enumerateWeekdays(r.date_from, r.date_to);
        if (!days.length) continue;
        const total = parseFloat(r.business_days);
        const lastFrac = total - (days.length - 1); // 1.0 o 0.5 normalmente
        days.forEach((date, i) => {
            units.push({ date, frac: i === days.length - 1 ? lastFrac : 1 });
        });
    }
    units.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return units;
}

// Arma un rango contiguo [min..max] a partir de una lista de unidades.
function unitsToRange(units) {
    if (!units.length) return null;
    const dates = units.map(u => u.date);
    const business = units.reduce((s, u) => s + u.frac, 0);
    return {
        date_from: dates[0],
        date_to: dates[dates.length - 1],
        business_days: Math.round(business * 100) / 100,
    };
}

/**
 * @param {Array} dateRanges  [{date_from,date_to,business_days}]
 * @param {number} baseUsed   días hábiles que cubre la base (el resto va a bono)
 * @returns {{ baseRange, bonoRange, baseDays, bonoDays }}
 */
function splitByBusinessDays(dateRanges, baseUsed) {
    const units = toDayUnits(dateRanges);
    const baseUnits = [];
    const bonoUnits = [];
    let remaining = baseUsed;

    for (const u of units) {
        if (remaining >= u.frac - 1e-9) {
            baseUnits.push(u);
            remaining -= u.frac;
        } else if (remaining > 1e-9) {
            // corte fraccionario dentro de un día: base toma `remaining`, bono el resto
            baseUnits.push({ date: u.date, frac: Math.round(remaining * 100) / 100 });
            bonoUnits.push({ date: u.date, frac: Math.round((u.frac - remaining) * 100) / 100 });
            remaining = 0;
        } else {
            bonoUnits.push(u);
        }
    }

    const baseRange = unitsToRange(baseUnits);
    const bonoRange = unitsToRange(bonoUnits);
    return {
        baseRange,
        bonoRange,
        baseDays: baseRange ? baseRange.business_days : 0,
        bonoDays: bonoRange ? bonoRange.business_days : 0,
    };
}

module.exports = { splitByBusinessDays, enumerateWeekdays };
