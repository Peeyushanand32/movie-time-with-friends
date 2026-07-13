const AVATARS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD4EI8_vyQW7UERp6LoH-hQHDh8uKCs3uhrq8qn0VzXXoF6-nkVpfiSWqtl6V7ngOuHv4s2nctk4tvMMU9DoVtlEPUqci5nmXeAWxgT28IkXri8R8QmF8EoDMndU5K9Ttnr-IVH0_PJIVARsLym-IA3lZ3aujA_L0LjxZg7DoGt6BolVWHZ3-rns3txN6q-Y2imJPSBXrCKcMxrnW_eNkIVB5Sq_Xld85_vxEfb39NGFPJzJENeYGe3Yxp0w3X2wPBAcmdHQy529Ec",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCoYvXafi5wyc_3ATntE40fEyFXEK3bdne_A2GoJnOHPqT5OZp0C3zLAo6UxUlsjHVlp84CtC6s1T-Dhn2pBSv_3Mw8pI4Hfzh74beiw11oA8c-51pEe7Cu75zJ-Dzptzd4qXGGeB8syc8Wv8Py67cUiD1_bXwEQtkUHfKS_Zp6fzZdVI9AdqtNdNw4h-zn7BDqzj98Cq78MCMkHlOz0sjmD5saYbCqqhfBz1I1uwVzU89r1RrmMxsATdFjh3o0jkOLWnWYNE18IWw",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCOGeDeBt3aCnIDKOg8vGoq1gpXZg-jdWhjCy6oh6lx5hqzkJ3QFPI8TlIYElK5Ohi2PcprkfQywvUd3bj7O1vtCMkEBq8I0u72wr6eHXUs5aWkglqnuIFA03bDzn1aNfrtn529Vejcz4eDwftxMBfw0aI4WtQ933PF3XG2KZ5CdbwIZe_aYXzc_a0sQNRDgPIxvyvTaet-nI8pX-0oQ_gfMNNzeiTrh-GTpAq8YfjfZjIgGJohnmtmkLwg-4scA1RMsFVMMYnovYo",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuASKkMapRyV0Z1JNUyM8NmXNdnacasqJ5cVtews_MczqnK_B5_MJNTGu2tTpJE1NoclBtESr08FR_w9eDKaWS_Pgkv7X-IRfPmeyaSLQT6KvhnMYZ-vE3ACpDAu8-JrgDQUKkfIKLws9kCOTq7RE960u8wfpjZvj2ZQ3i8mmji056_uI-vlM9olN35kZZKf7ngTkff2e_xzIirDYV4X-O_BCltQjBMEXaKKHYqdxTKPgiv0sxpDSVnJF44gTdnU9NPI4Un2m1iMZfc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuARSv-n4QVue6mrjE6_0b4nSTwyfNm3BW2Au-tACtuspQjlwM7loj3ayeUmjEdKoYlmEFo5zOs-ZsYwk7RQuq8mzoNOTZueg-Vxh842EcfPfDZCztnvWW2_qJmDbG_h-t6NcXEQklmBUqTVDx5v_uVjZbEN4oquSTehkHSb-gJRcA0n-SlhfpqACk1X15uaIhd6qh1kK0wYUKvfR576N638Sv5MdrOYptWDb_J-GHxbnB5J5cEcH8zLssdj5EpaBDHq-7GYwNtf5UU",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDFwyNQlnxKAGb6c4LhZlQGO1p9rowO6kkSIhnBqqNd8OiJXN08BhzxI91DqldJt-QJ5vaxYtXHeQwhEW9Da4oMjCL0eXTr_MZjsgQjZ6NI-7rLVI9xOz9S9SEAarNtFA4uISub1qOBt0zRROJy6goQpcmZB0hhUTU7aAYrRUMWosUTrCVvBaEvrfRfCw0-9h67RjXNuNMbjdv8KrMZwWyfXuqbMmupFUkTOOVwBxf3ur9oxVK0fwKZ3yCAWvH5StmApkeYtQHGnHI",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCIgzHlWOlCnL5L2wDfnM1ITcENEYusuxUNny12zmXo82yUuAJN5cXfxVihFNa5WXBTDkLkxRfkrvxdJ9sy8d94OQPInXf3qppHChjI8A0DuEwxBXg_-b5dDlyYzaZ0N_y5yAsGpgFdfHQkWeoItcCo8gHPaXO2BxjrC54YtbtYYgdhk_h3ow55komGN_ZIf7VjCQU8bt9v4_IlreX2Ve0_pVlsv51XD5cnFiYFr6xWbEbF9_zQW6BNWrYmgU_ahmCQyijadzD7NXE",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCfljgZ2mhvuOeaO7C23Hg8yFZ0ar_JxL-0l8xq0L_vRvaVGK3PhL01H6zyb00tEtsN2In77Qfh7HBRNdYxfPVdXgaLyKYLO5olo1Q--0h0xZLe0yvCXUZi335gQwxmcRBnBVcCw2vDki-CTrgLy_hlP5I2yI185Ik5SKvIYQilrxOuYbvlcSPpDjI3iYxTOZx7JYvSIyzCEDlo4vgN8Vij2CvVa25Y3ceja2ezefsBpMT84uptRb_pzJUgaW0i3bGFylO4lTH4yoA",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBm3FHd90wOmqmbKS6SebvwmM6vHN_m_5I2ZrQ0n2vmw1JII0nP4w5TVCZGTWFTZKNSPwKGDeR8FrlNotQaQS-qTFGXs_8QgdexmEXyw4sJxJ0KXsx0hydwRrY7S7b7YoJHtt3P1E-WQlb9x3MtpTyhLwMuSb1nP-pHV9wfaebiqkO6yIXsFqGrW9ti2a0XFmbu436jbJgpNYLvfXUs3YCNcrGgVbs-I3hVyPq5OpU3hHsXZ1uHkMWr42DGN_2N7IKkL8BamSLRolk",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBAJEDlGLfun_Qt-h-pMMETs2wI9IbFOHw9NlTS2qhnE5r_9VNPvVFGqdl4mOpaokBt_dSZaEXuyo9qNo_Gsq9kF0XLd2s-b7NGBHuxQjcQs5gwFptI2ilw3C8-PphOPIDWjrCzzoymIxcSjxTt38KQ0DwQuZtTboI-da8fU5Hr9d0oFfYyhFzzXhPz26pcepXNwGuhUK3WKUuHXFUL_NTriOW2K2sWqfeOZYa7pEgT93HNiMabu9buEvu5cQqmTPMqwFDbAXUM51o",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAqXzSlsB8UYdOm-qKnIkif9GRXhglhOppdD1OgwvvmCK76umnafL32ifkpxi8OL-b4xaDBCqXg5crZcYsvzai3bAVb9_UJhb7WbWHmMK9Shp_eRNBBppeM2uHlXLzvZq1hqatHpHlfLagSSO43YXuNTX2Ijv4Yf0TsIX5XzlXtxfPbtIi4ZU40cQTspaPWjdaVtHAygfg-jzFt2fMc8WrY41e_-RL3FvE7XVWShTP3IQE9VO3uVfxLOK2MOGi6QN5gNCNhnsV3zPo",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCbipjTAKSdgsy_MdvI4PCBcNaXLDiyPemMxzM1aeWlVQmTcB8urMrkqL6O5lxEd5Rti8dr9fDhAXfowqvKZ13Iw0i2eiSwxrQ9lbGrVF74sIISMnOWq8NcHd2PEOsmwPFz-xjs9YsFKUCBS7uaZQXwXc1ga3qiFUOrWn-6YLttJwY-SapxKr8rXIJDv1RSScVjibqbIMelTeBNKE2gvKBy-krearn4wpYmtnjEKeXYDxuAHGfsI3MKl8Uwfap3n9qckfY-Y1RO15c"
];

