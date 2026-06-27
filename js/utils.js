// =============================================================================
// horasSol() — Horas de sol directo por mes y orientación de pared
// =============================================================================
//
// Cada orientación tiene un horario BASE. El código aplica automáticamente:
//   1. Multiplicador estacional → alarga (verano) o encoge (invierno) la duración
//   2. Desplazamiento direccional → mueve la ventana horaria:
//        mañana → sale antes en verano
//        tarde  → se va más tarde en verano
//        sur    → no se desplaza (ya cubre todo el día)
//
// Para ajustar: modifica `horasSolBase` y `orientacionFactor`.
// =============================================================================

// --- Mapa base: horario de referencia por orientación ---
// Cada valor es un rango [inicio, fin] en hora decimal
const horasSolBase = {
  N:  { inicio: null, fin: null },   // NUNCA da sol directo
  NE: { inicio: 10,   fin: 14  },   // 4h de mañana
  E:  { inicio: 9,    fin: 14  },   // 5h
  SE: { inicio: 8,    fin: 15  },   // 7h
  S:  { inicio: 10,   fin: 18  },   // 8h (todo el día)
  SW: { inicio: 13,   fin: 17  },   // 4h de tarde
  W:  { inicio: 14,   fin: 17  },   // 3h de tarde (sol poniente)
  NW: { inicio: null, fin: null },   // NUNCA da sol directo
};

// --- Factor direccional para el desplazamiento estacional ---
// Negativo → orientación de mañana → la ventana se adelanta en verano
// Positivo → orientación de tarde → la ventana se retrasa en verano
// Cero   → orientación ecuatorial (S) → no se desplaza
const orientacionFactor = {
  N:  0,
  NE: -1.0,
  E:  -0.6,
  SE: -0.3,
  S:  0,
  SW:  0.3,
  W:  0.6,
  NW: 1.0,
};

/**
 * Multiplicador estacional de duración:
 *   1.3 → verano (días largos, más horas de sol)
 *   1.0 → equinoccios (primavera/otoño)
 *   0.7 → invierno (días cortos, menos horas de sol)
 */
const estacional = (mes) => {
  const m = Math.max(1, Math.min(12, mes));
  // coseno: máximo (1) en junio (mes 6), mínimo (-1) en diciembre (mes 12)
  const valor = Math.cos(((m - 6) / 12) * 2 * Math.PI);
  return 1.0 + 0.3 * valor; // escala: [0.7, 1.3]
};

/**
 * Devuelve las horas de sol directo para una orientación y mes dados.
 *
 * @param {number} mes         — 1 (enero) a 12 (diciembre)
 * @param {string} orientacion — 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'
 * @returns {{ inicio: number|null, fin: number|null, horas: number|null }}
 *
 * @example
 * horasSol(7, 'NE')  // → { inicio: 9.1, fin: 14.3, horas: 5.2 }  → 09:06 – 14:18
 * horasSol(1, 'NE')  // → { inicio: 10.9, fin: 13.7, horas: 2.8 } → 10:54 – 13:42
 * horasSol(6, 'N')   // → { inicio: null, fin: null, horas: null } (sin sol directo)
 */
function horasSol(mes, orientacion) {
  const key = normalizeOrientacion(orientacion);
  const base = horasSolBase[key];

  if (!base || base.inicio === null) {
    return { inicio: null, fin: null, horas: null };
  }

  const duracionBase = base.fin - base.inicio;
  const mult = estacional(mes);
  const factor = orientacionFactor[key];

  // Duración corregida por estación
  const duracionFinal = duracionBase * mult;

  // Desplazamiento: 0 en equinoccios, máximo en solsticios
  // Signo depende de la orientación (factor)
  const desplazamiento = factor * (mult - 1);

  // Nueva ventana centrada en el centro desplazado
  const centro = (base.inicio + base.fin) / 2;
  const nuevoCentro = centro + desplazamiento;

  return {
    inicio: nuevoCentro - duracionFinal / 2,
    fin:    nuevoCentro + duracionFinal / 2,
    horas:  duracionFinal,
  };
}

/**
 * Normaliza la cadena de orientación a mayúsculas y quita guiones/espacios.
 * 'ne' → 'NE', 'suroeste' → 'SW', etc.
 */
function normalizeOrientacion(orientacion) {
  if (!orientacion) return null;

  const nombresCompletos = {
    'norte':      'N',
    'noreste':    'NE',
    'ne':         'NE',
    'nordeste':   'NE',
    'este':       'E',
    'sureste':    'SE',
    'se':         'SE',
    'sudeste':    'SE',
    'sur':        'S',
    'suroeste':   'SW',
    'su':         'SW',
    'sudoeste':   'SW',
    'oeste':      'W',
    'west':       'W',
    'nw':         'NW',
    'noroeste':   'NW',
    'no':         'NW',
  };

  const key = orientacion.trim().toLowerCase();
  return nombresCompletos[key] || key.toUpperCase();
}

/**
 * Convierte hora decimal a cadena legible.
 * 9.5 → "9:30"  |  14.5 → "14:30"
 */
function horaDecimalAHumana(horaDecimal) {
  if (horaDecimal === null) return '--';
  const h = Math.floor(horaDecimal);
  const m = Math.round((horaDecimal - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Formatea el resultado de horasSol en una cadena legible.
 * horasSolFormato(7, 'NE') → "09:06 – 14:18 (5.2 h)"
 */
function horasSolFormato(mes, orientacion) {
  const r = horasSol(mes, orientacion);
  if (r.horas === null) return 'Sin sol directo';
  return `${horaDecimalAHumana(r.inicio)} – ${horaDecimalAHumana(r.fin)} (${r.horas.toFixed(1)} h)`;
}

// Export para módulos (si se usa bundler) o dejar en global para script directo
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { horasSol, horasSolBase, orientacionFactor, normalizeOrientacion, horaDecimalAHumana, horasSolFormato };
}
