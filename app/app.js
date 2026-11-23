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

const rowEls = new Map();

function createRow(i) {
  const li = document.createElement('li');
  li.setAttribute('data-testid', 'incident-row');
  li.dataset.id = i.id;
  li.className = `row ${i.severity}`;
  li.innerHTML = `<span class="id">${esc(i.id)}</span>
        <span class="sev">${esc(i.severity)}</span>
        <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
        <time datetime="${esc(i.openedAt)}"></time>
        <span class="action"></span>`;
  return li;
}

function syncRow(li, i) {
  const time = li.querySelector('time');
  const text = localTime(i.openedAt);
  if (time.dateTime !== i.openedAt) time.dateTime = i.openedAt;
  if (time.textContent !== text) time.textContent = text;
  const state = acked.has(i.id) ? 'acked' : pending.has(i.id) ? 'pending' : 'open';
  const action = li.querySelector('.action');
  if (action.dataset.state === state) return;
  action.dataset.state = state;
  action.innerHTML =
    state === 'acked'
      ? '<span data-testid="acked" class="acked">✓ acked</span>'
      : `<button type="button" data-testid="ack" class="ack"${state === 'pending' ? ' disabled' : ''}>Ack</button>`;
}

let latest = [];

// Rows are kept and updated in place; only new incidents are inserted (at the top), so rows never get rebuilt under the pointer.
function render(incidents) {
  latest = incidents;
  const ids = new Set(incidents.map((i) => i.id));
  for (const [id, li] of rowEls) {
    if (!ids.has(id)) {
      li.remove();
      rowEls.delete(id);
    }
  }
  incidents.forEach((i, idx) => {
    let li = rowEls.get(i.id);
    if (!li) {
      li = createRow(i);
      rowEls.set(i.id, li);
    }
    syncRow(li, i);
    if (list.children[idx] !== li) list.insertBefore(li, list.children[idx] ?? null);
  });
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

const confirmBox = document.querySelector('[data-testid="confirm"]');
const confirmText = document.querySelector('[data-testid="confirm-text"]');
const confirmAck = document.querySelector('[data-testid="confirm-ack"]');
const confirmCancel = document.querySelector('[data-testid="confirm-cancel"]');
let target = null;

function closeConfirm() {
  target = null;
  confirmBox.hidden = true;
}

// The confirm holds the incident id picked at click time, so later list changes do not retarget it.
list.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const row = btn.closest('[data-testid="incident-row"]');
  target = row.dataset.id;
  const i = latest.find((x) => x.id === target);
  confirmText.textContent = `Ack ${target}${i ? ` (${i.service} · ${i.region} · ${i.summary})` : ''}?`;
  confirmBox.dataset.id = target;
  confirmBox.hidden = false;
  confirmAck.focus();
});

confirmCancel.addEventListener('click', closeConfirm);

confirmAck.addEventListener('click', async () => {
  const id = target;
  if (!id || pending.has(id)) return;
  pending.add(id);
  closeConfirm();
  render(latest);
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
