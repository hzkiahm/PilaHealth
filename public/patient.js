let currentUser = null;

async function init() {
  // Check login
  const me = await fetch('/api/auth/me').then(r => r.json());
  if (!me.user || me.user.role !== 'patient') {
    location.href = 'index.html';
    return;
  }
  currentUser = me.user;
  document.getElementById('userName').textContent = `Hi, ${currentUser.name}`;

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date').value = today;

  // Load appointment types
  const types = await fetch('/api/booking/types').then(r => r.json());
  document.getElementById('apptType').innerHTML =
    types.map(t => `<option>${t}</option>`).join('');

  // Load doctors
  const docs = await fetch('/api/booking/doctors').then(r => r.json());
  document.getElementById('doctor').innerHTML =
    docs.map(d => `<option value="${d.doctor_id}">${d.name} — ${d.specialization}</option>`).join('');

  loadAppointments();
  loadNotifications();
}

async function book() {
  const msg = document.getElementById('bookMsg');
  msg.className = 'msg';
  msg.textContent = '';

  const body = {
    doctor_id: document.getElementById('doctor').value,
    appointment_type: document.getElementById('apptType').value,
    date: document.getElementById('date').value,
    time: document.getElementById('time').value
  };

  const res = await fetch('/api/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (res.ok) {
    msg.className = 'msg success';
    msg.textContent = '✅ Booking confirmed!';
    loadAppointments();
    loadNotifications();
  } else {
    msg.className = 'msg error';
    msg.textContent = '❌ ' + (data.error || 'Booking failed');
  }
}

async function loadAppointments() {
  const r = await fetch('/api/booking/mine').then(r => r.json());

  if (r.length === 0) {
    document.getElementById('appointments').innerHTML = '<p>No appointments yet.</p>';
    return;
  }

  document.getElementById('appointments').innerHTML = `
    <table>
      <tr>
        <th>Doctor</th><th>Type</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th>
      </tr>
      ${r.map(a => `
        <tr>
          <td>${a.doctor_name}</td>
          <td>${a.appointment_type}</td>
          <td>${a.date ? a.date.slice(0,10) : ''}</td>
          <td>${a.time}</td>
          <td><span class="badge ${badgeClass(a.status)}">${a.status}</span></td>
          <td>${a.status === 'Booked' ?
            `<button onclick="checkIn(${a.appointment_id})" style="width:auto;padding:5px 10px;font-size:12px;">Check-In</button>` :
            '—'}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

async function checkIn(appointment_id) {
  const res = await fetch('/api/queue/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointment_id })
  });
  const data = await res.json();
  if (res.ok) {
    alert(`✅ Checked in! Your queue number is #${data.queue_number}`);
    loadAppointments();
  } else {
    alert('❌ ' + data.error);
  }
}

async function loadNotifications() {
  const r = await fetch('/api/notification/mine').then(r => r.json());

  if (r.length === 0) {
    document.getElementById('notifications').innerHTML = '<p>No notifications yet.</p>';
    return;
  }

  document.getElementById('notifications').innerHTML = `
    <table>
      <tr><th>Type</th><th>Message</th><th>Time</th></tr>
      ${r.map(n => `
        <tr>
          <td>${n.type}</td>
          <td>${n.message}</td>
          <td>${new Date(n.timestamp).toLocaleString()}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function badgeClass(status) {
  if (status === 'Waiting' || status === 'Booked') return 'waiting';
  if (status === 'Called' || status === 'Checked-In' || status === 'In Consultation') return 'called';
  if (status === 'Completed') return 'done';
  if (status === 'Cancelled' || status === 'No-show') return 'cancelled';
  return '';
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = 'index.html';
}

init();

setInterval(loadNotifications, 10000);