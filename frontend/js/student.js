if (!requireAuth('student')) {
    // Redirect handled in requireAuth
}

const user = getUserData();
document.getElementById('studentName').textContent = user.full_name;

loadStatistics();
loadRecentAttendance();

setInterval(() => {
    loadStatistics();
    loadRecentAttendance();
}, 30000);

async function loadStatistics() {
    try {
        const response = await apiCall('/student/statistics');

        if (response.success) {
            displayStatistics(response.statistics);
        }
    } catch (error) {
        document.getElementById('statisticsList').innerHTML =
            '<p class="error-message">Failed to load statistics.</p>';
    }
}

function displayStatistics(stats) {
    const container = document.getElementById('statisticsList');

    if (!stats.length) {
        container.innerHTML = '<p class="loading">You are not enrolled in any classes.</p>';
        return;
    }

    container.innerHTML = stats.map((stat) => {
        const percentage = parseFloat(stat.attendance_percentage) || 0;
        let statusColor = 'var(--success)';

        if (percentage < 75) {
            statusColor = 'var(--danger)';
        } else if (percentage < 85) {
            statusColor = 'var(--warning)';
        }

        return `
            <article class="stat-card-detailed">
                <div class="class-header">
                    <div>
                        <h4>${escapeHtml(stat.class_name)}</h4>
                        <span class="class-code">${escapeHtml(stat.class_code)}</span>
                    </div>
                </div>
                <p class="muted-text">${escapeHtml(stat.subject)}</p>

                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%; background: ${statusColor};">
                        ${percentage}%
                    </div>
                </div>

                <p class="muted-text">${Number(stat.present_count) || 0} / ${Number(stat.total_sessions) || 0} sessions attended</p>
            </article>
        `;
    }).join('');
}

async function loadRecentAttendance() {
    try {
        const response = await apiCall('/student/attendance');

        if (response.success) {
            displayRecentAttendance(response.attendance.slice(0, 10));
        }
    } catch (error) {
        document.getElementById('recentAttendance').innerHTML =
            '<p class="error-message">Failed to load recent attendance.</p>';
    }
}

function displayRecentAttendance(attendance) {
    const container = document.getElementById('recentAttendance');

    if (!attendance.length) {
        container.innerHTML = '<p class="loading">No attendance records yet.</p>';
        return;
    }

    container.innerHTML = attendance.map((record) => {
        const status = record.status === 'present' ? 'present' : 'absent';
        const date = new Date(record.session_date).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        return `
            <div class="attendance-item">
                <div class="attendance-info">
                    <h4>${escapeHtml(record.class_name)}</h4>
                    <p>${escapeHtml(date)} | ${escapeHtml(record.subject)}</p>
                </div>
                <span class="status-badge status-${status}">${status.toUpperCase()}</span>
            </div>
        `;
    }).join('');
}
