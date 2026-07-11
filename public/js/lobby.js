let rooms = [];
let activeCategory = 'all';
let sortBy = 'popular';
let userId = null;

// Initialize Session
async function initSession() {
  if (window.auth) {
    if (!auth.user) {
      await auth.init();
    }
    userId = auth.getUserId();
  }
}

// Fetch Rooms from API
async function fetchRooms() {
  try {
    const res = await fetch('/api/rooms');
    rooms = await res.json();
    renderRooms();
    updateLobbyCount();
  } catch (err) {
    console.error("Failed to fetch rooms:", err);
  }
}

// Render Room Cards in Grid
function renderRooms() {
  const grid = document.getElementById('rooms-grid');
  if (!grid) return;

  const searchQuery = document.getElementById('search-input')?.value.toLowerCase() || '';

  // Filter
  let filtered = rooms.filter(room => {
    const matchesCategory = activeCategory === 'all' || room.category === activeCategory;
    const matchesSearch = room.title.toLowerCase().includes(searchQuery) ||
                          room.hostName.toLowerCase().includes(searchQuery) ||
                          room.category.toLowerCase().includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  // Sort
  if (sortBy === 'popular') {
    filtered.sort((a, b) => (b.userCount || 0) - (a.userCount || 0));
  } else if (sortBy === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-on-surface-variant bg-surface-container/30 rounded-3xl p-8 glass-card">
        <span class="material-symbols-outlined text-[48px] text-primary mb-4">search_off</span>
        <p class="font-body-lg mb-2">No watch rooms match your criteria.</p>
        <p class="text-label-md text-text-muted">Try a different search or create your own room to get started!</p>
      </div>
    `;
    return;
  }

  // Predefined cool thumbnails based on category for placeholder look
  const categoryThumbnails = {
    "Movies & TV": "https://lh3.googleusercontent.com/aida-public/AB6AXuC3gbnEZOXeDBcFfrjuEEIIZ_HdgfCSmUCd6TECK1YT9lPTl5_3vzMSm66kJq5Oky1kpN0ofMsfRrrBzUbN7mgmj3T4miIMjY_CC7WdsatG4uKF83AeYnIqjH068OsexBSCyO_v5ArzpAWkX2nI526HPcN1VTGDhUWyZmmkEj-v2PdVUQ24LmXq_SGUgmfP2L8dZnKDJAiVv4-9etorpKmzzBDW9s14Y0Lt8dCNHF-DHaYb2SOzmUU6oSehoTpyF-zTPJGy0hanCKk",
    "Gaming": "https://lh3.googleusercontent.com/aida-public/AB6AXuDzfLfYGD-eJ9aH04haBWKFfMYg33dqp3gM6G6hwXGlt3hh0Zjbki9aR7N4bGX7aWupHna6-CSI41BUzplg-dTW5KeZZxlzDRfTSt0doq8S9hgn0vIJ9Y8NbTiGn0CC-XFz6EyLZ1n6grBbEkWsGM5nEnHmk5-R7-soQihoKuE58JqWsYqnbEmEl4Y8UqOmyi2pSXa_LoFYiiHeJFlyAkUJEdjcoAsY_tyhyelGCY0AN23msBs0iF0-L4Vj9oHIH01iRW7Hnz2zGtU",
    "Music": "https://lh3.googleusercontent.com/aida-public/AB6AXuAlkrRh4vkBbXf4C2g3V0Ff3LTyytk7J0aH64XjJn7ygD33nxxPzHozMukdniOYyYlycHRHxuw3Ik5uBdjlwj2X2Vqb6-qq0WhzkYgeP7FpiED9nonEq-duiwd4JlI3sRcac3OH22Yq9nK7Xd1ID2C9w31FahCbJ78_VBs-JhmwbIeOOjl1D3iKQgkRRfIgEuWWyaAtGNE-0_qT9Fiwc43KV4D19fT1iVCD8S6awn3qaVL7km3-zZzUsRrG23V4RXXmPYpJawX8WLs",
    "Education": "https://lh3.googleusercontent.com/aida-public/AB6AXuCIFr_7kRx19fihsXb2rBaTT977nZA5YHok3j7LeXBxTsl3lggVvspx21qnJ7-8Jn97O0LwLRH9rUg7q-o9TRXqjOLc4eGk_1Na78UlfCjqd6njOnxcmObW146KM_euAJUMDV82cNRYWImuEFeFqzaHP8WPZ3UBgK_vxTItASFZStN9ioTT2zTwWj2GUKgc3U6Oxqdtuc_-qwBCQ7h3aXc2QjnUhUNjn2XAEGFy2Rj5Gmifj8d4MmK2_mGhhqv0ggNrW99yvzO62tk"
  };

  const defaultThumb = "https://lh3.googleusercontent.com/aida-public/AB6AXuCbipjTAKSdgsy_MdvI4PCBcNaXLDiyPemMxzM1aeWlVQmTcB8urMrkqL6O5lxEd5Rti8dr9fDhAXfowqvKZ13Iw0i2eiSwxrQ9lbGrVF74sIISMnOWq8NcHd2PEOsmwPFz-xjs9YsFKUCBS7uaZQXwXc1ga3qiFUOrWn-6YLttJwY-SapxKr8rXIJDv1RSScVjibqbIMelTeBNKE2gvKBy-krearn4wpYmtnjEKeXYDxuAHGfsI3MKl8Uwfap3n9qckfY-Y1RO15c";

  grid.innerHTML = filtered.map(room => {
    const thumb = categoryThumbnails[room.category] || defaultThumb;
    const isLive = room.userCount > 0 || room.id === 'featured-interstellar';
    return `
      <div class="room-card glass-panel rounded-2xl overflow-hidden flex flex-col group transition-all duration-300 border border-glass-stroke hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
        <div class="relative aspect-video overflow-hidden border-b border-glass-stroke">
          <img class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src="${thumb}" alt="${room.title}">
          <div class="absolute top-3 left-3 flex gap-2">
            <span class="bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">${room.category}</span>
            ${isLive ? `<span class="bg-primary/80 backdrop-blur-md text-on-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">Live</span>` : ''}
            ${room.isPrivate ? `<span class="bg-error/80 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">lock</span>Private</span>` : ''}
          </div>
          <div class="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full flex items-center gap-1.5 font-label-sm text-label-sm">
            <span class="material-symbols-outlined text-[16px] fill-current">group</span> ${room.userCount || 0} online
          </div>
        </div>
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <h4 class="font-title-md text-title-md text-text-primary mb-1 group-hover:text-primary transition-colors font-bold truncate">${room.title}</h4>
            <p class="font-body-md text-body-md text-on-surface-variant mb-4 flex items-center gap-2">
              <span class="font-label-sm text-label-sm text-text-muted">hosted by <span class="text-secondary font-bold">${room.hostName}</span></span>
            </p>
          </div>
          <div class="flex items-center justify-between border-t border-glass-stroke pt-4 mt-2">
            <span class="text-text-muted font-label-sm text-[10px] uppercase">${new Date(room.createdAt).toLocaleDateString()}</span>
            <button onclick="location.href='/room.html?id=${room.id}'" class="bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 rounded-lg font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-all">Join Room</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Update Active Online Counter
function updateLobbyCount() {
  const counter = document.getElementById('lobby-online-count');
  if (!counter) return;
  const totalCount = rooms.reduce((sum, room) => sum + (room.userCount || 0), 0);
  counter.textContent = `${totalCount + 3} Online Now`; // Add a few mock active users for a live feel
}

// Category Filter Click Event
window.filterCategory = function(category) {
  activeCategory = category;
  
  // Update sidebar active buttons
  const buttons = {
    all: document.getElementById('cat-all'),
    "Movies & TV": document.getElementById('cat-movies'),
    Gaming: document.getElementById('cat-gaming'),
    Music: document.getElementById('cat-music'),
    Education: document.getElementById('cat-education')
  };

  Object.keys(buttons).forEach(key => {
    const btn = buttons[key];
    if (!btn) return;
    if (key === category) {
      btn.classList.add('bg-secondary-container', 'text-on-secondary-container');
      btn.classList.remove('text-on-surface-variant', 'hover:bg-surface-variant', 'hover:text-on-surface');
    } else {
      btn.classList.remove('bg-secondary-container', 'text-on-secondary-container');
      btn.classList.add('text-on-surface-variant', 'hover:bg-surface-variant', 'hover:text-on-surface');
    }
  });

  renderRooms();
};

// Sort Rooms
window.sortRooms = function(sortType) {
  sortBy = sortType;
  
  const popularBtn = document.getElementById('sort-popular');
  const newestBtn = document.getElementById('sort-newest');
  
  if (sortType === 'popular') {
    popularBtn.classList.add('bg-surface-variant', 'text-primary');
    popularBtn.classList.remove('hover:bg-surface-variant/50', 'text-on-surface-variant');
    newestBtn.classList.remove('bg-surface-variant', 'text-primary');
    newestBtn.classList.add('hover:bg-surface-variant/50', 'text-on-surface-variant');
  } else {
    newestBtn.classList.add('bg-surface-variant', 'text-primary');
    newestBtn.classList.remove('hover:bg-surface-variant/50', 'text-on-surface-variant');
    popularBtn.classList.remove('bg-surface-variant', 'text-primary');
    popularBtn.classList.add('hover:bg-surface-variant/50', 'text-on-surface-variant');
  }
  
  renderRooms();
};

// Tags/Search Filter
window.filterSearch = function(tag) {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = tag.replace('#', '');
    renderRooms();
  }
};

// Modal Control Binding
function initModal() {
  const modal = document.getElementById('create-room-modal');
  const form = document.getElementById('create-room-form');
  const closeBtn = document.getElementById('close-modal-btn');
  
  const openButtons = [
    document.getElementById('open-create-room-btn-nav'),
    document.getElementById('open-create-room-btn-side'),
    document.getElementById('open-create-room-btn-mobile')
  ];

  openButtons.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        modal.classList.remove('hidden');
      });
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }

  const privateToggle = document.getElementById('private-toggle');
  const passcodeFieldContainer = document.getElementById('passcode-field-container');
  const passcodeField = document.getElementById('room-passcode');

  if (privateToggle && passcodeFieldContainer) {
    privateToggle.addEventListener('change', () => {
      if (privateToggle.checked) {
        passcodeFieldContainer.classList.remove('hidden');
        passcodeField.setAttribute('required', 'true');
      } else {
        passcodeFieldContainer.classList.add('hidden');
        passcodeField.removeAttribute('required');
        passcodeField.value = '';
      }
    });
  }

  let uploadedFileUrl = '';
  const fileInput = document.getElementById('lobby-video-file-input');
  const progressContainer = document.getElementById('lobby-upload-progress-container');
  const progressBar = document.getElementById('lobby-upload-progress-bar');
  const progressPercentage = document.getElementById('lobby-upload-percentage');
  const statusText = document.getElementById('lobby-upload-status-text');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;

      if (statusText) {
        statusText.textContent = `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
      }

      // Disable inputs
      const urlInput = document.getElementById('video-url');
      const submitBtn = form.querySelector('button[type="submit"]');
      if (urlInput) urlInput.disabled = true;
      if (submitBtn) submitBtn.disabled = true;

      if (progressContainer) progressContainer.classList.remove('hidden');

      const formData = new FormData();
      formData.append('video', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressPercentage) progressPercentage.textContent = `${percent}%`;
        }
      };

      xhr.onload = () => {
        if (progressContainer) progressContainer.classList.add('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (progressPercentage) progressPercentage.textContent = '0%';

        if (xhr.status === 200) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.success) {
              uploadedFileUrl = res.fileUrl;
              if (urlInput) {
                urlInput.value = res.fileUrl;
                urlInput.disabled = true;
              }
              if (statusText) {
                statusText.textContent = `Upload completed: ${file.name}`;
              }
            } else {
              alert("Upload failed: " + (res.error || "Unknown error"));
              if (urlInput) urlInput.disabled = false;
            }
          } catch(err) {
            alert("Failed to parse upload response.");
            if (urlInput) urlInput.disabled = false;
          }
        } else {
          alert(`Upload failed with status: ${xhr.status}`);
          if (urlInput) urlInput.disabled = false;
        }
        if (submitBtn) submitBtn.disabled = false;
      };

      xhr.onerror = () => {
        if (urlInput) urlInput.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
        if (progressContainer) progressContainer.classList.add('hidden');
        alert("Network error occurred during file upload.");
      };

      xhr.send(formData);
    });
  }

  // Handle room creation submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('room-title').value.trim();
      const videoUrlVal = document.getElementById('video-url').value.trim();
      const videoUrl = uploadedFileUrl || videoUrlVal;
      const category = document.getElementById('room-category').value;
      const isPrivate = privateToggle ? privateToggle.checked : false;
      const passcode = isPrivate ? passcodeField.value.trim() : null;

      if (!videoUrl) {
        alert("Please enter a Video URL or upload a video file.");
        return;
      }

      if (!userId) {
        alert("Session error. Please refresh the page.");
        return;
      }

      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId
          },
          body: JSON.stringify({ title, videoUrl, category, passcode })
        });
        
        if (res.ok) {
          const room = await res.json();
          location.href = `/room.html?id=${room.id}`;
        } else {
          const errData = await res.json();
          alert("Error: " + errData.error);
        }
      } catch (err) {
        console.error("Failed to create room:", err);
        alert("Server communication error.");
      }
    });
  }

  // Check query params to auto-open modal
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('create') === 'true') {
    modal.classList.remove('hidden');
  }
}

// Live Search bindings
document.addEventListener('DOMContentLoaded', async () => {
  await initSession();
  await fetchRooms();
  initModal();

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', renderRooms);
  }

  // Sidebar Toggle
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebar = document.getElementById('lobby-sidebar');
  const mainContent = document.getElementById('lobby-main');
  
  if (toggleBtn && sidebar && mainContent) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-hidden');
      mainContent.classList.toggle('main-expanded');
    });
  }
});
