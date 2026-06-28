// --- Estado ---
let schools = [];
let filteredSchools = [];
let markers = [];
let map = null;
let detailPanel = null;
let sidebar = null;
let lightbox = null;

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
  detailPanel = document.getElementById('detail-panel');
  sidebar = document.getElementById('sidebar');
  lightbox = document.getElementById('lightbox');
  // Lightbox click handler (attach after element exists)
  if (lightbox) {
    lightbox.addEventListener('click', () => {
      lightbox.classList.remove('open');
    });
  }

  // Toggle sidebar (show from left)
  const toggle = document.getElementById('sidebar-toggle');
  if (toggle) {
    function updateToggleVisibility() {
      toggle.style.display = sidebar.classList.contains('open') ? 'none' : '';
    }
    // Initial state
    updateToggleVisibility();
    // Observe class changes
    const observer = new MutationObserver(updateToggleVisibility);
    observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Close sidebar (hide to see map fullscreen)
  const sidebarClose = document.getElementById('sidebar-close');
  if (sidebarClose) {
    sidebarClose.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  }

  try {
    await loadSchools();
    filteredSchools = schools; // Show all schools on initial load
    renderSidebar();
    renderMap();

    // Filter toggle (show/hide)
    const filterToggle = document.getElementById('filter-toggle');
    const filterBar = document.getElementById('filter-bar');
    if (filterToggle && filterBar) {
      filterToggle.addEventListener('click', () => {
        const isHidden = filterBar.classList.toggle('hidden');
        filterToggle.textContent = isHidden ? '▲' : '▼';
        filterToggle.title = isHidden ? 'Mostrar filtro' : 'Ocultar filtro';
      });
      // Set initial state (bar starts hidden)
      filterToggle.textContent = '▲';
      filterToggle.title = 'Mostrar filtro';
    }

    // Orientation filter (multi-select)
    const orientationChecks = document.getElementById('orientation-filters');
    if (orientationChecks) {
      function applyOrientationFilter() {
        const checked = Array.from(orientationChecks.querySelectorAll('input[type="checkbox"]:checked'))
          .map(cb => cb.value);
        filteredSchools = checked.length > 0
          ? schools.filter(s => checked.includes(s.orientacion))
          : schools;
        renderSidebar();
        updateMarkers();
      }
      orientationChecks.addEventListener('change', applyOrientationFilter);
    }
  } catch (err) {
    showError(err.message);
  }
});

// --- Cargar datos ---
async function loadSchools() {
  const resp = await fetch('escuelas.json');
  if (!resp.ok) throw new Error('No se pudo cargar escuelas.json');
  schools = await resp.json();
}

// --- Mapa con Leaflet ---
function renderMap() {
  map = L.map('map', {
    zoomControl: false
  }).setView([40.0, -3.5], 6);

  // Capas de mapa disponibles
  const tileLayers = {
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri'
    }),
    topo: L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap'
    }),
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    })
  };

  // Satélite por defecto
  tileLayers.satellite.addTo(map);

  // Selector de capas
  L.control.layers(tileLayers, null, {
    position: 'topright',
    title: 'Mapa',
    collapsed: false
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  schools.forEach((s) => {
    const markerName = s.nombre_extendido || s.nombre;
    const icon = L.divIcon({
      className: 'custom-marker-wrapper',
      html: `<div class="custom-marker"><span class="marker-label">${markerName}</span></div>`,
      iconSize: [100, 30],
      iconAnchor: [50, 15]
    });
    const marker = L.marker([s.latitud, s.longitud], { icon });
    marker.addTo(map);
    marker.on('click', () => openDetail(schools.indexOf(s)));
    markers.push(marker);
  });

  // Ajustar vista si hay escuelas
  if (schools.length > 0) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

// --- Sidebar ---
function renderSidebar() {
  const list = document.getElementById('school-list');
  list.innerHTML = '';

  if (filteredSchools.length === 0) {
    list.innerHTML = '<div class="loading">No hay escuelas que coincidan</div>';
    return;
  }

  filteredSchools.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'school-item';
    item.innerHTML = `
      <h2>${s.nombre_extendido || s.nombre}</h2>
      ${s.orientacion ? `<div class="orientacion">Orientación: ${s.orientacion}</div>` : ''}
    `;
    item.addEventListener('click', () => {
      const originalIndex = schools.indexOf(s);
      openDetail(originalIndex);
      sidebar.classList.remove('open');
    });
    list.appendChild(item);
  });
}