let userId = null;
let currentUser = null;
let selectedAvatarUrl = "";

async function initProfile() {
  if (window.auth) {
    if (!auth.user) {
      await auth.init();
    }
    currentUser = auth.user;
    userId = auth.getUserId();
    selectedAvatarUrl = currentUser.avatarUrl;
    
    // Update headers and page details
    updateUIProfile();
    renderAvatarPicker();
    fetchUserRooms();
  }
}

function updateUIProfile() {
  const navAvatar = document.getElementById('nav-avatar');
  const bannerAvatar = document.getElementById('profile-banner-avatar');
  const bannerName = document.getElementById('profile-banner-name');
  const inputName = document.getElementById('profile-name');

  if (navAvatar) navAvatar.src = currentUser.avatarUrl;
  if (bannerAvatar) bannerAvatar.src = currentUser.avatarUrl;
  if (bannerName) bannerName.textContent = currentUser.name;
  if (inputName) inputName.value = currentUser.name;

  // Render Subscription Tier & Badges
  const tierBadge = document.getElementById('profile-tier-badge');
  const sidebarTier = document.getElementById('sidebar-tier-name');
  const trialContainer = document.getElementById('trial-time-container');
  const trialTimeRemaining = document.getElementById('trial-time-remaining');
  const trialTimeProgress = document.getElementById('trial-time-progress');
  const subExpiresContainer = document.getElementById('sub-expires-container');
  const subExpiryDays = document.getElementById('sub-expiry-days');

  if (!currentUser) return;

  const tier = currentUser.tier || 'free';

  if (tierBadge) {
    tierBadge.textContent = tier === 'free' ? 'Free Voyager' : `${tier.toUpperCase()} MEMBER`;
    tierBadge.className = `px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
      tier === 'free' ? 'bg-surface-variant text-on-surface-variant border border-glass-stroke' :
      tier === 'premium' ? 'bg-primary/20 text-primary border border-primary/30' :
      'bg-secondary/20 text-secondary border border-secondary/30 neon-border'
    }`;
  }

  if (sidebarTier) {
    sidebarTier.textContent = tier;
    sidebarTier.className = `font-bold uppercase text-xs ${
      tier === 'free' ? 'text-on-surface' :
      tier === 'premium' ? 'text-primary' : 'text-secondary'
    }`;
  }

  if (tier === 'free') {
    if (trialContainer) trialContainer.classList.remove('hidden');
    if (subExpiresContainer) subExpiresContainer.classList.add('hidden');
    
    const accumulated = currentUser.accumulatedTime || 0;
    const remainingMins = Math.max(0, 60 - Math.floor(accumulated / 60));
    if (trialTimeRemaining) trialTimeRemaining.textContent = `${remainingMins}m left`;
    if (trialTimeProgress) {
      const percentage = Math.min(100, (accumulated / 3600) * 100);
      trialTimeProgress.style.width = `${percentage}%`;
    }
  } else {
    if (trialContainer) trialContainer.classList.add('hidden');
    if (subExpiresContainer) subExpiresContainer.classList.remove('hidden');

    if (currentUser.subscriptionExpiresAt) {
      const diffTime = new Date(currentUser.subscriptionExpiresAt) - new Date();
      const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      if (subExpiryDays) subExpiryDays.textContent = `${diffDays} Day${diffDays !== 1 ? 's' : ''}`;
    } else {
      if (subExpiryDays) subExpiryDays.textContent = "Unlimited";
    }
  }
}

