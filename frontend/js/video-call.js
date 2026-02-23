// video-call.js
// Handles WebRTC Video Calling using Agora SDK and Socket.io Signaling

let rtc = {
    localAudioTrack: null,
    localVideoTrack: null,
    client: null,
};

let options = {
    // You MUST replace this with your Agora App ID from console.agora.io
    // Working demo ID without token authentication required
    appId: "ca1d6ddbe8e541ce8046b45a491eeb05",
    channel: "",
    token: null, // Temporary token (or null if testing without tokens enabled in Agora Console)
    uid: null
};

let socket = null;
let currentCallType = null; // 'class' or '1on1'
let activeCallTimer = null;
let secondsElapsed = 0;

// Initialize Socket connection
function initSignaling() {
    let userStr = localStorage.getItem('user') || localStorage.getItem('userData');
    if (!userStr) return;
    const user = JSON.parse(userStr);

    // Connect to Signaling Server
    socket = io(window.location.origin);

    socket.on('connect', () => {
        console.log('Connected to Signaling Server');
        socket.emit('register', user.id.toString());
    });

    // -------- STUDENT: Listen for Class Call Invites --------
    socket.on('classCallStarted', (data) => {
        // Here we should verify if the student is actually in the class
        // For simplicity, if they get the broadcast, we show the modal
        const modal = document.getElementById('incomingCallModal');
        const nameEl = document.getElementById('incomingCallName');
        const subtitleEl = document.getElementById('incomingCallSubtitle');

        nameEl.textContent = `Teacher ${data.teacherName}`;
        subtitleEl.textContent = "is starting a Class Video Meeting. Join now?";

        // Store room info on accept button
        const acceptBtn = document.getElementById('acceptCallBtn');
        acceptBtn.onclick = () => {
            modal.classList.add('hidden');
            joinCall(data.roomId, 'class');
        };

        const declineBtn = document.getElementById('declineCallBtn');
        declineBtn.onclick = () => modal.classList.add('hidden');

        modal.classList.remove('hidden');
    });

    // -------- 1-to-1: Listen for Direct Call Offers --------
    socket.on('incomingCall', (data) => {
        const modal = document.getElementById('incomingCallModal');
        const nameEl = document.getElementById('incomingCallName');
        const subtitleEl = document.getElementById('incomingCallSubtitle');

        nameEl.textContent = data.name;
        subtitleEl.textContent = "is calling you directly...";

        // Store room info on accept button
        const acceptBtn = document.getElementById('acceptCallBtn');
        acceptBtn.onclick = () => {
            modal.classList.add('hidden');
            socket.emit('answerCall', { to: data.from, signal: "accepted" });
            joinCall(data.signal, '1on1', `Call with ${data.name}`);
        };

        const declineBtn = document.getElementById('declineCallBtn');
        declineBtn.onclick = () => modal.classList.add('hidden');

        modal.classList.remove('hidden');
    });

    socket.on('callAccepted', (data) => {
        console.log("Call accepted by peer");
        // Update Title UI since they connected
        document.getElementById('activeCallTitle').textContent = "Private Call connected";
    });
}

// ---------------------------------------------------------
// Agora SDK Implementation
// ---------------------------------------------------------

