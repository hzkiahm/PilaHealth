async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json());
  if (!me.user || me.user.role !== 'admin') {
    location.href = 'index.html';
    return;
  }
  document.getElementById('userName').textContent = `Hi, ${me.user.name}`;

  loadStats();
  loadAudit();
  loadAllNotifications();
  loadUsers();
}

// ============================================================
// Dashboard Statistics
// ============================================================
async function loadStats() {
  const r = await fetch('/api/audit/stats').then(r => r.json()).catch(() => null);

  if (!r) {
    document.getElementById('stats').innerHTML = '<p>Loading...</p>';
    return;
  }

  document.getElementById('stats').innerHTML = `
    <div style="flex:1;min-width:150px;background:#e3f2fd;padding:15px;border-radius:8px;text-align:center;">
      <div style="font-size:28px;font-weight:bold;color:#1565c0;">${r.appointments_today || 0}</div>
      <div style="font-size:13px;color:#555;">Today's Appointments</div>
    </div>
    <div style="flex:1;min-width:150px;background:#fff3e0;padding:15px;border-radius:8px;text-align:center;">
      <div style="font-size:28px;font-weight:bold;color:#ef6c00;">${r.in_queue || 0}</div>
      <div style="font-size:13px;color:#555;">Patients in Queue</div>
    </div>
    <div style="flex:1;min-width:150px;background:#e8f5e9;padding:15px;border-radius:8px;text-align:center;">
      <div style="font-size:28px;font-weight:bold;color:#2e7d32;">${r.completed_today || 0}</div>
      <div style="font-size:13px;color:#555;">Completed Consultations</div>
    </div>
    <div style="flex:1;min-width:150px;background:#fce4ec;padding:15px;border-radius:8px;text-align:center;">
      <div style="font-size:28px;font-weight:bold;color:#ad1457;">${r.total_users || 0}</div>
      <div style="font-size:13px;color:#555;">Total Users</div>
    </div>
  `;
}

// ============================================================
// Audit Log
// ============================================================
async function loadAudit() {
  const r = await fetch('/api/audit').then(r => r.json());

  if (r.length === 0) {
    document.getElementById('audit').innerHTML = '<p>No audit logs yet.</p>';
    return;
  }

  document.getElementById('audit').innerHTML = `
    <table>
      <tr>
        <th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Status</th>
      </tr>
      ${r.map(a => `
        <tr>
          <td>${new Date(a.timestamp).toLocaleString()}</td>
          <td>${a.user_name || 'System'}</td>
          <td>${a.action}</td>
          <td>${a.module}</td>
          <td>
            <span class="badge ${a.status === 'Success' ? 'done' : 'cancelled'}">
              ${a.status}
            </span>
          </td>
        </tr>
      `).join('')}
    </table>
  `;
}

// ============================================================
// All Notifications
// ============================================================
async function loadAllNotifications() {
  const r = await fetch('/api/notification/all').then(r => r.json());

  if (r.length === 0) {
    document.getElementById('notifications').innerHTML = '<p>No notifications yet.</p>';
    return;
  }

  document.getElementById('notifications').innerHTML = `
    <table>
      <tr>
        <th>Time</th><th>User</th><th>Type</th><th>Message</th><th>Event</th><th>Status</th>
      </tr>
      ${r.map(n => `
        <tr>
          <td>${new Date(n.timestamp).toLocaleString()}</td>
          <td>${n.user_name}</td>
          <td>${n.type}</td>
          <td>${n.message}</td>
          <td>${n.trigger_event || '—'}</td>
          <td>
            <span class="badge ${n.status === 'Sent' ? 'done' : 'cancelled'}">
              ${n.status}
            </span>
          </td>
        </tr>
      `).join('')}
    </table>
  `;
}

// ============================================================
// Users List
// ============================================================
async function loadUsers() {
  const r = await fetch('/api/audit/users').then(r => r.json()).catch(() => []);

  if (r.length === 0) {
    document.getElementById('users').innerHTML = '<p>No users.</p>';
    return;
  }

  document.getElementById('users').innerHTML = `
    <table>
      <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
      ${r.map(u => `
        <tr>
          <td>${u.user_id}</td>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td><strong>${u.role}</strong></td>
          <td>${u.status}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.href = 'index.html';
}

init();

// Auto-refresh every 15 seconds
setInterval(loadAudit, 15000);
setInterval(loadAllNotifications, 15000);
setInterval(loadStats, 15000);