function renderAvatarPicker() {
  const pickerGrid = document.getElementById('avatar-picker-grid');
  if (!pickerGrid) return;

  pickerGrid.innerHTML = AVATARS.map((url, index) => {
    const isSelected = url === selectedAvatarUrl;
    return `
      <div onclick="selectAvatar('${url}', ${index})" id="avatar-item-${index}" class="aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 ${isSelected ? 'border-primary neon-border scale-105' : 'border-glass-stroke'} bg-surface-container">
        <img class="w-full h-full object-cover" src="${url}" alt="Avatar option ${index + 1}">
      </div>
    `;
  }).join('');
}

window.selectAvatar = function(url, idx) {
  selectedAvatarUrl = url;
  
  // Highlight clicked item and reset others
  AVATARS.forEach((_, index) => {
    const el = document.getElementById(`avatar-item-${index}`);
    if (el) {
      if (index === idx) {
        el.classList.remove('border-glass-stroke');
        el.classList.add('border-primary', 'neon-border', 'scale-105');
      } else {
        el.classList.add('border-glass-stroke');
        el.classList.remove('border-primary', 'neon-border', 'scale-105');
      }
    }
  });
};

window.scrollToEditor = function() {
  const editor = document.getElementById('profile-editor-section');
  if (editor) {
    editor.scrollIntoView({ behavior: 'smooth' });
  }
};

