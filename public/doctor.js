let currentDoctorId = null;

async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json());
  if (!me.user || me.user.role !== 'doctor') {
    location.href = 'index.html';
    return;
  }
  document.getElementById('userName').textContent = `Hi, ${me.user.name}`;
  loadQueue();
  loadRecords();
}

async function loadQueue() {
  const r = await fetch('/api/queue').then(r => r.json());

  if (r.length === 0) {
    document.getElementById('queue').innerHTML = '<p>No patients in queue.</p>';
    return;
  }

  document.getElementById('queue').innerHTML = `
    <table>
      <tr>
        <th>#</th><th>Patient</th><th>Status</th><th>Action</th>
      </tr>
      ${r.map(q => `
        <tr>
          <td><strong>${q.queue_number}</strong></td>
          <td>${q.patient_name}</td>
          <td><span class="badge ${badgeClass(q.status)}">${q.status}</span></td>
          <td>
            <button onclick="selectPatient(${q.queue_id}, '${q.patient_name}')"
              style="width:auto;padding:5px 10px;font-size:12px;">
              Select
            </button>
          </td>
        </tr>
      `).join('')}
    </table>
  `;
}

function selectPatient(queue_id, patient_name) {
  // Fill the form with patient info (queue_id is used as appointment_id in our flow)
  document.getElementById('apptId').value = queue_id;
  document.getElementById('patientName').value = patient_name;
  document.getElementById('msg').textContent = `Selected: ${patient_name}`;
  document.getElementById('msg').className = 'msg success';
}

async function saveRecord() {
  const msg = document.getElementById('msg');
  msg.className = 'msg';
  msg.textContent = '';

  const appointment_id = document.getElementById('apptId').value;
  const diagnosis = document.getElementById('diagnosis').value;
  const notes = document.getElementById('notes').value;
  const prescription = document.getElementById('prescription').value;

  if (!appointment_id || !diagnosis) {
    msg.className = 'msg error';
    msg.textContent = '❌ Appointment ID and Diagnosis are required.';
    return;
  }

  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointment_id, diagnosis, notes, prescription })
  });

  const data = await res.json();

  if (res.ok) {
    msg.className = 'msg success';
    msg.textContent = '✅ Consultation record saved! Patient notified.';
    document.getElementById('apptId').value = '';
    document.getElementById('patientName').value = '';
    document.getElementById('diagnosis').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('prescription').value = '';
    loadRecords();
    loadQueue();
  } else {
    msg.className = 'msg error';
    msg.textContent = '❌ ' + (data.error || 'Failed to save');
  }
}

async function loadRecords() {
  const r = await fetch('/api/records/mine').then(r => r.json());

  if (r.length === 0) {
    document.getElementById('records').innerHTML = '<p>No records yet.</p>';
    return;
  }

  document.getElementById('records').innerHTML = `
    <table>
      <tr><th>Patient</th><th>Diagnosis</th><th>Prescription</th><th>Date</th></tr>
      ${r.map(rec => `
        <tr>
          <td>${rec.patient_name}</td>
          <td>${rec.diagnosis || '—'}</td>
          <td>${rec.prescription || '—'}</td>
          <td>${new Date(rec.date_created).toLocaleString()}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function badgeClass(status) {
  if (status === 'Waiting') return 'waiting';
  if (status === 'Called' || status === 'In Consultation') return 'called';
  if (status === 'Completed') return 'done';
  return '';
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = 'index.html';
}

init();