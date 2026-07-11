let socket;
let player;
let roomId;
let userId;
let isHost = false;
let isSyncing = false;
let roomUrl = "";
let lastTimeSent = 0;
let roomPasscode = "";
let isMuted = false;

// WebRTC Variables
let localStream = null;
const peers = {}; // { socketId: RTCPeerConnection }
let inCall = false;
let micEnabled = true;
let videoEnabled = true;

// Initialize Session
async function initSession() {
  if (window.auth) {
    if (!auth.user) {
      await auth.init();
    }
    userId = auth.getUserId();
  }
}

// Initialize Unified Player
function initializePlayer() {
  player = new UnifiedPlayer('player-container', roomUrl, {
    isHost: isHost,
    onReady: () => {
      console.log("Unified Player Ready");
      if (!isHost) {
        // Request initial state from host
        socket.emit('request-sync');
      } else {
        // Host starts tracking time
        startHostTimeTracking();
      }
    },
    onStateChange: (event) => {
      if (!isHost || isSyncing) return;
      const currentTime = player.getCurrentTime();
      if (event.type === 'playing') {
        socket.emit('video-control', { type: 'play', time: currentTime });
      } else if (event.type === 'paused') {
        socket.emit('video-control', { type: 'pause', time: currentTime });
      }
    }
  });
}

function startHostTimeTracking() {
  setInterval(() => {
    if (!player || !isHost || isSyncing) return;
    try {
      if (player.isPlaying()) {
        const currentTime = player.getCurrentTime();
        // If currentTime jumped (seeked) by more than 1.5s
        if (Math.abs(currentTime - lastTimeSent) > 1.5) {
          socket.emit('video-control', { type: 'seek', time: currentTime });
        }
        lastTimeSent = currentTime;
      }
    } catch (e) {}
  }, 500);
}

