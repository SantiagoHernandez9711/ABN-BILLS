let lineId = 0;
let calEvents =[]

function addLine(date, building, rate, hours) {
  const id = lineId;
  lineId = lineId + 1;

  const container = document.getElementById('lines-container');

  const div = document.createElement('div');
  div.className = 'line-row';
  div.id = 'line-' + id;

  const dateValue = date || '';
  const buildingValue = building || '';
  const rateValue = rate || '30';
  const hoursValue = hours || '';

  div.innerHTML =
    '<input type="date" value="' + dateValue + '" oninput="recalc(' + id + ')">' +
    '<input type="text" placeholder="Ej: Tooronga" value="' + buildingValue + '">' +
    '<input type="number" min="0" step="0.5" value="' + rateValue + '" oninput="recalc(' + id + ')">' +
    '<input type="number" min="0" step="0.25" value="' + hoursValue + '" oninput="recalc(' + id + ')">' +
    '<div class="line-total" id="lt-' + id + '">$0.00</div>' +
    '<button class="btn-remove" onclick="removeLine(' + id + ')">×</button>';

  container.appendChild(div);
  recalc(id);
}

function removeLine(id) {
  const el = document.getElementById('line-' + id);
  if (el) {
    el.remove();
  }
}

function recalc(id) {
  const row = document.getElementById('line-' + id);
  if (!row) return;

  const inputs = row.querySelectorAll('input');
  const rate = parseFloat(inputs[2].value) || 0;
  const hours = parseFloat(inputs[3].value) || 0;

  const total = rate * hours;
  document.getElementById('lt-' + id).textContent = '$' + total.toFixed(2);

  updateTotals();
}

function updateTotals() {
  let sumHours = 0;
  let sumTotal = 0;

  const rows = document.querySelectorAll('.line-row');

  rows.forEach(function(row) {
    const inputs = row.querySelectorAll('input');
    const rate = parseFloat(inputs[2].value) || 0;
    const hours = parseFloat(inputs[3].value) || 0;

    sumHours = sumHours + hours;
    sumTotal = sumTotal + (rate * hours);
  });

  document.getElementById('sum-hours').textContent = sumHours.toFixed(2);
  document.getElementById('sum-total').textContent = '$' + sumTotal.toFixed(2);
}
function loadCalendar() {
  const url = document.getElementById('ics-url').value.trim();
  if (!url) return;

  const btn = document.getElementById('btn-load');
  btn.disabled = true;
  btn.textContent = 'Cargando...';

  const proxyUrl = '/.netlify/functions/proxy?url=' + encodeURIComponent(url);

  fetch(proxyUrl)
    .then(function(response) {
      if (!response.ok) throw new Error('Status ' + response.status);
      return response.text();
    })
    .then(function(text) {
      if (text.indexOf('BEGIN:VCALENDAR') === -1) {
        throw new Error('Respuesta no válida');
      }
      parseICS(text);
      renderEvents();
      btn.disabled = false;
      btn.textContent = 'Cargar calendario';
    })
    .catch(function(error) {
      console.log('Error:', error.message);
      document.getElementById('events-container').textContent = 'No se pudo cargar. Intenta de nuevo.';
      btn.disabled = false;
      btn.textContent = 'Cargar calendario';
    });
}

function parseICS(text) {
  calEvents = [];

  const lines = text.split(/\r?\n/);
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    }
    else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.start && currentEvent.end && currentEvent.summary) {
        const hours = (currentEvent.end - currentEvent.start) / 3600000;

        calEvents.push({
          summary: currentEvent.summary,
          start: currentEvent.start,
          hours: Math.round(hours * 4) / 4
        });
      }
      currentEvent = null;
    }
    else if (currentEvent) {
      if (line.indexOf('DTSTART') === 0) {
        currentEvent.start = parseICSDate(line);
      }
      else if (line.indexOf('DTEND') === 0) {
        currentEvent.end = parseICSDate(line);
      }
      else if (line.indexOf('SUMMARY') === 0) {
        currentEvent.summary = line.replace(/^SUMMARY:/, '').trim();
      }
    }
  }
  calEvents.sort(function(a, b) {
  return a.start - b.start;
  });

  console.log('Turnos encontrados:', calEvents);
}

