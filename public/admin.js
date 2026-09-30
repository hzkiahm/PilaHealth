/* ==========================================================================
   PilaHealth - Executive Admin Dashboard Controller
   ========================================================================== */

   let currentUser = null;

   // Utility: XSS Sanitization
   function escapeHtml(str) {
     if (str === null || str === undefined) return '';
     return String(str)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#039;');
   }
   
   // Utility: DOM Helper
   function setElementHTML(id, html) {
     const el = document.getElementById(id);
     if (el) el.innerHTML = html;
   }
   
   // Utility: DOM Helper Text
   function setElementText(id, text) {
     const el = document.getElementById(id);
     if (el) el.textContent = text;
   }
   
   /* ==========================================================================
      Initialization & Role Verification
      ========================================================================== */
   async function init() {
     try {
       const res = await fetch('/api/auth/me');
       if (!res.ok) {
         location.href = 'index.html';
         return;
       }
   
       const me = await res.json();
       if (!me || !me.user || me.user.role !== 'admin') {
         location.href = 'index.html';
         return;
       }
   
       currentUser = me.user;
       setElementText('userName', `Hi, ${currentUser.name || 'Admin'}`);
   
       // Fetch all administrative metrics and lists concurrently
       await Promise.all([
         loadStats(),
         loadAudit(),
         loadAllNotifications(),
         loadUsers()
       ]);
   
     } catch (err) {
       console.error('Admin Initialization Error:', err);
       location.href = 'index.html';
     }
   }
   
   /* ==========================================================================
      Dashboard Statistics Cards
      ========================================================================== */
   async function loadStats() {
     try {
       const res = await fetch('/api/audit/stats');
       if (!res.ok) throw new Error('Failed to load stats');
   
       const data = await res.json();
   
       const statsHTML = `
         <div class="stats-grid">
           <div class="stat-card">
             <div class="stat-card-title">Today's Appointments</div>
             <div class="stat-card-value">${Number(data.appointments_today || 0).toLocaleString()}</div>
           </div>
           <div class="stat-card">
             <div class="stat-card-title">Patients in Queue</div>
             <div class="stat-card-value" style="color: var(--accent-orange);">${Number(data.in_queue || 0).toLocaleString()}</div>
           </div>
           <div class="stat-card">
             <div class="stat-card-title">Completed Consultations</div>
             <div class="stat-card-value" style="color: var(--status-done-text);">${Number(data.completed_today || 0).toLocaleString()}</div>
           </div>
           <div class="stat-card">
             <div class="stat-card-title">Total Users</div>
             <div class="stat-card-value" style="color: var(--text-main);">${Number(data.total_users || 0).toLocaleString()}</div>
           </div>
         </div>
       `;
   
       setElementHTML('stats', statsHTML);
     } catch (err) {
       console.error('Stats loading error:', err);
       setElementHTML('stats', '<p class="empty-state">Unable to load dashboard statistics.</p>');
     }
   }
   
   /* ==========================================================================
      Audit Log Module
      ========================================================================== */
   async function loadAudit() {
     try {
       const res = await fetch('/api/audit');
       const logs = res.ok ? await res.json() : [];
   
       if (!Array.isArray(logs) || logs.length === 0) {
         setElementHTML('audit', '<p class="empty-state">No audit logs recorded yet.</p>');
         return;
       }
   
       const rows = logs.map(a => {
         const isSuccess = String(a.status).toLowerCase() === 'success' || String(a.status).toLowerCase() === 'done';
         const badgeCls = isSuccess ? 'done' : 'cancelled';
         const timeStr = a.timestamp ? new Date(a.timestamp).toLocaleString() : '&mdash;';
   
         return `
           <tr>
             <td style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(timeStr)}</td>
             <td><strong>${escapeHtml(a.user_name || 'System')}</strong></td>
             <td>${escapeHtml(a.action)}</td>
             <td><code>${escapeHtml(a.module)}</code></td>
             <td><span class="badge ${badgeCls}">${escapeHtml(a.status)}</span></td>
           </tr>
         `;
       }).join('');
   
       const tableHTML = `
         <div class="table-wrapper">
           <table>
             <thead>
               <tr>
                 <th>Timestamp</th>
                 <th>User</th>
                 <th>Action</th>
                 <th>Module</th>
                 <th>Status</th>
               </tr>
             </thead>
             <tbody>
               ${rows}
             </tbody>
           </table>
         </div>
       `;
   
       setElementHTML('audit', tableHTML);
     } catch (err) {
       console.error('Audit log loading error:', err);
       setElementHTML('audit', '<p class="empty-state">Unable to load audit logs.</p>');
     }
   }
   
   /* ==========================================================================
      Global System Notifications Feed
      ========================================================================== */
   async function loadAllNotifications() {
     try {
       const res = await fetch('/api/notification/all');
       const notifications = res.ok ? await res.json() : [];
   
       if (!Array.isArray(notifications) || notifications.length === 0) {
         setElementHTML('notifications', '<p class="empty-state">No notification records available.</p>');
         return;
       }
   
       const rows = notifications.map(n => {
         const isSent = String(n.status).toLowerCase() === 'sent' || String(n.status).toLowerCase() === 'delivered';
         const badgeCls = isSent ? 'done' : 'cancelled';
         const timeStr = n.timestamp ? new Date(n.timestamp).toLocaleString() : '&mdash;';
   
         return `
           <tr>
             <td style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(timeStr)}</td>
             <td><strong>${escapeHtml(n.user_name || 'System User')}</strong></td>
             <td><span class="badge waiting">${escapeHtml(n.type || 'Notice')}</span></td>
             <td>${escapeHtml(n.message)}</td>
             <td><code>${escapeHtml(n.trigger_event || '—')}</code></td>
             <td><span class="badge ${badgeCls}">${escapeHtml(n.status)}</span></td>
           </tr>
         `;
       }).join('');
   
       const tableHTML = `
         <div class="table-wrapper">
           <table>
             <thead>
               <tr>
                 <th>Time</th>
                 <th>User</th>
                 <th>Type</th>
                 <th>Message</th>
                 <th>Event Trigger</th>
                 <th>Status</th>
               </tr>
             </thead>
             <tbody>
               ${rows}
             </tbody>
           </table>
         </div>
       `;
   
       setElementHTML('notifications', tableHTML);
     } catch (err) {
       console.error('Notifications loading error:', err);
       setElementHTML('notifications', '<p class="empty-state">Unable to load notifications list.</p>');
     }
   }
   
   /* ==========================================================================
      User Management Directory
      ========================================================================== */
   async function loadUsers() {
     try {
       const res = await fetch('/api/audit/users');
       const users = res.ok ? await res.json() : [];
   
       if (!Array.isArray(users) || users.length === 0) {
         setElementHTML('users', '<p class="empty-state">No registered users found.</p>');
         return;
       }
   
       const rows = users.map(u => {
         const roleUpper = String(u.role || 'User').toUpperCase();
         const statusLower = String(u.status || 'Active').toLowerCase();
         const badgeCls = statusLower === 'active' || statusLower === 'enabled' ? 'done' : 'cancelled';
   
         return `
           <tr>
             <td><code>#${escapeHtml(u.user_id)}</code></td>
             <td><strong>${escapeHtml(u.name)}</strong></td>
             <td>${escapeHtml(u.email)}</td>
             <td><span class="badge called">${escapeHtml(roleUpper)}</span></td>
             <td><span class="badge ${badgeCls}">${escapeHtml(u.status || 'Active')}</span></td>
           </tr>
         `;
       }).join('');
   
       const tableHTML = `
         <div class="table-wrapper">
           <table>
             <thead>
               <tr>
                 <th>ID</th>
                 <th>Name</th>
                 <th>Email</th>
                 <th>Role</th>
                 <th>Status</th>
               </tr>
             </thead>
             <tbody>
               ${rows}
             </tbody>
           </table>
         </div>
       `;
   
       setElementHTML('users', tableHTML);
     } catch (err) {
       console.error('Users loading error:', err);
       setElementHTML('users', '<p class="empty-state">Unable to load user directory.</p>');
     }
   }
   
   /* ==========================================================================
      Session Controls & Polling
      ========================================================================== */
   async function logout() {
     try {
       await fetch('/api/auth/logout', { method: 'POST' });
     } catch (err) {
       console.error('Logout error:', err);
     } finally {
       location.href = 'index.html';
     }
   }
   
   // Background auto-refresh for real-time monitoring (every 15s)
   setInterval(() => {
     loadAudit();
     loadAllNotifications();
     loadStats();
   }, 15000);
   
   // Initialize script on DOM ready
   document.addEventListener('DOMContentLoaded', init);