// Connect to Room
function connectSocket() {
  socket = io();

  socket.on('connect', () => {
    socket.emit('join-room', { roomId, userId, passcode: roomPasscode });
  });

  socket.on('room-joined', ({ roomDetails, isHost: hostStatus, chatHistory, queue }) => {
    isHost = hostStatus;
    roomUrl = roomDetails.videoUrl;

    // Update Room UI Details
    document.getElementById('room-title').textContent = roomDetails.title;
    document.getElementById('room-host-name').innerHTML = `Host: <span class="text-secondary font-bold">${roomDetails.hostName}</span>`;
    document.getElementById('room-category-label').textContent = roomDetails.category;

    updateRoleBadge();
    initHostControls();

    // Render Chat History
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML = '';
    chatHistory.forEach(msg => appendMessage(msg));
    chatBox.scrollTop = chatBox.scrollHeight;

    // Render Queue
    renderQueueList(queue || []);

    // Load Video Player
    initializePlayer();
  });

  socket.on('host-status-changed', (hostStatus) => {
    isHost = hostStatus;
    updateRoleBadge();
    
    // Reload player with controls if host status changes
    if (player) {
      player.destroy();
      initializePlayer();
    }
  });

  // Sync state events from host
  socket.on('video-state-change', (event) => {
    if (isHost || !player) return;

    isSyncing = true;
    console.log("Sync action received:", event);

    if (event.type === 'play') {
      player.seekTo(event.time);
      player.play();
    } else if (event.type === 'pause') {
      player.seekTo(event.time);
      player.pause();
    } else if (event.type === 'seek') {
      player.seekTo(event.time);
    }

    setTimeout(() => {
      isSyncing = false;
    }, 1000);
  });

  // Host receiving sync request from new viewer
  socket.on('get-current-player-state', (targetSocketId) => {
    if (!isHost || !player) return;
    try {
      const time = player.getCurrentTime();
      const isPlaying = player.isPlaying();
      socket.emit('host-player-state', { targetSocketId, time, isPlaying });
    } catch(e) {}
  });

  // Viewer receiving current state from host
  socket.on('sync-to-state', ({ time, isPlaying }) => {
    if (isHost || !player) return;
    
    isSyncing = true;
    console.log("Syncing initially to host player state:", { time, isPlaying });
    
    player.seekTo(time);
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
    
    setTimeout(() => {
      isSyncing = false;
    }, 1000);
  });

  socket.on('video-changed', ({ videoUrl }) => {
    roomUrl = videoUrl;
    if (player) {
      player.loadVideo(videoUrl);
      lastTimeSent = 0;
      if (!isHost) {
        isSyncing = true;
        setTimeout(() => {
          isSyncing = false;
        }, 1500);
      }
    }
  });

  socket.on('receive-reaction', ({ reaction }) => {
    triggerFloatingEmoji(reaction);
  });

  socket.on('chat-message', (msg) => {
    appendMessage(msg);
    const chatBox = document.getElementById('chat-messages');
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  socket.on('presence-update', (users) => {
    renderUsersList(users);
  });

  socket.on('error', (err) => {
    alert("System message: " + err);
    location.href = '/lobby.html';
  });

  // ==========================================
  // PLAYLIST QUEUE CLIENT EVENT LISTENERS
  // ==========================================
  socket.on('queue-updated', (queue) => {
    renderQueueList(queue);
  });

  // ==========================================
  // HOST MODERATION CLIENT EVENT LISTENERS
  // ==========================================
  socket.on('kicked-from-room', ({ reason }) => {
    alert("You have been " + reason);
    location.href = '/lobby.html';
  });

  socket.on('mute-status-changed', ({ isMuted: mutedState }) => {
    isMuted = mutedState;
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.placeholder = isMuted ? "You are muted by the host." : "Type a message...";
      chatInput.disabled = isMuted;
    }
  });

  // ==========================================
  // WEBRTC SIGNALING SOCKET LISTENERS
  // ==========================================
  socket.on('user-joined-call', async ({ socketId, name }) => {
    if (!inCall) return;
    console.log("Initiating WebRTC offer to new call participant:", name);
    const pc = createPeerConnection(socketId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { targetSocketId: socketId, offer });
    } catch(err) {
      console.error("Failed to create offer:", err);
    }
  });

  socket.on('webrtc-offer', async ({ senderSocketId, offer }) => {
    if (!inCall) return;
    console.log("Answering WebRTC offer from socket:", senderSocketId);
    const pc = createPeerConnection(senderSocketId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetSocketId: senderSocketId, answer });
    } catch(err) {
      console.error("Failed to handle offer / create answer:", err);
    }
  });

  socket.on('webrtc-answer', async ({ senderSocketId, answer }) => {
    const pc = peers[senderSocketId];
    if (pc) {
      console.log("Setting remote description answer for:", senderSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  socket.on('webrtc-candidate', async ({ senderSocketId, candidate }) => {
    const pc = peers[senderSocketId];
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });

  socket.on('user-left-call', ({ socketId }) => {
    console.log("User disconnected from call:", socketId);
    if (peers[socketId]) {
      peers[socketId].close();
      delete peers[socketId];
    }
    const container = document.getElementById(`peer-container-${socketId}`);
    if (container) container.remove();
  });
}

function updateRoleBadge() {
  const dot = document.getElementById('role-badge-dot');
  const text = document.getElementById('role-badge-text');
  const overlay = document.getElementById('viewer-overlay');
  const changeVideoBtn = document.getElementById('change-video-btn');

  if (isHost) {
    if (dot) dot.className = "w-2 h-2 rounded-full bg-primary animate-pulse";
    if (text) text.textContent = "Host (Presenter Mode)";
    if (overlay) overlay.classList.add('hidden');
    if (changeVideoBtn) changeVideoBtn.classList.remove('hidden');
  } else {
    if (dot) dot.className = "w-2 h-2 rounded-full bg-secondary animate-pulse";
    if (text) text.textContent = "Viewer (Synchronized)";
    if (overlay) overlay.classList.remove('hidden');
    if (changeVideoBtn) changeVideoBtn.classList.add('hidden');
  }
}

function appendMessage(msg) {
  const chatBox = document.getElementById('chat-messages');
  if (!chatBox) return;

  if (msg.userId === 'system') {
    const el = document.createElement('div');
    el.className = "text-center text-[11px] text-text-muted my-1 italic";
    el.textContent = msg.text;
    chatBox.appendChild(el);
    return;
  }

  const isMe = msg.userId === userId;
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msgHtml = isMe ? `
    <div class="flex flex-col items-end gap-1">
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-text-muted">${timeStr}</span>
        <span class="font-label-sm font-bold text-primary">Me</span>
      </div>
      <div class="p-3 bg-secondary-container text-on-secondary-container rounded-2xl rounded-tr-none text-sm font-body-md shadow-lg shadow-secondary/10 max-w-[85%] break-words">
        ${escapeHTML(msg.text)}
      </div>
    </div>
  ` : `
    <div class="flex gap-3">
      <div class="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 border border-glass-stroke">
        <img class="w-full h-full object-cover" src="${msg.avatarUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuD4EI8_vyQW7UERp6LoH-hQHDh8uKCs3uhrq8qn0VzXXoF6-nkVpfiSWqtl6V7ngOuHv4s2nctk4tvMMU9DoVtlEPUqci5nmXeAWxgT28IkXri8R8QmF8EoDMndU5K9Ttnr-IVH0_PJIVARsLym-IA3lZ3aujA_L0LjxZg7DoGt6BolVWHZ3-rns3txN6q-Y2imJPSBXrCKcMxrnW_eNkIVB5Sq_Xld85_vxEfb39NGFPJzJENeYGe3Yxp0w3X2wPBAcmdHQy529Ec'}" alt="${msg.userName}">
      </div>
      <div class="flex flex-col gap-1 max-w-[85%]">
        <div class="flex items-center gap-2">
          <span class="font-label-sm font-bold text-secondary">${msg.userName}</span>
          <span class="text-[10px] text-text-muted">${timeStr}</span>
        </div>
        <div class="p-3 bg-surface-variant rounded-2xl rounded-tl-none text-on-surface font-body-md text-sm break-words">
          ${escapeHTML(msg.text)}
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = msgHtml;
  chatBox.appendChild(container.firstElementChild || container);
}

function renderUsersList(users) {
  const usersContainer = document.getElementById('room-users-list');
  if (!usersContainer) return;

  usersContainer.innerHTML = users.map(user => {
    const ringClass = user.isHost ? 'ring-2 ring-primary border-transparent neon-glow' : 'border border-glass-stroke';
    return `
      <div class="relative group" title="${user.name} ${user.isHost ? '(Host)' : ''}">
        <div class="h-10 w-10 rounded-full ${ringClass} overflow-hidden cursor-pointer transition-transform hover:scale-110">
          <img class="w-full h-full object-cover" src="${user.avatarUrl}" alt="${user.name}">
        </div>
        <div class="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-surface-deep rounded-full"></div>
        
        <!-- Moderation Overlay controls for the Host -->
        ${isHost && !user.isHost ? `
          <div class="absolute top-11 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-md px-2 py-1.5 rounded-xl border border-glass-stroke shadow-2xl z-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <button onclick="muteParticipant('${user.socketId}', ${!user.isMuted})" class="hover:text-primary transition-colors cursor-pointer" title="${user.isMuted ? 'Unmute' : 'Mute'} Chat">
              <span class="material-symbols-outlined text-[15px]">${user.isMuted ? 'volume_up' : 'volume_off'}</span>
            </button>
            <button onclick="kickParticipant('${user.socketId}', '${user.userId}')" class="hover:text-error transition-colors cursor-pointer" title="Kick Guest">
              <span class="material-symbols-outlined text-[15px]">logout</span>
            </button>
            <button onclick="banParticipant('${user.socketId}', '${user.userId}')" class="hover:text-error transition-colors cursor-pointer" title="Ban Guest">
              <span class="material-symbols-outlined text-[15px]">block</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Moderation click event functions
window.muteParticipant = function(socketId, isMuteVal) {
  if (socket) {
    socket.emit('mute-user', { targetSocketId: socketId, isMuted: isMuteVal });
  }
};

window.kickParticipant = function(socketId, guestUserId) {
  if (confirm("Kick this user from the Watch Party?")) {
    socket.emit('kick-user', { targetSocketId: socketId, targetUserId: guestUserId });
  }
};

window.banParticipant = function(socketId, guestUserId) {
  if (confirm("Ban this user permanently from this Watch Party room?")) {
    socket.emit('ban-user', { targetSocketId: socketId, targetUserId: guestUserId });
  }
};

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function initHostControls() {
  const changeVideoBtn = document.getElementById('change-video-btn');
  const modal = document.getElementById('change-video-modal');
  const closeBtn = document.getElementById('close-change-video-btn');
  const form = document.getElementById('change-video-form');
  const fileInput = document.getElementById('video-file-input');
  const progressContainer = document.getElementById('upload-progress-container');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressPercentage = document.getElementById('upload-percentage');
  const statusText = document.getElementById('upload-status-text');

  if (changeVideoBtn && modal) {
    changeVideoBtn.onclick = () => {
      modal.classList.remove('hidden');
    };
  }

  if (closeBtn && modal) {
    closeBtn.onclick = () => {
      modal.classList.add('hidden');
      if (progressContainer) progressContainer.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
      if (progressPercentage) progressPercentage.textContent = '0%';
      if (statusText) statusText.textContent = 'Click or drag video file here (MP4/WebM, Max 500MB)';
    };
  }

  if (form && modal) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const newUrl = document.getElementById('new-video-url').value.trim();
      if (newUrl && socket) {
        socket.emit('change-video', { videoUrl: newUrl });
        document.getElementById('new-video-url').value = '';
        modal.classList.add('hidden');
      }
    };
  }

  // Handle Local Video File Upload
  if (fileInput) {
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file) return;

      // Update status text with file name
      if (statusText) {
        statusText.textContent = `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
      }

      // Disable inputs during upload
      const textUrlInput = document.getElementById('new-video-url');
      const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
      if (textUrlInput) textUrlInput.disabled = true;
      if (submitBtn) submitBtn.disabled = true;

      // Show progress container
      if (progressContainer) progressContainer.classList.remove('hidden');

      const formData = new FormData();
      formData.append('video', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      // Track Upload Progress
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressPercentage) progressPercentage.textContent = `${percent}%`;
        }
      };

      // Load Success Handler
      xhr.onload = () => {
        // Re-enable inputs
        if (textUrlInput) {
          textUrlInput.disabled = false;
          textUrlInput.value = '';
        }
        if (submitBtn) submitBtn.disabled = false;
        if (progressContainer) progressContainer.classList.add('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (progressPercentage) progressPercentage.textContent = '0%';

        if (xhr.status === 200) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.success && socket) {
              // Emit video changed with the uploaded static file URL path
              socket.emit('change-video', { videoUrl: res.fileUrl });
              modal.classList.add('hidden');
            } else {
              alert("Upload failed: " + (res.error || "Unknown error"));
            }
          } catch(err) {
            alert("Failed to parse server response.");
          }
        } else {
          alert(`Upload failed with status: ${xhr.status}`);
        }
        
        fileInput.value = '';
        if (statusText) statusText.textContent = 'Click or drag video file here (MP4/WebM, Max 500MB)';
      };

      // Error Handlers
      xhr.onerror = () => {
        if (textUrlInput) textUrlInput.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
        if (progressContainer) progressContainer.classList.add('hidden');
        alert("Network error occurred during file upload.");
        fileInput.value = '';
        if (statusText) statusText.textContent = 'Click or drag video file here (MP4/WebM, Max 500MB)';
      };

      // Start the upload request
      xhr.send(formData);
    };
  }
}

