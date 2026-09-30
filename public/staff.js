async function init() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      location.href = 'index.html';
      return;
    }

    const me = await res.json();
    if (!me.user || me.user.role !== 'staff') {
      location.href = 'index.html';
      return;
    }

    // Set greeting in sidebar profile
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
      userNameEl.textContent = me.user.name || 'Staff Member';
    }

    loadQueue();
  } catch (err) {
    console.error('Initialization error:', err);
    location.href = 'index.html';
  }
}

async function loadQueue() {
  const container = document.getElementById('queue');
  if (!container) return;

  try {
    const res = await fetch('/api/queue');
    if (!res.ok) throw new Error('Failed to fetch queue');

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<p class="empty-state">No patients currently in queue.</p>';
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Patient</th>
            <th>Status</th>
            <th>Check-In Time</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(q => `
            <tr>
              <td><strong>#${q.queue_number}</strong></td>
              <td>${escapeHtml(q.patient_name || 'Walk-In')}</td>
              <td><span class="badge ${badgeClass(q.status)}">${escapeHtml(q.status)}</span></td>
              <td>${q.check_in_time ? new Date(q.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Queue load error:', err);
    container.innerHTML = '<p class="empty-state" style="color: var(--danger, #d32f2f);">Failed to load queue data.</p>';
  }
}

async function callNext() {
  const msg = document.getElementById('msg');
  if (msg) {
    msg.className = 'msg';
    msg.textContent = '';
  }

  try {
    const res = await fetch('/api/queue/call-next', { method: 'POST' });
    const data = await res.json();

    if (res.ok && msg) {
      msg.className = 'msg success';
      msg.textContent = `Called queue #${data.called} — notification sent!`;
      loadQueue();
    } else if (msg) {
      msg.className = 'msg error';
      msg.textContent = data.error || 'Failed to call next patient.';
    }
  } catch (err) {
    console.error('Call next error:', err);
    if (msg) {
      msg.className = 'msg error';
      msg.textContent = 'Server error. Please try again.';
    }
  }
}

async function assistCheckIn() {
  const msg = document.getElementById('checkMsg');
  const apptInput = document.getElementById('apptId');
  if (!apptInput) return;

  if (msg) {
    msg.className = 'msg';
    msg.textContent = '';
  }

  const appointment_id = apptInput.value.trim();
  if (!appointment_id) {
    if (msg) {
      msg.className = 'msg error';
      msg.textContent = 'Please enter an appointment ID.';
    }
    return;
  }

  try {
    const res = await fetch('/api/queue/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointment_id })
    });
    const data = await res.json();

    if (res.ok && msg) {
      msg.className = 'msg success';
      msg.textContent = `Checked in! Queue #${data.queue_number}`;
      apptInput.value = '';
      loadQueue();
    } else if (msg) {
      msg.className = 'msg error';
      msg.textContent = data.error || 'Failed to check in patient.';
    }
  } catch (err) {
    console.error('Check-in error:', err);
    if (msg) {
      msg.className = 'msg error';
      msg.textContent = 'Server connection error.';
    }
  }
}

function badgeClass(status) {
  if (!status) return 'badge-waiting';
  const s = status.toLowerCase();
  
  if (s.includes('wait')) return 'badge-waiting';
  if (s.includes('call') || s.includes('consult')) return 'badge-calling';
  if (s.includes('complet') || s.includes('done')) return 'badge-completed';
  if (s.includes('show') || s.includes('cancel')) return 'badge-noshow';
  
  return 'badge-waiting';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    location.href = 'index.html';
  }
}

init();
