const elLoading    = document.getElementById('loading');
const elEmpty      = document.getElementById('empty');
const elError      = document.getElementById('error');
const elEventList  = document.getElementById('event-list');


async function loadEvents() {
  elLoading.classList.remove('hidden');
  elEmpty.classList.add('hidden');
  elError.classList.add('hidden');
  elEventList.innerHTML = '';

  try {
    const res  = await fetch(API_BASE);
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    const data = await res.json();

    elLoading.classList.add('hidden');

    if (!data.length) {
      elEmpty.classList.remove('hidden');
      return;
    }

    data.forEach(ev => elEventList.appendChild(buildPlayerCard(ev)));

  } catch (err) {
    elLoading.classList.add('hidden');
    elError.textContent = `Could not load events — ${err.message}`;
    elError.classList.remove('hidden');
  }
}

/* ── Player card*/
function buildPlayerCard(ev) {
  const li = document.createElement('li');
  li.className = 'event-card';

  // no action buttons for players
  li.style.gridTemplateColumns = '1fr';
  li.innerHTML = `<div class="event-card-body">${buildCardBody(ev)}</div>`;

  return li;
}

loadEvents();