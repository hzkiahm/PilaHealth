async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json());
  if (!me.user || me.user.role !== 'staff') {
    location.href = 'index.html';
    return;
  }
  document.getElementById('userName').textContent = `Hi, ${me.user.name}`;
  loadQueue();
}

async function loadQueue() {
  const r = await fetch('/api/queue').then(r => r.json());

  if (r.length === 0) {
    document.getElementById('queue').innerHTML =
      '<p>No patients in queue.</p>';
    return;
  }

  document.getElementById('queue').innerHTML = `
    <table>
      <tr>
        <th>#</th><th>Patient</th><th>Status</th><th>Check-In Time</th>
      </tr>
      ${r.map(q => `
        <tr>
          <td><strong>${q.queue_number}</strong></td>
          <td>${q.patient_name}</td>
          <td><span class="badge ${badgeClass(q.status)}">${q.status}</span></td>
          <td>${q.check_in_time ? new Date(q.check_in_time).toLocaleTimeString() : '—'}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

async function callNext() {
  const msg = document.getElementById('msg');
  msg.className = 'msg';
  msg.textContent = '';

  const res = await fetch('/api/queue/call-next', { method: 'POST' });
  const data = await res.json();

  if (res.ok) {
    msg.className = 'msg success';
    msg.textContent = `✅ Called queue #${data.called} — notification sent!`;
    loadQueue();
  } else {
    msg.className = 'msg error';
    msg.textContent = '❌ ' + (data.error || 'Failed');
  }
}

async function assistCheckIn() {
  const msg = document.getElementById('checkMsg');
  msg.className = 'msg';
  msg.textContent = '';

  const appointment_id = document.getElementById('apptId').value;
  if (!appointment_id) {
    msg.className = 'msg error';
    msg.textContent = 'Please enter an appointment ID.';
    return;
  }

  const res = await fetch('/api/queue/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointment_id })
  });
  const data = await res.json();

  if (res.ok) {
    msg.className = 'msg success';
    msg.textContent = `✅ Checked in! Queue #${data.queue_number}`;
    document.getElementById('apptId').value = '';
    loadQueue();
  } else {
    msg.className = 'msg error';
    msg.textContent = '❌ ' + (data.error || 'Failed');
  }
}

function badgeClass(status) {
  if (status === 'Waiting') return 'waiting';
  if (status === 'Called' || status === 'In Consultation') return 'called';
  if (status === 'Completed') return 'done';
  if (status === 'No-show' || status === 'Cancelled') return 'cancelled';
  return '';
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = 'index.html';
}

init();