function initEmojiControls() {
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.onclick = () => {
      const emoji = btn.getAttribute('data-reaction');
      if (emoji && socket) {
        socket.emit('send-reaction', { reaction: emoji });
      }
    };
  });
}

function triggerFloatingEmoji(emoji) {
  const container = document.getElementById('reactions-overlay');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;

  // Randomize starting horizontal position
  const randomX = Math.floor(Math.random() * 80) + 10;
  el.style.left = `${randomX}%`;

  // Randomize rotation sway
  const randomRot = Math.floor(Math.random() * 60) - 30;
  el.style.setProperty('--random-rotation', `${randomRot}deg`);

  container.appendChild(el);

  // Remove element after animation completes
  el.addEventListener('animationend', () => {
    el.remove();
  });
}

// ==========================================
// PLAYLIST QUEUE COMPONENT FUNCTIONS
// ==========================================
function renderQueueList(queue) {
  const list = document.getElementById('queue-items-list');
  const clearBtn = document.getElementById('clear-queue-btn');
  if (!list) return;

  if (isHost && queue.length > 0) {
    if (clearBtn) clearBtn.classList.remove('hidden');
  } else {
    if (clearBtn) clearBtn.classList.add('hidden');
  }

  if (queue.length === 0) {
    list.innerHTML = `<p class="text-text-muted text-[11px] text-center py-4">No videos in queue.</p>`;
    return;
  }

  list.innerHTML = queue.map(item => {
    const canPlay = isHost;
    const canRemove = isHost || item.addedBy === userId;
    
    let domain = "Link";
    try {
      domain = new URL(item.videoUrl).hostname.replace('www.', '');
    } catch(e) {}

    return `
      <div class="bg-surface-elevated/40 border border-glass-stroke rounded-xl p-2.5 flex flex-col gap-1 text-[11px] hover:border-primary/20 transition-all">
        <div class="font-bold text-on-surface line-clamp-1">${escapeHTML(item.title || "Video Link")}</div>
        <div class="text-[9px] text-text-muted flex justify-between items-center">
          <span>Added by ${escapeHTML(item.addedByName)} (${domain})</span>
        </div>
        <div class="flex items-center justify-end gap-1.5 mt-1 border-t border-glass-stroke/30 pt-1.5">
          ${canPlay ? `
            <button onclick="playQueueItem('${item.id}')" class="text-xs bg-primary/10 border border-primary/20 hover:bg-primary/25 text-primary px-2 py-0.5 rounded font-bold transition-all flex items-center gap-0.5 cursor-pointer">
              <span class="material-symbols-outlined text-[10px]">play_arrow</span>Play
            </button>
          ` : ''}
          ${canRemove ? `
            <button onclick="removeQueueItem('${item.id}')" class="text-xs bg-error-container/10 border border-error/20 hover:bg-error-container/20 text-error px-2 py-0.5 rounded font-bold transition-all flex items-center gap-0.5 cursor-pointer">
              <span class="material-symbols-outlined text-[10px]">delete</span>Remove
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.playQueueItem = function(itemId) {
  if (socket) socket.emit('play-next-video', { itemId });
};

window.removeQueueItem = function(itemId) {
  if (socket) socket.emit('remove-from-queue', { itemId });
};

function initQueueControls() {
  const form = document.getElementById('add-to-queue-form');
  const clearBtn = document.getElementById('clear-queue-btn');
  
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const urlInput = document.getElementById('queue-url-input');
      const videoUrl = urlInput.value.trim();
      
      if (videoUrl && socket) {
        let parsedTitle = "Playlist Video";
        try {
          const urlObj = new URL(videoUrl);
          if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            parsedTitle = "YouTube Video";
            const vidId = urlObj.searchParams.get('v');
            if (vidId) parsedTitle += ` (${vidId})`;
          } else if (urlObj.hostname.includes('vimeo.com')) {
            parsedTitle = "Vimeo Video";
          } else if (urlObj.hostname.includes('twitch.tv')) {
            parsedTitle = "Twitch Stream";
          } else {
            const basename = urlObj.pathname.split('/').pop();
            if (basename) parsedTitle = basename;
          }
        } catch(e) {}

        socket.emit('add-to-queue', { videoUrl, title: parsedTitle });
        urlInput.value = '';
      }
    };
  }

  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm("Clear all items in the playlist queue?")) {
        socket.emit('clear-queue');
      }
    };
  }
}