function parseICSDate(line) {
  const colonIndex = line.lastIndexOf(':');
  const val = line.substring(colonIndex + 1).trim().replace('Z', '');

  const year = parseInt(val.substr(0, 4));
  const month = parseInt(val.substr(4, 2)) - 1;
  const day = parseInt(val.substr(6, 2));
  const hour = parseInt(val.substr(9, 2) || '0');
  const minute = parseInt(val.substr(11, 2) || '0');

  return new Date(year, month, day, hour, minute, 0);
}
function renderEvents() {
  document.getElementById('filter-bar').style.display = 'block';

  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const place = document.getElementById('filter-place').value.toLowerCase();

  const filtered = [];

  for (let i = 0; i < calEvents.length; i++) {
    const ev = calEvents[i];
    const d = ev.start;
    const dateISO = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);

    if (from && dateISO < from) continue;
    if (to && dateISO > to) continue;
    if (place && ev.summary.toLowerCase().indexOf(place) === -1) continue;

    filtered.push(i);
  }

  if (filtered.length === 0) {
    document.getElementById('events-container').textContent = 'No se encontraron turnos con ese filtro.';
    return;
  }

  let html = '<div class="event-header">';
  html += '<span>Fecha</span>';
  html += '<span>Turno</span>';
  html += '<span>Horas</span>';
  html += '<span>Usar</span>';
  html += '</div>';
  html += '<div id="events-list">';

  for (let j = 0; j < filtered.length; j++) {
    const i = filtered[j];
    const ev = calEvents[i];
    const d = ev.start;
    const dateStr = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();

    html += '<div class="event-item">';
    html += '<span>' + dateStr + '</span>';
    html += '<span>' + ev.summary + '</span>';
    html += '<span>' + ev.hours.toFixed(2) + 'h</span>';
    html += '<input type="checkbox" data-idx="' + i + '" checked>';
    html += '</div>';
  }

  html += '</div>';

  document.getElementById('events-container').innerHTML = html;
}
function importSelected() {
  const checkboxes = document.querySelectorAll('#events-list input[type="checkbox"]');

  let count = 0;

  checkboxes.forEach(function(checkbox) {
    if (checkbox.checked) {
      const idx = parseInt(checkbox.getAttribute('data-idx'));
      const ev = calEvents[idx];

      const d = ev.start;
      const dateISO = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);

      const building = ev.summary;

      addLine(dateISO, building, '30', ev.hours);
      count = count + 1;
    }
  });

  if (count > 0) {
    document.getElementById('lines-container').scrollIntoView({ behavior: 'smooth' });
  }
}
function generateExcel() {
  const invoiceNo = document.getElementById('inv-no').value.trim();
  const name = document.getElementById('inv-name').value.trim();
  const msg = document.getElementById('msg');

  if (!invoiceNo || !name) {
    msg.className = 'err';
    msg.textContent = 'Completa Invoice No y Name antes de generar.';
    return;
  }

  const rows = document.querySelectorAll('.line-row');
  if (rows.length === 0) {
    msg.className = 'err';
    msg.textContent = 'Agrega al menos una línea de trabajo.';
    return;
  }

  const wsData = [];
  wsData.push([null, null, null, null, null, null, null]);
  wsData.push([null, null, 'Invoice No', invoiceNo, null, null, null]);
  wsData.push([null, null, 'Name', name, null, null, null]);
  wsData.push([null, null, null, null, null, null, null]);
  wsData.push([null, null, 'Date', 'Building', 'Rate', 'Hours', 'Total']);

  const dataRows = [];
  rows.forEach(function(row) {
    const inputs = row.querySelectorAll('input');
    const dateVal  = inputs[0].value;
    const building = inputs[1].value;
    const rate     = parseFloat(inputs[2].value) || 0;
    const hours    = parseFloat(inputs[3].value) || 0;
    const total    = rate * hours;

    const d = dateVal ? new Date(dateVal + 'T12:00:00') : new Date();
    const formatted = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();

    dataRows.push([null, null, formatted, building, rate, hours, total]);
  });

  dataRows.forEach(function(r) { wsData.push(r); });

  const totalHours = dataRows.reduce(function(s, r) { return s + r[5]; }, 0);
  const totalAmt   = dataRows.reduce(function(s, r) { return s + r[6]; }, 0);
  wsData.push([null, null, null, null, 'TOTAL', totalHours, totalAmt]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:4},{wch:4},{wch:14},{wch:30},{wch:8},{wch:8},{wch:10}];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Example');

  const filename = 'Report_Hours_' + invoiceNo + '_' + name.replace(/\s+/g, '_') + '.xlsx';
  XLSX.writeFile(wb, filename);

  msg.className = 'ok';
  msg.textContent = '✓ Descargado: ' + filename;
}