// --- Panel de detalles ---
function openDetail(index) {
  const s = schools[index];

  let html = '';

  // Título
  html += `<div class="close-btn" onclick="closeDetail()">✕</div>`;
  html += `<div class="detail-handle"></div>`;
  html += `<div class="detail-content">`;
  html += `<h2>${s.nombre_extendido || s.nombre}</h2>`;

  // Campos opcionales
  if (s.orientacion) {
    html += infoRow('Orientación', s.orientacion);
  }

  // Sun hours chart
  if (s.orientacion) {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const sunInfo = horasSol(currentMonth, s.orientacion);
    if (sunInfo.horas !== null) {
      html += sunHoursPieHTML(s.orientacion, sunInfo);
    }
  }
  if (s.enlace_8a) {
    html += infoRow('8a.nu', `<a href="${s.enlace_8a}" target="_blank" rel="noopener">${s.enlace_8a}</a>`);
  }
  if (s.descripcion) {
    html += `<div class="descripcion">${s.descripcion}</div>`;
  }
  if (s.enlace) {
    html += infoRow('Enlace', `<a href="${s.enlace}" target="_blank" rel="noopener">${s.enlace}</a>`);
  }

  // Croquis
  const croquisPath = `croquis/${s.nombre}/`;
  html += `<div class="croquis-section" id="croquis-section">`;
  html += `<h3>Croquis</h3>`;
  html += `<div class="croquis-grid" id="croquis-grid">`;
  html += `<div class="loading">Cargando...</div>`;
  html += `</div></div>`;

  html += `</div>`;

  detailPanel.innerHTML = html;
  detailPanel.classList.add('open');

  // Cargar imágenes del croquis
  loadCroquis(s, croquisPath);

  // Centrar mapa
  if (map) {
    map.flyTo([s.latitud, s.longitud], 15, { duration: 0.8 });
  }
}

function closeDetail() {
  detailPanel.classList.remove('open');
}

