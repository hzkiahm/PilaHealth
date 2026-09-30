/* ==========================================================================
   PilaHealth - Patient Portal Client Controller
   ========================================================================== */

   let currentUser = null;

   // Utility: HTML Escaper to prevent XSS attacks
   function escapeHtml(str) {
     if (str === null || str === undefined) return '';
     return String(str)
       .replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#039;');
   }
   
   // Utility: Safely set HTML content by ID
   function setElementHTML(id, html) {
     const el = document.getElementById(id);
     if (el) el.innerHTML = html;
   }
   
   // Utility: Safely set text content by ID
   function setElementText(id, text) {
     const el = document.getElementById(id);
     if (el) el.textContent = text;
   }
   
   /* ==========================================================================
      Initialization & Auth Check
      ========================================================================== */
   async function init() {
     try {
       const res = await fetch('/api/auth/me');
       if (!res.ok) {
         location.href = 'index.html';
         return;
       }
   
       const me = await res.json();
       if (!me || !me.user || me.user.role !== 'patient') {
         location.href = 'index.html';
         return;
       }
   
       currentUser = me.user;
       setElementText('userName', `Hi, ${currentUser.name || 'Patient'}`);
   
       // Set default booking date to today
       const dateInput = document.getElementById('date');
       if (dateInput) {
         const today = new Date().toISOString().split('T')[0];
         dateInput.value = today;
         dateInput.min = today; // Prevent booking past dates
       }
   
       // Load initial metadata and user dashboard concurrently
       await Promise.all([
         loadAppointmentTypes(),
         loadDoctors(),
         loadAppointments(),
         loadNotifications()
       ]);
   
     } catch (err) {
       console.error('Initialization error:', err);
       location.href = 'index.html';
     }
   }
   
   /* ==========================================================================
      Form Options Loading
      ========================================================================== */
   async function loadAppointmentTypes() {
     const select = document.getElementById('apptType');
     if (!select) return;
   
     try {
       const res = await fetch('/api/booking/types');
       const types = res.ok ? await res.json() : [];
       
       if (Array.isArray(types) && types.length > 0) {
         select.innerHTML = types
           .map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
           .join('');
       } else {
         select.innerHTML = '<option value="General Consultation">General Consultation</option>';
       }
     } catch (err) {
       console.error('Failed to load appointment types:', err);
       select.innerHTML = '<option value="General Consultation">General Consultation</option>';
     }
   }
   
   async function loadDoctors() {
     const select = document.getElementById('doctor');
     if (!select) return;
   
     try {
       const res = await fetch('/api/booking/doctors');
       const docs = res.ok ? await res.json() : [];
   
       if (Array.isArray(docs) && docs.length > 0) {
         select.innerHTML = docs
           .map(d => `<option value="${escapeHtml(d.doctor_id)}">${escapeHtml(d.name)} — ${escapeHtml(d.specialization)}</option>`)
           .join('');
       } else {
         select.innerHTML = '<option value="">No doctors available</option>';
       }
     } catch (err) {
       console.error('Failed to load doctors:', err);
       select.innerHTML = '<option value="">Failed to load doctors</option>';
     }
   }
   
   /* ==========================================================================
      Booking Logic
      ========================================================================== */
   async function book() {
     const msg = document.getElementById('bookMsg');
     const submitBtn = document.querySelector('button[onclick="book()"]');
   
     if (msg) {
       msg.className = 'msg';
       msg.textContent = '';
     }
   
     const doctor_id = document.getElementById('doctor')?.value;
     const appointment_type = document.getElementById('apptType')?.value;
     const date = document.getElementById('date')?.value;
     const time = document.getElementById('time')?.value;
   
     if (!doctor_id || !appointment_type || !date || !time) {
       if (msg) {
         msg.className = 'msg error';
         msg.textContent = 'Please fill out all booking fields.';
       }
       return;
     }
   
     // Prevent duplicate submissions
     if (submitBtn) submitBtn.disabled = true;
     if (msg) msg.textContent = 'Processing reservation...';
   
     try {
       const res = await fetch('/api/booking', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ doctor_id, appointment_type, date, time })
       });
   
       const data = await res.json();
   
       if (res.ok) {
         if (msg) {
           msg.className = 'msg success';
           msg.textContent = 'Booking confirmed successfully!';
         }
         
         // Refresh user lists
         await Promise.all([loadAppointments(), loadNotifications()]);
       } else {
         if (msg) {
           msg.className = 'msg error';
           msg.textContent = data.error || 'Booking failed. Please try again.';
         }
       }
     } catch (err) {
       console.error('Booking error:', err);
       if (msg) {
         msg.className = 'msg error';
         msg.textContent = 'Network or server error while booking.';
       }
     } finally {
       if (submitBtn) submitBtn.disabled = false;
     }
   }
   
   /* ==========================================================================
      Appointments Management
      ========================================================================== */
   async function loadAppointments() {
     try {
       const res = await fetch('/api/booking/mine');
       const appointments = res.ok ? await res.json() : [];
   
       if (!Array.isArray(appointments) || appointments.length === 0) {
         setElementHTML('appointments', '<p class="empty-state">No appointments reserved yet.</p>');
         return;
       }
   
       const rows = appointments.map(a => {
         const isBooked = a.status === 'Booked';
         const actionContent = isBooked
           ? `<button class="btn-secondary" onclick="checkIn(${Number(a.appointment_id)})" style="padding:4px 10px; font-size:0.75rem;">Check-In</button>`
           : '&mdash;';
   
         const formattedDate = a.date ? String(a.date).slice(0, 10) : '&mdash;';
         const badgeCls = badgeClass(a.status);
   
         return `
           <tr>
             <td><strong>${escapeHtml(a.doctor_name || 'Dr. Assigned')}</strong></td>
             <td>${escapeHtml(a.appointment_type)}</td>
             <td>${escapeHtml(formattedDate)}</td>
             <td>${escapeHtml(a.time)}</td>
             <td><span class="badge ${badgeCls}">${escapeHtml(a.status)}</span></td>
             <td>${actionContent}</td>
           </tr>
         `;
       }).join('');
   
       const tableHTML = `
         <div class="table-wrapper">
           <table>
             <thead>
               <tr>
                 <th>Doctor</th>
                 <th>Type</th>
                 <th>Date</th>
                 <th>Time</th>
                 <th>Status</th>
                 <th>Action</th>
               </tr>
             </thead>
             <tbody>
               ${rows}
             </tbody>
           </table>
         </div>
       `;
   
       setElementHTML('appointments', tableHTML);
     } catch (err) {
       console.error('Failed to load appointments:', err);
       setElementHTML('appointments', '<p class="empty-state">Unable to load appointments.</p>');
     }
   }
   
   /* ==========================================================================
      Queue Check-In
      ========================================================================== */
   async function checkIn(appointment_id) {
     if (!appointment_id) return;
   
     try {
       const res = await fetch('/api/queue/check-in', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ appointment_id })
       });
   
       const data = await res.json();
   
       if (res.ok) {
         alert(`Checked in successfully! Your queue position is #${data.queue_number}`);
         await Promise.all([loadAppointments(), loadNotifications()]);
       } else {
         alert(data.error || 'Check-in failed. Please contact reception.');
       }
     } catch (err) {
       console.error('Check-in error:', err);
       alert('Failed to connect to server for check-in.');
     }
   }
   
   /* ==========================================================================
      Notifications Feed
      ========================================================================== */
   async function loadNotifications() {
     try {
       const res = await fetch('/api/notification/mine');
       const notifications = res.ok ? await res.json() : [];
   
       if (!Array.isArray(notifications) || notifications.length === 0) {
         setElementHTML('notifications', '<p class="empty-state">No notifications yet.</p>');
         return;
       }
   
       const rows = notifications.map(n => {
         const timeStr = n.timestamp ? new Date(n.timestamp).toLocaleString() : '&mdash;';
         return `
           <tr>
             <td><span class="badge waiting">${escapeHtml(n.type || 'Notice')}</span></td>
             <td>${escapeHtml(n.message)}</td>
             <td style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(timeStr)}</td>
           </tr>
         `;
       }).join('');
   
       const tableHTML = `
         <div class="table-wrapper">
           <table>
             <thead>
               <tr>
                 <th>Type</th>
                 <th>Message</th>
                 <th>Time</th>
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
       console.error('Failed to load notifications:', err);
     }
   }
   
   /* ==========================================================================
      Helpers & User Session
      ========================================================================== */
   function badgeClass(status) {
     switch (status) {
       case 'Waiting':
       case 'Booked':
         return 'waiting';
       case 'Called':
       case 'Checked-In':
       case 'In Consultation':
         return 'called';
       case 'Completed':
       case 'Done':
         return 'done';
       case 'Cancelled':
       case 'No-show':
         return 'cancelled';
       default:
         return 'waiting';
     }
   }
   
   async function logout() {
     try {
       await fetch('/api/auth/logout', { method: 'POST' });
     } catch (err) {
       console.error('Logout error:', err);
     } finally {
       location.href = 'index.html';
     }
   }
   
   // Background auto-polling for real-time notifications
   setInterval(loadNotifications, 10000);
   
   // Initialize on DOM ready
   document.addEventListener('DOMContentLoaded', init);