async function joinCall(roomId, type = 'class', title = 'Class Meeting') {
    options.channel = roomId;
    currentCallType = type;

    // Show UI Overlay
    document.getElementById('activeCallTitle').textContent = title;
    document.getElementById('videoCallOverlay').classList.add('active');

    startTimer();

    try {
        // 1. Create Agora Client
        rtc.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

        // 2. Set up event listeners for remote users
        rtc.client.on("user-published", handleUserPublished);
        rtc.client.on("user-unpublished", handleUserUnpublished);
        rtc.client.on("user-left", handleUserLeft);

        // 3. Join the channel
        options.uid = await rtc.client.join(options.appId, options.channel, options.token, null);
        console.log("Joined channel: " + options.channel);

        // 4. Create local Audio/Video tracks gracefully
        let tracksToPublish = [];

        try {
            rtc.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            tracksToPublish.push(rtc.localAudioTrack);
        } catch (audioErr) {
            console.warn("Microphone access denied or device not found.", audioErr);
        }

        try {
            rtc.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
            tracksToPublish.push(rtc.localVideoTrack);
            // 5. Play local video in the UI
            rtc.localVideoTrack.play("localVideoContainer");
        } catch (videoErr) {
            console.warn("Camera access denied or device not found.", videoErr);
            // Hide the 'You' video element since there's no camera
            document.getElementById('localVideo').style.display = 'none';
        }

        // 6. Publish local tracks to the channel
        if (tracksToPublish.length > 0) {
            await rtc.client.publish(tracksToPublish);
            console.log("Successfully published available local tracks");
        } else {
            console.log("Joined as viewer only (no camera/mic).");
        }

    } catch (error) {
        console.error("Error joining video call: ", error);
        alert("Failed to join the call. Network or signaling error.");
        leaveCall();
    }
}

// Teacher triggered action
window.startClassCall = function (classId, className) {
    let userStr = localStorage.getItem('user') || localStorage.getItem('userData');
    if (!userStr || userStr === 'undefined') {
        alert("Session expired or missing. Please log in again.");
        return;
    }
    const user = JSON.parse(userStr);
    const roomId = `class_${classId}_${Date.now()}`;

    // 1. Notify signaling server to broadcast invite to students
    socket.emit('startClassCall', {
        classId: classId,
        teacherId: user.id || user.teacher_id,
        roomId: roomId,
        teacherName: user.full_name
    });

    // 2. Teacher joins the newly created room
    joinCall(roomId, 'class', `Class: ${className}`);
};

// 1-on-1 triggered action
window.start1on1Call = function (targetUserId, targetName) {
    let userStr = localStorage.getItem('user') || localStorage.getItem('userData');
    if (!userStr || userStr === 'undefined') {
        alert("Session expired or missing. Please log in again.");
        return;
    }
    const user = JSON.parse(userStr);
    const roomId = `private_${user.id || user.student_id}_${targetUserId}_${Date.now()}`;

    // Notify signaling server to ring the exact user
    socket.emit('callUser', {
        userToCall: targetUserId.toString(),
        signalData: roomId,
        from: (user.id || user.student_id).toString(),
        callerName: user.full_name
    });

    // Caller joins the room immediately and waits
    joinCall(roomId, '1on1', `Calling ${targetName}...`);
};

// ---------------------------------------------------------
// Agora Event Handlers (Remote Users)
// ---------------------------------------------------------

async function handleUserPublished(user, mediaType) {
    // remote stream added
    await rtc.client.subscribe(user, mediaType);
    console.log("Subscribed to remote user: " + user.uid);

    if (mediaType === "video") {
        const remoteVideoTrack = user.videoTrack;

        // Create container for remote video
        const playerContainer = document.createElement("div");
        playerContainer.id = `remote-user-${user.uid}`;
        playerContainer.className = "video-container remote";

        // Label
        const label = document.createElement("div");
        label.className = "video-label";
        label.innerHTML = `<span class="mic-status">🎙️</span> User ${user.uid.toString().substr(-4)}`;
        playerContainer.appendChild(label);

        document.getElementById("videoGrid").appendChild(playerContainer);

        // Update Grid Layout dynamically
        updateGridLayout();

        // Play remote video
        remoteVideoTrack.play(playerContainer.id);
    }

    if (mediaType === "audio") {
        const remoteAudioTrack = user.audioTrack;
        remoteAudioTrack.play();
    }
}

function handleUserUnpublished(user, mediaType) {
    if (mediaType === "video") {
        const playerContainer = document.getElementById(`remote-user-${user.uid}`);
        if (playerContainer) {
            playerContainer.remove();
            updateGridLayout();
        }
    }
}