async function fetchUserRooms() {
  const list = document.getElementById('my-rooms-list');
  if (!list) return;

  try {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    const myRooms = rooms.filter(room => room.hostId === userId);

    if (myRooms.length === 0) {
      list.innerHTML = `
        <div class="col-span-full py-8 text-center text-on-surface-variant glass-card rounded-2xl p-6">
          <p class="font-body-md mb-2">You don't have any active watch rooms.</p>
          <button onclick="location.href='/index.html?create=true'" class="text-primary font-label-md text-label-md hover:underline font-bold">Create a Watch Room now</button>
        </div>
      `;
      return;
    }

    const categoryThumbnails = {
      "Movies & TV": "https://lh3.googleusercontent.com/aida-public/AB6AXuC3gbnEZOXeDBcFfrjuEEIIZ_HdgfCSmUCd6TECK1YT9lPTl5_3vzMSm66kJq5Oky1kpN0ofMsfRrrBzUbN7mgmj3T4miIMjY_CC7WdsatG4uKF83AeYnIqjH068OsexBSCyO_v5ArzpAWkX2nI526HPcN1VTGDhUWyZmmkEj-v2PdVUQ24LmXq_SGUgmfP2L8dZnKDJAiVv4-9etorpKmzzBDW9s14Y0Lt8dCNHF-DHaYb2SOzmUU6oSehoTpyF-zTPJGy0hanCKk",
      "Gaming": "https://lh3.googleusercontent.com/aida-public/AB6AXuDzfLfYGD-eJ9aH04haBWKFfMYg33dqp3gM6G6hwXGlt3hh0Zjbki9aR7N4bGX7aWupHna6-CSI41BUzplg-dTW5KeZZxlzDRfTSt0doq8S9hgn0vIJ9Y8NbTiGn0CC-XFz6EyLZ1n6grBbEkWsGM5nEnHmk5-R7-soQihoKuE58JqWsYqnbEmEl4Y8UqOmyi2pSXa_LoFYiiHeJFlyAkUJEdjcoAsY_tyhyelGCY0AN23msBs0iF0-L4Vj9oHIH01iRW7Hnz2zGtU",
      "Music": "https://lh3.googleusercontent.com/aida-public/AB6AXuAlkrRh4vkBbXf4C2g3V0Ff3LTyytk7J0aH64XjJn7ygD33nxxPzHozMukdniOYyYlycHRHxuw3Ik5uBdjlwj2X2Vqb6-qq0WhzkYgeP7FpiED9nonEq-duiwd4JlI3sRcac3OH22Yq9nK7Xd1ID2C9w31FahCbJ78_VBs-JhmwbIeOOjl1D3iKQgkRRfIgEuWWyaAtGNE-0_qT9Fiwc43KV4D19fT1iVCD8S6awn3qaVL7km3-zZzUsRrG23V4RXXmPYpJawX8WLs",
      "Education": "https://lh3.googleusercontent.com/aida-public/AB6AXuCIFr_7kRx19fihsXb2rBaTT977nZA5YHok3j7LeXBxTsl3lggVvspx21qnJ7-8Jn97O0LwLRH9rUg7q-o9TRXqjOLc4eGk_1Na78UlfCjqd6njOnxcmObW146KM_euAJUMDV82cNRYWImuEFeFqzaHP8WPZ3UBgK_vxTItASFZStN9ioTT2zTwWj2GUKgc3U6Oxqdtuc_-qwBCQ7h3aXc2QjnUhUNjn2XAEGFy2Rj5Gmifj8d4MmK2_mGhhqv0ggNrW99yvzO62tk"
    };

    list.innerHTML = myRooms.map(room => {
      const thumb = categoryThumbnails[room.category] || categoryThumbnails["Movies & TV"];
      return `
        <div onclick="location.href='/room.html?id=${room.id}'" class="bg-surface-elevated rounded-2xl glass-stroke p-4 border border-glass-stroke group cursor-pointer hover:border-primary transition-all flex flex-col justify-between">
          <div>
            <div class="aspect-video rounded-xl mb-4 overflow-hidden relative">
              <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="${thumb}" alt="${room.title}">
              <div class="absolute top-3 right-3 bg-primary/95 text-on-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">Active</div>
            </div>
            <h4 class="font-title-md text-title-md text-on-surface font-bold truncate">${room.title}</h4>
            <p class="text-text-muted font-label-sm text-label-sm mt-1">${room.userCount || 0} participants • ${room.category}</p>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error("Failed to load user rooms:", err);
  }
}

// Bind Submit
document.getElementById('profile-edit-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('profile-name').value.trim();
  
  if (!userId) return;

  try {
    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({ name, avatarUrl: selectedAvatarUrl })
    });

    if (res.ok) {
      currentUser = await res.json();
      localStorage.setItem('userProfile', JSON.stringify(currentUser));
      if (window.auth) {
        auth.user = currentUser;
        auth.updateNavbar();
      }
      updateUIProfile();
      alert("Profile updated successfully!");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const err = await res.json();
      alert("Failed to update profile: " + err.error);
    }
  } catch (err) {
    console.error("Error updating profile:", err);
    alert("Network communication error.");
  }
});

// Run Init
document.addEventListener('DOMContentLoaded', initProfile);