// ==========================================
// WEBRTC CALL COMPONENT FUNCTIONS
// ==========================================
const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function joinCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    videoEnabled = true;
  } catch (err) {
    console.warn("Camera and mic failed, attempting audio only:", err);
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      videoEnabled = false;
    } catch(audioErr) {
      alert("Could not access microphone or camera. Voice chat is unavailable.");
      return;
    }
  }

  inCall = true;
  
  // UI States
  const joinBtn = document.getElementById('webrtc-join-btn');
  joinBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">call_end</span> Leave Call`;
  joinBtn.classList.remove('bg-secondary/10', 'text-secondary');
  joinBtn.classList.add('bg-error/15', 'text-error', 'border-error/30');

  document.getElementById('webrtc-mute-btn').classList.remove('hidden');
  if (videoEnabled) {
    document.getElementById('webrtc-video-btn').classList.remove('hidden');
  }
  document.getElementById('webrtc-streams-container').classList.remove('hidden');

  renderLocalStream();

  // Send join-call event to signal other clients
  socket.emit('join-call');
}

function leaveCall() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  inCall = false;

  // Terminate all peer connection objects
  Object.keys(peers).forEach(sid => {
    if (peers[sid]) {
      peers[sid].close();
      delete peers[sid];
    }
    const el = document.getElementById(`peer-container-${sid}`);
    if (el) el.remove();
  });

  const joinBtn = document.getElementById('webrtc-join-btn');
  joinBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">call</span> Join Call`;
  joinBtn.classList.add('bg-secondary/10', 'text-secondary');
  joinBtn.classList.remove('bg-error/15', 'text-error', 'border-error/30');

  document.getElementById('webrtc-mute-btn').classList.add('hidden');
  document.getElementById('webrtc-video-btn').classList.add('hidden');
  document.getElementById('webrtc-streams-container').classList.add('hidden');
  document.getElementById('webrtc-streams-container').innerHTML = '';

  socket.emit('leave-call');
}

