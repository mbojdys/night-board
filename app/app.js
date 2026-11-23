import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000;
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('[data-testid="status"]');

const acked = new Set();
const pending = new Set();

const timeFormat = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
});

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function localTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : timeFormat.format(d);
}

function rowHtml(i) {
  const done = acked.has(i.id);
  return `<li data-testid="incident-row" data-id="${esc(i.id)}" class="row ${esc(i.severity)}">
        <span class="id">${esc(i.id)}</span>
        <span class="sev">${esc(i.severity)}</span>
        <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
        <time datetime="${esc(i.openedAt)}">${esc(localTime(i.openedAt))}</time>
        ${
          done
            ? '<span data-testid="acked" class="acked">✓ acked</span>'
            : `<button type="button" data-testid="ack" class="ack"${pending.has(i.id) ? ' disabled' : ''}>Ack</button>`
        }
      </li>`;
}

let latest = [];

function render(incidents) {
  latest = incidents;
  list.innerHTML = incidents.map(rowHtml).join('');
  empty.hidden = incidents.length > 0;
}

async function refresh() {
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    loader.hidden = true;
    status.textContent = `updated ${localTime(page.updatedAt)}`;
    status.classList.remove('error');
  } catch (err) {
    console.error(err);
    status.textContent = 'update failed, retrying…';
    status.classList.add('error');
  }
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const id = btn.closest('[data-testid="incident-row"]').dataset.id;
  if (pending.has(id)) return;
  pending.add(id);
  btn.disabled = true;
  try {
    await ack(id);
    acked.add(id);
  } catch (err) {
    console.error(err);
    status.textContent = `ack ${id} failed`;
    status.classList.add('error');
  } finally {
    pending.delete(id);
    render(latest);
  }
});

await refresh();
setInterval(refresh, REFRESH_MS);
