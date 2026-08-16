const API_BASE = '/api/events';

let _toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(_toastTimer);
  toast.textContent = msg;
  toast.className   = `toast show ${type}`;
  _toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDT(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

/*Convert ISO to datetime-local input value */
function toDatetimeLocal(iso) {
  if (!iso) return '';
  try { return new Date(iso).toISOString().slice(0, 16); }
  catch { return ''; }
}

/* Build shared event card body (pills + title + desc)*/
function buildCardBody(ev) {
  const activeClass = ev.is_active ? 'active' : 'inactive';
  const activeLabel = ev.is_active ? 'Active'  : 'Inactive';
  const startLabel  = ev.starts_at  ? `From ${formatDT(ev.starts_at)}` : 'Always on';
  const endPill     = ev.ends_at    ? `<span class="meta-pill">${formatDT(ev.ends_at)}</span>` : '';
  const lockPill    = ev.point_threshold > 0
    ? `<span class="meta-pill">🔒 ${ev.point_threshold} pts to unlock</span>` : '';

  return `
    <div class="event-card-title">${esc(ev.title)}</div>
    <div class="event-card-desc">${esc(ev.description || 'No description.')}</div>
    <div class="event-meta">
      <span class="meta-pill ${activeClass}">${activeLabel}</span>
      <span class="meta-pill">📍 ${ev.radius_meters}m</span>
      <span class="meta-pill gold">⚡ ${ev.point_reward} pts</span>
      <span class="meta-pill">${startLabel}</span>
      ${endPill}
      ${lockPill}
    </div>
  `;
}