function renderLocalStream() {
  const container = document.getElementById('webrtc-streams-container');
  let localBox = document.getElementById('local-stream-container');
  
  if (!localBox) {
    localBox = document.createElement('div');
    localBox.id = 'local-stream-container';
    localBox.className = 'relative aspect-video bg-black/40 rounded-2xl overflow-hidden border border-primary/40';
    container.appendChild(localBox);
  }

  localBox.innerHTML = `
    <video id="local-video" class="w-full h-full object-cover scale-x-[-1]" autoplay muted playsinline></video>
    <div class="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-bold">Me</div>
  `;

  const videoEl = document.getElementById('local-video');
  if (videoEl && localStream) {
    videoEl.srcObject = localStream;
  }
}

function createPeerConnection(targetSocketId) {
  const pc = new RTCPeerConnection(rtcConfig);
  peers[targetSocketId] = pc;

  // Add tracks
  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }

  pc.onicecandidate = (event) => {
    if (event.candidate && socket) {
      socket.emit('webrtc-candidate', {
        targetSocketId,
        candidate: event.candidate
      });
    }
  };

  const remoteStream = new MediaStream();
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
    renderRemoteStream(targetSocketId, remoteStream);
  };

  return pc;
}

function renderRemoteStream(socketId, stream) {
  const container = document.getElementById('webrtc-streams-container');
  let peerBox = document.getElementById(`peer-container-${socketId}`);

  if (!peerBox) {
    peerBox = document.createElement('div');
    peerBox.id = `peer-container-${socketId}`;
    peerBox.className = 'relative aspect-video bg-black/40 rounded-2xl overflow-hidden border border-glass-stroke';
    container.appendChild(peerBox);
  }

  peerBox.innerHTML = `
    <video id="peer-video-${socketId}" class="w-full h-full object-cover" autoplay playsinline></video>
    <div class="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-bold">User</div>
  `;

  const videoEl = document.getElementById(`peer-video-${socketId}`);
  if (videoEl) {
    videoEl.srcObject = stream;
  }
}