function handleUserLeft(user) {
    const playerContainer = document.getElementById(`remote-user-${user.uid}`);
    if (playerContainer) {
        playerContainer.remove();
        updateGridLayout();
    }
}

// ---------------------------------------------------------
// UI Controls
// ---------------------------------------------------------

function updateGridLayout() {
    const grid = document.getElementById('videoGrid');
    const childCount = grid.children.length; // Local + Remotes

    // Dynamic Grid based on participants
    grid.setAttribute('data-users', childCount);

    if (childCount > 2) {
        grid.classList.remove('pip-mode');
        // Reset local video container styling for grid
        const local = document.getElementById('localVideoContainer');
        local.className = "video-container local";
    } else {
        grid.classList.add('pip-mode');
        const local = document.getElementById('localVideoContainer');
        local.className = "video-container local pip-view";
    }
}

function startTimer() {
    secondsElapsed = 0;
    document.getElementById('callTimer').textContent = "00:00";
    activeCallTimer = setInterval(() => {
        secondsElapsed++;
        const m = Math.floor(secondsElapsed / 60).toString().padStart(2, '0');
        const s = (secondsElapsed % 60).toString().padStart(2, '0');
        document.getElementById('callTimer').textContent = `${m}:${s}`;
    }, 1000);
}

async function leaveCall() {
    // Stop local tracks
    if (rtc.localAudioTrack) {
        rtc.localAudioTrack.stop();
        rtc.localAudioTrack.close();
    }
    if (rtc.localVideoTrack) {
        rtc.localVideoTrack.stop();
        rtc.localVideoTrack.close();
    }

    // Leave Channel
    if (rtc.client) {
        await rtc.client.leave();
    }

    // Reset UI
    document.getElementById('videoCallOverlay').classList.remove('active');

    // Remove all remote videos
    const remotes = document.querySelectorAll('.video-container.remote');
    remotes.forEach(el => el.remove());

    // Reset Grid
    updateGridLayout();

    // Stop Timer
    clearInterval(activeCallTimer);
    document.getElementById('callTimer').textContent = "00:00";

    // Reset buttons
    document.getElementById('toggleAudioBtn').classList.remove('active-state');
    document.getElementById('toggleVideoBtn').classList.remove('active-state');
}

// Button Hooks
document.addEventListener('DOMContentLoaded', () => {
    // Initialize sockets if on dashboard
    if (window.location.pathname.includes('teacher.html') || window.location.pathname.includes('student.html')) {
        // Make sure Agora SDK is loaded 
        if (typeof AgoraRTC !== 'undefined') {
            initSignaling();
        } else {
            console.warn("Agora SDK script not loaded yet.");
        }
    }

    // Controls
    const btnAudio = document.getElementById('toggleAudioBtn');
    if (btnAudio) {
        btnAudio.onclick = async () => {
            if (!rtc.localAudioTrack) return;
            const isMuted = !rtc.localAudioTrack.muted;
            await rtc.localAudioTrack.setMuted(isMuted);
            btnAudio.classList.toggle('active-state', isMuted);
            btnAudio.innerHTML = isMuted ? '🔇' : '🎤';
        };
    }

    const btnVideo = document.getElementById('toggleVideoBtn');
    if (btnVideo) {
        btnVideo.onclick = async () => {
            if (!rtc.localVideoTrack) return;
            const isMuted = !rtc.localVideoTrack.muted;
            await rtc.localVideoTrack.setMuted(isMuted);
            btnVideo.classList.toggle('active-state', isMuted);

            // If muted (video off), we explicitly hide the play container to show just a black box/avatar
            // But Agora handles the stream pause.
        };
    }

    const btnEnd = document.getElementById('endCallBtn');
    if (btnEnd) btnEnd.onclick = leaveCall;
});
