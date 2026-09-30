/* ==========================================================================
   PilaHealth - Doctor Portal Controller
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
   
   // Utility: DOM Helpers
   function setElementHTML(id, html) {
     const el = document.getElementById(id);
     if (el) el.innerHTML = html;
   }
   
   function setElementText(id, text) {
     const el = document.getElementById(id);
     if (el) el.textContent = text;
   }
   
   function badgeClass(status) {
     const normalized = String(status || '').toLowerCase();
     if (normalized === 'waiting') return 'waiting';
     if (normalized === 'called' || normalized === 'in consultation') return 'called';
     if (normalized === 'completed' || normalized === 'done') return 'done';
     return 'cancelled';
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
       if (!me || !me.user || me.user.role !== 'doctor') {
         location.href = 'index.html';
         return;
       }
   
       currentUser = me.user;
       setElementText('userName', `Hi, Dr. ${currentUser.name || 'Doctor'}`);
   
       // Load initial queue and consultation history concurrently
       await Promise.all([
         loadQueue(),
         loadRecords()
       ]);
   
     } catch (err) {
       console.error('Doctor initialization error:', err);
       location.href = 'index.html';
     }
   }
   
   /* ==========================================================================
      Queue Management
      ========================================================================== */
   async function loadQueue() {
     try {
       const res = await fetch('/api/queue');
       const queueList = res.ok ? await res.json() : [];
   
       if (!Array.isArray(queueList) || queueList.length === 0) {
         setElementHTML('queue', '<p class="empty-state">No patients in queue currently.</p>');
         return;
       }
   
       const rows = queueList.map(q => `
         <tr>
           <td><strong>#${escapeHtml(q.queue_number)}</strong></td>
           <td><strong>${escapeHtml(q.patient_name)}</strong></td>
           <td><span class="badge ${badgeClass(q.status)}">${escapeHtml(q.status)}</span></td>
           <td>
             <button 
               type="button"
               class="btn-select-patient"
               data-queue-id="${escapeHtml(q.queue_id)}" 
               data-patient-name="${escapeHtml(q.patient_name)}"
               style="width:auto; padding: 6px 12px; font-size: 0.8rem;">
               Select
             </button>
           </td>
         </tr>
       `).join('');
   
       const tableHTML = `
         <div class="table-wrapper">
           <table>
             <thead>
               <tr>
                 <th>#</th>
                 <th>Patient Name</th>
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
   
       setElementHTML('queue', tableHTML);
       attachQueueEventListeners();
   
     } catch (err) {
       console.error('Error loading patient queue:', err);
       setElementHTML('queue', '<p class="empty-state">Unable to load patient queue.</p>');
     }
   }
   
   function attachQueueEventListeners() {
     const buttons = document.querySelectorAll('.btn-select-patient');
     buttons.forEach(btn => {
       btn.addEventListener('click', (e) => {
         const qId = e.currentTarget.getAttribute('data-queue-id');
         const pName = e.currentTarget.getAttribute('data-patient-name');
         selectPatient(qId, pName);
       });
     });
   }
   
   function selectPatient(queue_id, patient_name) {
     const apptIdInput = document.getElementById('apptId');
     const patientNameInput = document.getElementById('patientName');
     const msgEl = document.getElementById('msg');
   
     if (apptIdInput) apptIdInput.value = queue_id;
     if (patientNameInput) patientNameInput.value = patient_name;
   
     if (msgEl) {
       msgEl.className = 'msg success';
       msgEl.textContent = `Selected: ${patient_name}`;
     }
   }
   
   /* ==========================================================================
      Consultation Recording
      ========================================================================== */
   async function saveRecord() {
     const msgEl = document.getElementById('msg');
     const saveBtn = document.getElementById('saveRecordBtn');
     
     if (msgEl) {
       msgEl.className = 'msg';
       msgEl.textContent = '';
     }
   
     const apptIdInput = document.getElementById('apptId');
     const diagnosisInput = document.getElementById('diagnosis');
     const notesInput = document.getElementById('notes');
     const prescriptionInput = document.getElementById('prescription');
   
     const appointment_id = apptIdInput ? apptIdInput.value.trim() : '';
     const diagnosis = diagnosisInput ? diagnosisInput.value.trim() : '';
     const notes = notesInput ? notesInput.value.trim() : '';
     const prescription = prescriptionInput ? prescriptionInput.value.trim() : '';
   
     if (!appointment_id || !diagnosis) {
       if (msgEl) {
         msgEl.className = 'msg error';
         msgEl.textContent = 'Please select a patient from the queue and enter a diagnosis.';
       }
       return;
     }
   
     try {
       if (saveBtn) {
         saveBtn.disabled = true;
         saveBtn.textContent = 'Saving...';
       }
   
       const res = await fetch('/api/records', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ appointment_id, diagnosis, notes, prescription })
       });
   
       const data = await res.json();
   
       if (res.ok) {
         if (msgEl) {
           msgEl.className = 'msg success';
           msgEl.textContent = 'Consultation record saved! Patient has been notified.';
         }
   
         // Reset form controls
         if (apptIdInput) apptIdInput.value = '';
         if (patientNameInput) patientNameInput.value = '';
         if (diagnosisInput) diagnosisInput.value = '';
         if (notesInput) notesInput.value = '';
         if (prescriptionInput) prescriptionInput.value = '';
   
         // Refresh UI feeds
         await Promise.all([
           loadRecords(),
           loadQueue()
         ]);
   
       } else {
         if (msgEl) {
           msgEl.className = 'msg error';
           msgEl.textContent = data.error || 'Failed to save consultation record.';
         }
       }
     } catch (err) {
       console.error('Error saving record:', err);
       if (msgEl) {
         msgEl.className = 'msg error';
         msgEl.textContent = 'Network error while saving consultation record.';
       }
     } finally {
       if (saveBtn) {
         saveBtn.disabled = false;
         saveBtn.textContent = 'Save Medical Record';
       }
     }
   }
   
   /* ==========================================================================
      Consultation History
      ========================================================================== */
   async function loadRecords() {
     try {
       const res = await fetch('/api/records/mine');
       const recordsList = res.ok ? await res.json() : [];
   
       if (!Array.isArray(recordsList) || recordsList.length === 0) {
         setElementHTML('records', '<p class="empty-state">No medical records saved yet.</p>');
         return;
       }
   
       const rows = recordsList.map(rec => {
         const dateStr = rec.date_created ? new Date(rec.date_created).toLocaleString() : '&mdash;';
   
         return `
           <tr>
             <td><strong>${escapeHtml(rec.patient_name)}</strong></td>
             <td>${escapeHtml(rec.diagnosis || '—')}</td>
             <td>${escapeHtml(rec.prescription || '—')}</td>
             <td style="color: var(--text-muted); font-size: 0.8rem;">${escapeHtml(dateStr)}</td>
           </tr>
         `;
       }).join('');
   
       const tableHTML = `
         <div class="table-wrapper">
           <table>
             <thead>
               <tr>
                 <th>Patient</th>
                 <th>Diagnosis</th>
                 <th>Prescription</th>
                 <th>Date</th>
               </tr>
             </thead>
             <tbody>
               ${rows}
             </tbody>
           </table>
         </div>
       `;
   
       setElementHTML('records', tableHTML);
   
     } catch (err) {
       console.error('Error loading doctor records:', err);
       setElementHTML('records', '<p class="empty-state">Unable to load consultation records.</p>');
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
   
   // Background auto-refresh for real-time patient queue updates (every 15s)
   setInterval(() => {
     loadQueue();
   }, 15000);
   
   // Initialize script on DOM ready
   document.addEventListener('DOMContentLoaded', init);