function initWebRTCHandlers() {
  const joinBtn = document.getElementById('webrtc-join-btn');
  const muteBtn = document.getElementById('webrtc-mute-btn');
  const videoBtn = document.getElementById('webrtc-video-btn');

  if (joinBtn) {
    joinBtn.onclick = () => {
      if (inCall) {
        leaveCall();
      } else {
        joinCall();
      }
    };
  }

  if (muteBtn) {
    muteBtn.onclick = () => {
      if (localStream) {
        micEnabled = !micEnabled;
        localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);
        muteBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">${micEnabled ? 'mic' : 'mic_off'}</span>`;
        muteBtn.classList.toggle('text-error', !micEnabled);
      }
    };
  }

  if (videoBtn) {
    videoBtn.onclick = () => {
      if (localStream) {
        videoEnabled = !videoEnabled;
        localStream.getVideoTracks().forEach(track => track.enabled = videoEnabled);
        videoBtn.innerHTML = `<span class="material-symbols-outlined text-[16px]">${videoEnabled ? 'videocam' : 'videocam_off'}</span>`;
        videoBtn.classList.toggle('text-error', !videoEnabled);
      }
    };
  }
}

// Bind chat form submit
document.getElementById('chat-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (text && socket) {
    socket.emit('chat-message', text);
    input.value = '';
  }
});