// --- Actualizar visibilidad de marcadores ---
function updateMarkers() {
  markers.forEach((marker, i) => {
    const school = schools[i];
    const show = filteredSchools.includes(school);
    if (show) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  });

  // Ajustar vista del mapa a los marcadores visibles
  const visibleMarkers = [];
  markers.forEach((marker, i) => {
    if (filteredSchools.includes(schools[i])) {
      visibleMarkers.push(marker);
    }
  });
  if (visibleMarkers.length > 0) {
    const group = L.featureGroup(visibleMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

function infoRow(label, value) {
  return `<div class="info-row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function isUrl(str) {
  try {
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// --- Cargar croquis ---
function loadCroquis(school, basePath) {
  const grid = document.getElementById('croquis-grid');
  if (!school.croquis || !Array.isArray(school.croquis) || school.croquis.length === 0) {
    grid.innerHTML = '<div style="color:#999;padding:8px 0;font-size:0.9rem;">No hay croquis disponibles</div>';
    return;
  }

  let loadedCount = 0;
  let anyLoaded = false;
  const total = school.croquis.length;

  grid.innerHTML = '';

  function checkDone() {
    loadedCount++;
    if (loadedCount >= total) {
      if (anyLoaded) {
        grid.querySelectorAll('img').forEach(i => i.style.display = '');
      } else {
        grid.innerHTML = '<div style="color:#999;padding:8px 0;font-size:0.9rem;">No se pudieron cargar los croquis</div>';
      }
    }
  }

  for (const entry of school.croquis) {
    // Determinar la URL final: si ya es URL, usarla tal cual; si es path relativo, concatenar con basePath
    const finalUrl = isUrl(entry) ? entry : `${basePath}${entry}`;
    const img = document.createElement('img');
    img.src = finalUrl;
    img.alt = 'Croquis';
    img.loading = 'lazy';
    img.style.display = 'none';
    img.addEventListener('click', () => openLightbox(finalUrl));

    img.addEventListener('load', () => {
      anyLoaded = true;
      checkDone();
    });

    img.addEventListener('error', () => {
      img.remove();
      checkDone();
    });

    grid.appendChild(img);
  }
}

// --- Lightbox ---
function openLightbox(src) {
  lightbox.innerHTML = `<img src="${src}" alt="Croquis">`;
  lightbox.classList.add('open');
}

// --- Error ---
function showError(msg) {
  document.getElementById('map').innerHTML =
    `<div class="error-msg"><h3>Error</h3><p>${msg}</p></div>`;
}

// --- Sun hours horizontal bar chart ---
const SUN_START = 9;  // 9:00
const SUN_END = 21;   // 21:00
const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function sunHoursPieHTML(orientacion, sunInfo) {
  const horas = sunInfo.horas;
  let html = `
    <div class="sun-hours-section">
      <h3>☀️ Horas de sol</h3>
      <div class="sun-bar-container">
        <canvas id="sun-bar-canvas" width="280" height="80"></canvas>
      </div>
      <div class="sun-time-range" id="sun-time-range"></div>
    </div>`;

  setTimeout(() => drawSunBar(orientacion, sunInfo), 50);
  return html;
}

function drawSunBar(orientacion, sunInfo) {
  const canvas = document.getElementById('sun-bar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const inicio = sunInfo.inicio;
  const fin = sunInfo.fin;

  const barTop = 22;
  const barHeight = 18;
  const barLeft = 30;
  const barRight = W - 15;
  const barWidth = barRight - barLeft;

  // Convert hour (0-24) to x position within the bar range [SUN_START, SUN_END]
  function hourToX(h) {
    return barLeft + ((h - SUN_START) / (SUN_END - SUN_START)) * barWidth;
  }

  // Background bar (9h-21h range)
  ctx.fillStyle = '#f0f0f0';
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  const bgR = 4;
  ctx.beginPath();
  ctx.roundRect(barLeft, barTop, barWidth, barHeight, bgR);
  ctx.fill();
  ctx.stroke();

  if (inicio !== null && fin !== null) {
    // Clamp sun window to [9, 21]
    const clampedInicio = Math.max(inicio, SUN_START);
    const clampedFin = Math.min(fin, SUN_END);

    if (clampedInicio < clampedFin) {
      // Sun-colored bar segment
      const sunGrad = ctx.createLinearGradient(hourToX(clampedInicio), 0, hourToX(clampedFin), 0);
      sunGrad.addColorStop(0, '#f4a623');
      sunGrad.addColorStop(1, '#f7c948');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.roundRect(hourToX(clampedInicio), barTop, hourToX(clampedFin) - hourToX(clampedInicio), barHeight, bgR);
      ctx.fill();
    }
  }

  // Hour tick marks and labels (every 2 hours: 9, 11, 13, 15, 17, 19, 21)
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let h = SUN_START; h <= SUN_END; h += 2) {
    const x = hourToX(h);

    // Tick line
    ctx.beginPath();
    ctx.moveTo(x, barTop + barHeight);
    ctx.lineTo(x, barTop + barHeight + 6);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Hour label
    ctx.fillStyle = '#666';
    ctx.fillText(`${h}:00`, x, barTop + barHeight + 8);
  }

  // Start / end markers above the bar
  if (inicio !== null && fin !== null) {
    const clampedInicio = Math.max(inicio, SUN_START);
    const clampedFin = Math.min(fin, SUN_END);

    // Start marker
    if (clampedInicio <= SUN_END) {
      const startX = hourToX(clampedInicio);
      ctx.font = 'bold 9px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#f4a623';
      const startLabel = `${Math.round(clampedInicio)}:00`;
      ctx.fillText(startLabel, startX, barTop - 2);
    }

    // End marker
    if (clampedFin >= SUN_START) {
      const endX = hourToX(clampedFin);
      ctx.font = 'bold 9px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#f4a623';
      const endLabel = `${Math.round(clampedFin)}:00`;
      ctx.fillText(endLabel, endX, barTop - 2);
    }
  }

  // // Current month info below hour labels
  // const info = document.getElementById('sun-time-range');
  // if (info) {
  //   const currentMonth = new Date().getMonth() + 1;
  //   const r = horasSol(currentMonth, orientacion);
  //   if (r.horas == null) {
  //     const startStr = `${Math.round(r.inicio).toString().padStart(2, '0')}:00`;
  //     const endStr = `${Math.round(r.fin).toString().padStart(2, '0')}:00`;
  //     info.textContent = `${startStr} – ${endStr} (${r.horas.toFixed(1)} h)`;
  //   } else {
  //     info.textContent = 'Sin sol directo';
  //   }
  // }
}
