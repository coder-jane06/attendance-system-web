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

    container.innerHTML = classes.map((cls) => `
        <article class="class-card">
            <div class="class-header">
                <div>
                    <h4>${escapeHtml(cls.class_name)}</h4>
                    <p>${escapeHtml(cls.subject)}</p>
                </div>
                <span class="class-code">${escapeHtml(cls.class_code)}</span>
            </div>
            <p>Schedule: ${escapeHtml(cls.schedule || 'Not scheduled')}</p>
            <p>Room: ${escapeHtml(cls.room_number || 'Not assigned')}</p>
            <p>Students: ${Number(cls.enrolled_students) || 0}</p>
            <div class="class-actions">
                <button class="btn btn-primary" onclick="generateQR(${Number(cls.id)})">
                    Generate QR
                </button>
                <button class="btn btn-secondary" onclick="viewAttendance(${Number(cls.id)})" style="margin-left: 0.5rem; margin-right: 0.5rem;">
                    View Attendance
                </button>
                <button class="btn btn-success" onclick="startClassCall(${Number(cls.id)}, '${escapeHtml(cls.class_name)}')">
                    📞 Call Class
                </button>
            </div>
        </article>
    `).join('');
}

async function generateQR(classId) {
    currentClassId = classId;
    const selectedClass = classMap.get(Number(classId));

    document.getElementById('qrClassName').textContent = selectedClass ? selectedClass.class_name : 'Class';
    document.getElementById('qrSubject').textContent = selectedClass ? selectedClass.subject : 'Subject';
    document.getElementById('qrModal').style.display = 'flex';

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
    document.getElementById('qrModal').style.display = 'none';

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
    currentClassId = classId;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('attendanceDate').value = today;
    document.getElementById('attendanceModal').style.display = 'flex';

    await loadAttendance();
}

async function loadAttendance() {
    const date = document.getElementById('attendanceDate').value;

    try {
        const response = await apiCall(`/teacher/attendance/${currentClassId}?date=${date}`);

        if (response.success) {
            displayAttendance(response.attendance);
        }
    } catch (error) {
        document.getElementById('attendanceList').innerHTML =
            '<p class="error-message">Failed to load attendance.</p>';
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
    const presentCount = attendance.filter((a) => {
        // Check for pending changes first
        if (attendanceChanges[a.id] !== undefined) {
            return attendanceChanges[a.id] === 'present';
        }
        return a.status === 'present';
    }).length;
    const absentCount = attendance.length - presentCount;
    const percentage = attendance.length > 0
        ? ((presentCount / attendance.length) * 100).toFixed(1)
        : 0;

    document.getElementById('attendanceStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${presentCount}</div>
            <div class="stat-label">Present</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${absentCount}</div>
            <div class="stat-label">Absent</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${percentage}%</div>
            <div class="stat-label">Attendance</div>
        </div>
    `;

    document.getElementById('attendanceList').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Marked At</th>
                    ${isAttendanceEditMode ? '<th>Actions</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${attendance.map((student) => {
        let status = student.status === 'present' ? 'present' : 'absent';
        // Check for pending changes
        if (attendanceChanges[student.id] !== undefined) {
            status = attendanceChanges[student.id];
        }

        const markedAt = student.marked_at ? new Date(student.marked_at).toLocaleTimeString() : '-';
        const markedBy = student.marked_by ? student.marked_by.toUpperCase() : '-';

        let actionButtons = '';
        if (isAttendanceEditMode) {
            const isPending = attendanceChanges[student.id] !== undefined;
            const pendingStatus = attendanceChanges[student.id];

            actionButtons = `
                            <td class="action-buttons">
                                <button class="btn-small ${status === 'present' ? 'btn-active' : ''}" 
                                    onclick="markAttendanceForStudent(${Number(student.id)}, 'present', '${student.student_id}')">
                                    ✓ Present
                                </button>
                                <button class="btn-small ${status === 'absent' ? 'btn-active' : ''}" 
                                    onclick="markAttendanceForStudent(${Number(student.id)}, 'absent', '${student.student_id}')">
                                    ✕ Absent
                                </button>
                                ${isPending ? '<span class="pending-indicator">*</span>' : ''}
                            </td>
                        `;
        }

        return `
                    <tr>
                        <td>${escapeHtml(student.student_id)}</td>
                        <td>${escapeHtml(student.full_name)}</td>
                        <td>
                            <span class="status-badge status-${status}">${status.toUpperCase()}</span>
                        </td>
                        <td><small>${markedBy !== '-' ? escapeHtml(markedAt) + ' (' + markedBy + ')' : '-'}</small></td>
                        ${actionButtons}
                    </tr>`;
    }).join('')}
            </tbody>
        </table>
    `;
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
        alert('No changes to save.');
        return;
    }

    const date = document.getElementById('attendanceDate').value;
    const changesToApply = Object.keys(attendanceChanges).map(studentId => ({
        studentId: Number(studentId),
        status: attendanceChanges[studentId]
    }));

    try {
        let successCount = 0;
        for (const change of changesToApply) {
            const response = await apiCall('/teacher/mark-manual', 'POST', {
                classId: currentClassId,
                studentId: change.studentId,
                status: change.status,
                date: date
            });

            if (response.success) {
                successCount++;
            }
        }

        alert(`Attendance updated successfully! ${successCount}/${changesToApply.length} records saved.`);

        // Reset edit mode and reload
        isAttendanceEditMode = false;
        attendanceChanges = {};
        updateEditModeButtons();
        await loadAttendance();

    } catch (error) {
        alert(`Error saving attendance: ${error.message}`);
    }
}

function closeAttendanceModal() {
    document.getElementById('attendanceModal').style.display = 'none';
}

async function exportAttendance() {
    try {
        const token = getAuthToken();
        const date = document.getElementById('attendanceDate').value;

        const response = await fetch(`${API_BASE_URL}/teacher/export/${currentClassId}?startDate=${date}&endDate=${date}`, {
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
    if (event.target.className === 'modal') {
        closeQRModal();
        closeAttendanceModal();
    }
};