function initInviteControl() {
  const inviteBtn = document.getElementById('invite-btn');
  if (inviteBtn) {
    inviteBtn.onclick = () => {
      const inviteUrl = window.location.href;
      let textToCopy = `Hey! Join my watch party in Obsidian Nebula: ${inviteUrl}`;
      if (roomPasscode) {
        textToCopy += ` (Passcode: ${roomPasscode})`;
      }
      
      navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = inviteBtn.innerHTML;
        inviteBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">done</span> Copied!`;
        inviteBtn.classList.add('text-green-500', 'bg-green-500/10', 'border-green-500/30');
        inviteBtn.classList.remove('text-secondary', 'bg-secondary/15', 'border-secondary/30');
        
        setTimeout(() => {
          inviteBtn.innerHTML = originalText;
          inviteBtn.classList.remove('text-green-500', 'bg-green-500/10', 'border-green-500/30');
          inviteBtn.classList.add('text-secondary', 'bg-secondary/15', 'border-secondary/30');
        }, 2000);
      }).catch(err => {
        console.error("Failed to copy link:", err);
      });
    };
  }
}

// Run Init
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  roomId = params.get('id');

  if (!roomId) {
    location.href = '/lobby.html';
    return;
  }

  await initSession();
  initEmojiControls();
  initQueueControls();
  initWebRTCHandlers();
  initInviteControl();

  // Fetch room details first
  try {
    const res = await fetch(`/api/rooms/${roomId}`);
    if (!res.ok) {
      alert("Room not found");
      location.href = '/lobby.html';
      return;
    }
    const room = await res.json();
    if (room.isPrivate) {
      // Show passcode modal
      const overlay = document.getElementById('passcode-overlay');
      overlay.classList.remove('hidden');

      const verifyForm = document.getElementById('passcode-verify-form');
      verifyForm.onsubmit = async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('verify-passcode-input');
        const passcodeVal = codeInput.value.trim();
        const errorMsg = document.getElementById('verify-error-msg');

        try {
          const verifyRes = await fetch(`/api/rooms/${roomId}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode: passcodeVal })
          });

          if (verifyRes.ok) {
            roomPasscode = passcodeVal;
            overlay.classList.add('hidden');
            connectSocket();
          } else {
            errorMsg.classList.remove('hidden');
            codeInput.value = '';
          }
        } catch (err) {
          console.error("Verification failed:", err);
          alert("Connection error while verifying passcode.");
        }
      };
    } else {
      connectSocket();
    }
  } catch (err) {
    console.error("Failed to load room info:", err);
    location.href = '/lobby.html';
  }

  // Bind Sidebar Toggle
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.getElementById('room-sidebar');
  const mainContent = document.getElementById('room-main');
  if (toggleBtn && sidebar && mainContent) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-hidden');
      mainContent.classList.toggle('main-expanded');
    });
  }
});
