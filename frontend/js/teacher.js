if (!requireAuth('teacher')) {
    // Redirect handled in requireAuth
}

const user = getUserData();
document.getElementById('teacherName').textContent = user.full_name;

let currentClassId = null;
let qrInterval = null;
let countdownInterval = null;
let classMap = new Map();
let isAttendanceEditMode = false;
let currentAttendanceData = [];
let attendanceChanges = {}; // Track changes for manual marking

document.addEventListener('DOMContentLoaded', () => {
    const quickGenerateBtn = document.getElementById('quickGenerateQr');
    if (quickGenerateBtn) {
        quickGenerateBtn.addEventListener('click', quickGenerateQR);
    }
});

loadClasses();

async function loadClasses() {
    try {
        const response = await apiCall('/teacher/classes');

        if (response.success) {
            displayClasses(response.classes);
        }
    } catch (error) {
        document.getElementById('classesList').innerHTML =
            '<p class="error-message">Failed to load classes.</p>';
    }
}

function displayClasses(classes) {
    const container = document.getElementById('classesList');
    classMap = new Map(classes.map((cls) => [Number(cls.id), cls]));

    if (!classes.length) {
        container.innerHTML = '<p class="loading">No classes found. Contact admin to assign classes.</p>';
        return;
    }

    if (!currentClassId) {
        currentClassId = Number(classes[0].id);
    }

    // Update global stat tiles
    const tc = document.getElementById('totalClassesCount');
    if (tc) tc.textContent = classes.length;
    const ts = document.getElementById('totalStudentsCount');
    if (ts) {
        const total = classes.reduce((acc, cls) => acc + (Number(cls.enrolled_students) || 0), 0);
        ts.textContent = total;
    }

    container.innerHTML = classes.map((cls) => `
        <div class="ep-class-row">
            <div class="ep-class-badge">
                <i data-lucide="layers" style="width:18px;height:18px;"></i>
            </div>
            <div class="ep-class-info">
                <div class="ep-class-name">${escapeHtml(cls.class_name)}</div>
                <div class="ep-class-meta">${escapeHtml(cls.schedule || 'Schedule TBA')} · ${escapeHtml(cls.room_number || 'Room TBA')} · ${Number(cls.enrolled_students) || 0} students</div>
            </div>
            <div class="ep-class-actions">
                <button class="ep-btn ep-btn-primary ep-btn-sm" onclick="generateQR(${Number(cls.id)})">
                    <i data-lucide="qr-code" style="width:13px;height:13px;"></i> QR
                </button>
                <button class="ep-btn ep-btn-ghost ep-btn-sm" onclick="viewAttendance(${Number(cls.id)})">
                    <i data-lucide="file-text" style="width:13px;height:13px;"></i> Logs
                </button>
            </div>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (typeof gsap !== 'undefined') {
        gsap.from('.ep-class-row', { y: 16, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' });
    }
}

function quickGenerateQR() {
    if (!currentClassId) {
        alert('No classes available yet.');
        return;
    }
    generateQR(currentClassId);
}

function quickViewAttendance() {
    if (!currentClassId) {
        alert('No classes available yet.');
        return;
    }
    viewAttendance(currentClassId);
}

function quickExportAttendance() {
    if (!currentClassId) {
        alert('No classes available yet.');
        return;
    }
    exportAttendance();
}

async function generateQR(classId) {
    currentClassId = classId;
    const selectedClass = classMap.get(Number(classId));

    document.getElementById('qrClassName').textContent = selectedClass ? selectedClass.class_name : 'Class';
    document.getElementById('qrSubject').textContent = selectedClass ? selectedClass.subject : 'Subject';
    document.getElementById('qrModal').classList.add('active');

    await fetchAndDisplayQR();

    if (qrInterval) {
        clearInterval(qrInterval);
    }

    qrInterval = setInterval(async () => {
        await fetchAndDisplayQR();
    }, 5000);
}

async function fetchAndDisplayQR() {
    try {
        const response = await apiCall('/teacher/generate-qr', 'POST', {
            classId: currentClassId
        });

        if (response.success) {
            document.getElementById('qrImage').src = response.qrCode;
            startTimer(response.validitySeconds);
        }
    } catch (error) {
        alert(`Failed to generate QR code: ${error.message}`);
        closeQRModal();
    }
}

function startTimer(seconds) {
    let timeLeft = seconds;
    const countdownEl = document.getElementById('countdown');
    const progressEl = document.getElementById('timerProgress');

    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    countdownEl.textContent = timeLeft;
    progressEl.style.width = '100%';

    countdownInterval = setInterval(() => {
        timeLeft -= 1;
        countdownEl.textContent = timeLeft;
        progressEl.style.width = `${(timeLeft / seconds) * 100}%`;

        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }, 1000);
}

function regenerateQR() {
    fetchAndDisplayQR();
}

function closeQRModal() {
    document.getElementById('qrModal').classList.remove('active');

    if (qrInterval) {
        clearInterval(qrInterval);
        qrInterval = null;
    }

    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

async function viewAttendance(classId) {
    currentClassId = Number(classId);
    
    // Switch to logs tab visually
    const logTab = document.getElementById('tabLogs');
    if (logTab) logTab.click(); 

    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput) {
        dateInput.value = today;
    }

    // Load data immediately
    await loadAttendance();
}

async function loadAttendance() {
    const dateInput = document.getElementById('attendanceDate');
    const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    const attendeeListEl = document.getElementById('attendanceList');

    if (!currentClassId) {
        if (attendeeListEl) attendeeListEl.innerHTML = '<p class="error-message">Please select a class from the dashboard first.</p>';
        return;
    }

    try {
        if (attendeeListEl) attendeeListEl.innerHTML = '<div class="loading">Fetching records...</div>';
        const response = await apiCall(`/teacher/attendance/${currentClassId}?date=${date}`);

        if (response.success) {
            displayAttendance(response.attendance);
        }
    } catch (error) {
        if (attendeeListEl) attendeeListEl.innerHTML =
            '<p class="error-message">Failed to load attendance logs.</p>';
    }
}

function displayAttendance(attendance) {
    currentAttendanceData = attendance;
    attendanceChanges = {};
    isAttendanceEditMode = false;
    updateAttendanceDisplay();
    updateEditModeButtons();
}

function updateAttendanceDisplay() {
    const attendance = currentAttendanceData;
    const attendeeListEl = document.getElementById('attendanceList');
    if (!attendeeListEl) return;

    const presentCount = attendance.filter((a) => {
        if (attendanceChanges[a.id] !== undefined) return attendanceChanges[a.id] === 'present';
        return a.status === 'present';
    }).length;
    const absentCount = attendance.length - presentCount;
    const percentage = attendance.length > 0 ? ((presentCount / attendance.length) * 100).toFixed(1) : 0;

    const statsEl = document.getElementById('attendanceStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-card">
                <div class="stat-number" style="color:#22c55e;">${presentCount}</div>
                <div class="stat-label">Present</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" style="color:#ef4444;">${absentCount}</div>
                <div class="stat-label">Absent</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" style="color:var(--blue);">${percentage}%</div>
                <div class="stat-label">Attendance</div>
            </div>
        `;
    }

    attendeeListEl.innerHTML = `
        <table class="ep-table">
            <thead>
                <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Records</th>
                    ${isAttendanceEditMode ? '<th style="text-align:right;">Actions</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${attendance.map((student) => {
                    let status = student.status === 'present' ? 'present' : 'absent';
                    const isPending = attendanceChanges[student.id] !== undefined;
                    if (isPending) status = attendanceChanges[student.id];

                    const markedAt = student.marked_at ? new Date(student.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    const markedBy = student.marked_by ? student.marked_by.toUpperCase() : '';

                    return `
                        <tr class="${isPending ? 'ep-row-modified' : ''}">
                            <td data-label="Student ID"><code class="ep-id-code">${escapeHtml(student.student_id)}</code></td>
                            <td data-label="Name" style="font-weight:600;">${escapeHtml(student.full_name)}</td>
                            <td data-label="Status">
                                <span class="status-badge status-${status}">${status.toUpperCase()}</span>
                                ${isPending ? '<span class="ep-pill ep-pill-pink" style="margin-left:8px;font-size:0.6rem;">MODIFIED</span>' : ''}
                            </td>
                            <td data-label="Records" style="color:var(--muted); font-size:0.8rem;">
                                ${markedBy ? `${markedAt} <span style="opacity:0.5; font-size:0.75rem;">(${markedBy})</span>` : '<span style="opacity:0.3">—</span>'}
                            </td>
                            ${isAttendanceEditMode ? `
                                <td data-label="Actions" style="text-align:right;">
                                    <div style="display:inline-flex; gap:8px;">
                                        <button class="ep-btn ${status === 'present' ? 'ep-btn-primary' : 'ep-btn-ghost'} ep-btn-sm" 
                                            onclick="markAttendanceForStudent(${student.id}, 'present')" title="Mark Present">
                                            <i data-lucide="check" style="width:14px;height:14px;"></i>
                                        </button>
                                        <button class="ep-btn ${status === 'absent' ? 'ep-btn-danger-alt' : 'ep-btn-ghost'} ep-btn-sm" 
                                            onclick="markAttendanceForStudent(${student.id}, 'absent')" title="Mark Absent">
                                            <i data-lucide="x" style="width:14px;height:14px;"></i>
                                        </button>
                                    </div>
                                </td>
                            ` : ''}
                        </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateEditModeButtons() {
    const editBtn = document.getElementById('editModeBtn');
    const saveBtn = document.getElementById('saveModeBtn');
    const cancelBtn = document.getElementById('cancelModeBtn');

    if (isAttendanceEditMode) {
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
    } else {
        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    }
}

function toggleEditMode() {
    isAttendanceEditMode = true;
    updateAttendanceDisplay();
    updateEditModeButtons();
}

function cancelEditMode() {
    isAttendanceEditMode = false;
    attendanceChanges = {};
    updateAttendanceDisplay();
    updateEditModeButtons();
}

function markAttendanceForStudent(studentId, status, studentCode) {
    attendanceChanges[studentId] = status;
    updateAttendanceDisplay();
}

async function saveManualAttendance() {
    if (Object.keys(attendanceChanges).length === 0) {
        return;
    }

    const saveBtn = document.getElementById('saveModeBtn');
    const origText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" style="width:14px;height:14px;"></i> Saving...';
    lucide.createIcons();

    const date = document.getElementById('attendanceDate').value;
    const changes = Object.keys(attendanceChanges).map(studentId => ({
        studentId: Number(studentId),
        status: attendanceChanges[studentId]
    }));

    try {
        const response = await apiCall('/teacher/mark-bulk-manual', 'POST', {
            classId: currentClassId,
            changes: changes,
            date: date
        });

        if (response.success) {
            // Cinematic success feedback
            gsap.to('.stat-card', { 
                scale: 1.05, 
                duration: 0.3, 
                stagger: 0.1, 
                yoyo: true, 
                repeat: 1, 
                ease: "back.out(2)" 
            });
            
            isAttendanceEditMode = false;
            attendanceChanges = {};
            updateEditModeButtons();
            await loadAttendance();
        }
    } catch (error) {
        alert(`Error saving: ${error.message}`);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = origText;
    }
}

function closeAttendanceModal() {
    document.getElementById('attendanceModal').classList.remove('active');
}

async function exportAttendance() {
    try {
        if (!currentClassId || Number.isNaN(Number(currentClassId))) {
            alert('Please select a valid class first.');
            return;
        }

        const token = getAuthToken();
        const date = document.getElementById('attendanceDate').value;
        const classId = Number(currentClassId);

        const response = await fetch(`${API_BASE_URL}/teacher/export/${classId}?startDate=${date}&endDate=${date}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'attendance.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert(`Failed to export attendance: ${error.message}`);
    }
}

window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        closeQRModal();
        closeAttendanceModal();
    }
};
