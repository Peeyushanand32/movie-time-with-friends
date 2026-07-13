// Authentication utility for Movie Partner Watch Party Platform
class AuthManager {
  constructor() {
    this.user = null;
    this.userIdKey = 'userId';
    this.userProfileKey = 'userProfile';
    this.pendingCreateRoom = false;
    this.gsiLoaded = false;
    this.googleClientId = null;
  }

  async init() {
    // Load Google Identity Services SDK dynamically
    if (!document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script');
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.gsiLoaded = true;
        if (document.getElementById('auth-modal') && !document.getElementById('auth-modal').classList.contains('hidden')) {
          this.initGoogleSignIn();
        }
      };
      document.head.appendChild(script);
    } else {
      this.gsiLoaded = true;
    }

    const storedUserId = localStorage.getItem(this.userIdKey);
    const storedProfile = localStorage.getItem(this.userProfileKey);

    if (storedUserId) {
      if (storedProfile) {
        try {
          this.user = JSON.parse(storedProfile);
        } catch (e) {
          this.user = null;
        }
      }
      
      // Sync with server session
      try {
        const res = await fetch(`/api/user/session?userId=${storedUserId}`);
        if (res.ok) {
          this.user = await res.json();
          localStorage.setItem(this.userIdKey, this.user.id);
          localStorage.setItem(this.userProfileKey, JSON.stringify(this.user));
        }
      } catch (err) {
        console.error("Session sync failed:", err);
      }
    } else {
      // Create a temporary guest session
      try {
        const res = await fetch('/api/user/session');
        if (res.ok) {
          this.user = await res.json();
          localStorage.setItem(this.userIdKey, this.user.id);
          localStorage.setItem(this.userProfileKey, JSON.stringify(this.user));
        }
      } catch (err) {
        console.error("Guest session creation failed:", err);
      }
    }

    this.updateNavbar();
    this.startHeartbeat();

    // Redirect to landing page if the user is not registered and is attempting to access a protected page
    const path = window.location.pathname;
    const isLandingPage = path === '/' || path.endsWith('/index.html') || path === '';
    if (!isLandingPage && !this.isRegistered()) {
      window.location.href = '/index.html';
      return;
    }
  }

  isRegistered() {
    return this.user && !!this.user.username;
  }

  navigateToLobby(options = {}) {
    if (this.isRegistered()) {
      let url = '/index.html';
      if (options && options.create) {
        url += '?create=true';
      }
      window.location.href = url;
    } else {
      this.pendingCreateRoom = options.create || false;
      this.showAuthModal('login');
    }
  }

  getUserId() {
    return this.user ? this.user.id : null;
  }

  getUserName() {
    return this.user ? this.user.name : "Guest";
  }

  getAvatarUrl() {
    return this.user ? this.user.avatarUrl : "";
  }

  async signup(username, password, avatarUrl) {
    const storedUserId = this.getUserId();
    const headers = { 'Content-Type': 'application/json' };
    if (storedUserId) {
      headers['x-user-id'] = storedUserId;
    }

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers,
      body: JSON.stringify({ username, password, avatarUrl })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to sign up");
    }

    if (data.success) {
      this.user = data.user;
      localStorage.setItem(this.userIdKey, this.user.id);
      localStorage.setItem(this.userProfileKey, JSON.stringify(this.user));
      this.updateNavbar();
      return this.user;
    }
  }

  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to log in");
    }

    if (data.success) {
      this.user = data.user;
      localStorage.setItem(this.userIdKey, this.user.id);
      localStorage.setItem(this.userProfileKey, JSON.stringify(this.user));
      this.updateNavbar();
      return this.user;
    }
  }

  logout() {
    localStorage.removeItem(this.userIdKey);
    localStorage.removeItem(this.userProfileKey);
    this.user = null;
    window.location.reload();
  }

  updateNavbar() {
    const navAvatar = document.getElementById('nav-avatar');
    if (navAvatar && this.user) {
      navAvatar.src = this.user.avatarUrl;
    }

    // Dynamic login/logout injection in header
    const userControls = document.getElementById('navbar-user-controls');
    if (!userControls) return;

    // Premium status text if applicable
    let badgeHtml = '';
    if (this.user && this.user.tier !== 'free') {
      badgeHtml = `<span onclick="location.href='/subscription.html'" class="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:brightness-110 active:scale-95 transition-all">${this.user.tier}</span>`;
    } else {
      badgeHtml = `<span onclick="location.href='/subscription.html'" class="px-2.5 py-0.5 rounded-full bg-surface-variant text-on-surface-variant border border-glass-stroke text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:text-primary hover:border-primary active:scale-95 transition-all">Trial</span>`;
    }

    if (this.isRegistered()) {
      userControls.innerHTML = `
        <div class="flex items-center gap-4">
          ${badgeHtml}
          <span class="hidden md:inline text-label-md text-on-surface-variant font-medium">Hello, <span class="text-primary font-bold">${this.user.username}</span></span>
          <button onclick="location.href='/subscription.html'" class="hidden sm:inline px-3.5 py-2 text-label-md font-bold text-primary hover:underline transition-all">
            Plans
          </button>
          <button onclick="auth.logout()" class="px-4 py-2 text-label-md font-bold rounded-lg border border-glass-stroke hover:border-error hover:text-error transition-all active:scale-95">
            Logout
          </button>
          <div class="w-9 h-9 rounded-full bg-surface-container-highest overflow-hidden border border-glass-stroke cursor-pointer" onclick="location.href='/profile.html'">
            <img class="w-full h-full object-cover" src="${this.user.avatarUrl}">
          </div>
        </div>
      `;
    } else {
      userControls.innerHTML = `
        <div class="flex items-center gap-2">
          ${badgeHtml}
          <button onclick="auth.showAuthModal('login')" class="px-4 py-2 text-label-md font-bold text-on-surface-variant hover:text-primary transition-all active:scale-95">
            Log In
          </button>
          <button onclick="auth.showAuthModal('signup')" class="bg-primary-container text-on-primary-container font-bold px-4 py-2 rounded-lg hover:brightness-110 active:scale-95 transition-all text-label-md">
            Sign Up
          </button>
          <div class="w-9 h-9 rounded-full bg-surface-container-highest overflow-hidden border border-glass-stroke cursor-pointer" onclick="if(auth.isRegistered()){location.href='/profile.html'}else{auth.showAuthModal('login')}">
            <img class="w-full h-full object-cover" src="${this.user ? this.user.avatarUrl : ''}">
          </div>
        </div>
      `;
    }
  }

  startHeartbeat() {
    this.sendHeartbeat();
    setInterval(() => this.sendHeartbeat(), 30000);
  }

  async sendHeartbeat() {
    const storedUserId = this.getUserId();
    if (!storedUserId) return;
    const isWatching = window.location.pathname.includes('room.html') && 
                       (window.roomPlayer && typeof window.roomPlayer.isPlaying === 'function' && window.roomPlayer.isPlaying());
    try {
      const res = await fetch('/api/user/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': storedUserId
        },
        body: JSON.stringify({ isWatching })
      });
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
        localStorage.setItem(this.userProfileKey, JSON.stringify(this.user));
        this.updateNavbar();
        this.checkGatingStatus(data.isBlocked, data.accumulatedTime);
      }
    } catch (err) {
      console.error("Heartbeat sync failed:", err);
    }
  }

  checkGatingStatus(isBlocked, accumulatedTime) {
    let blockModal = document.getElementById('subscription-block-modal');
    if (isBlocked) {
      if (!blockModal) {
        blockModal = document.createElement('div');
        blockModal.id = 'subscription-block-modal';
        blockModal.className = 'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl px-4 text-center';
        blockModal.innerHTML = `
          <div class="glass-panel w-full max-w-md rounded-3xl p-8 border border-primary/20 shadow-2xl relative space-y-6 bg-surface-container/95">
            <div class="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto animate-pulse">
              <span class="material-symbols-outlined text-[48px]">lock</span>
            </div>
            <h3 class="font-display-lg text-headline-lg text-primary font-bold">1-Hour Trial Completed</h3>
            <p class="text-on-surface-variant font-body-md leading-relaxed">
              Your 1-hour free trial on the **Movie Partner** watch party platform has ended. Subscribe now to unlock full access, private rooms, direct video uploads, and unlimited capacity watch parties!
            </p>
            
            <div class="pt-4 flex flex-col gap-3">
              <button onclick="location.href='/subscription.html'" class="w-full bg-primary text-on-primary font-bold py-4 rounded-xl hover:brightness-110 active:scale-95 transition-all text-title-md cursor-pointer shadow-lg shadow-primary/15">
                View Subscription Plans
              </button>
              <button onclick="auth.logout()" class="w-full bg-surface-variant text-on-surface font-semibold py-3.5 rounded-xl hover:bg-surface-bright transition-colors active:scale-95 text-label-md">
                Logout
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(blockModal);
      } else {
        blockModal.classList.remove('hidden');
      }
    } else {
      if (blockModal) {
        blockModal.classList.add('hidden');
      }
      
      if (this.user && this.user.tier === 'free') {
        const remainingSecs = Math.max(0, 3600 - (accumulatedTime || 0));
        const remainingMins = Math.ceil(remainingSecs / 60);
        this.updateTrialDisplay(remainingMins);
      } else {
        this.removeTrialDisplay();
      }
    }
  }

  updateTrialDisplay(mins) {
    let display = document.getElementById('trial-countdown-badge');
    if (!display) {
      const navbar = document.querySelector('header') || document.querySelector('nav');
      if (navbar) {
        display = document.createElement('div');
        display.id = 'trial-countdown-badge';
        display.className = 'hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-label-sm text-[11px] font-bold mr-2';
        
        const controls = document.getElementById('navbar-user-controls');
        if (controls) {
          controls.parentNode.insertBefore(display, controls);
        } else {
          navbar.appendChild(display);
        }
      }
    }
    if (display) {
      display.classList.remove('hidden');
      display.innerHTML = `<span class="material-symbols-outlined text-[14px]">hourglass_empty</span> Trial: ${mins}m left`;
    }
  }

  removeTrialDisplay() {
    const display = document.getElementById('trial-countdown-badge');
    if (display) {
      display.classList.add('hidden');
    }
  }

  async loginWithGoogle(credential, isDemo = false) {
    const storedUserId = this.getUserId();
    const headers = { 'Content-Type': 'application/json' };
    if (storedUserId) {
      headers['x-user-id'] = storedUserId;
    }

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers,
        body: JSON.stringify({ credential, isDemo })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log in with Google");
      }

      if (data.success) {
        this.user = data.user;
        localStorage.setItem(this.userIdKey, this.user.id);
        localStorage.setItem(this.userProfileKey, JSON.stringify(this.user));
        this.updateNavbar();
        this.hideAuthModal();
        
        if (this.pendingCreateRoom) {
          this.pendingCreateRoom = false;
          window.location.href = '/index.html?create=true';
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      const errorEl = document.getElementById('auth-error-msg');
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
      }
    }
  }

  async initGoogleSignIn() {
    if (!this.googleClientId) {
      try {
        const res = await fetch('/api/auth/google/config');
        if (res.ok) {
          const data = await res.json();
          this.googleClientId = data.clientId;
        }
      } catch (err) {
        console.error("Failed to load Google client config:", err);
      }
    }

    const isRealGoogleAvailable = this.googleClientId && 
                                  !this.googleClientId.startsWith('your-') && 
                                  window.google && 
                                  window.google.accounts;

    const gWrapper = document.getElementById('g-signin-btn-wrapper');
    const mockBtn = document.getElementById('mock-google-btn');

    if (isRealGoogleAvailable) {
      if (gWrapper) {
        gWrapper.style.display = 'block';
        try {
          google.accounts.id.initialize({
            client_id: this.googleClientId,
            callback: async (response) => {
              await this.loginWithGoogle(response.credential, false);
            }
          });
          google.accounts.id.renderButton(
            gWrapper,
            { theme: 'outline', size: 'large', width: '380' }
          );
        } catch (err) {
          console.error("Error rendering Google button:", err);
          gWrapper.style.display = 'none';
          if (mockBtn) mockBtn.classList.remove('hidden');
        }
      }
      if (mockBtn) mockBtn.classList.add('hidden');
    } else {
      if (gWrapper) gWrapper.style.display = 'none';
      if (mockBtn) {
        mockBtn.classList.remove('hidden');
        mockBtn.onclick = async () => {
          const mockHeader = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
          const mockPayload = btoa(JSON.stringify({
            iss: "https://accounts.google.com",
            sub: "google-mock-" + Math.floor(Math.random() * 100000),
            email: "demo-user@gmail.com",
            email_verified: true,
            name: "Demo Movie Partner",
            picture: "https://lh3.googleusercontent.com/a/ACg8ocK_S6Wv3H1z9g=s96-c"
          }));
          const mockCredential = `${mockHeader}.${mockPayload}.mocksignature`;
          await this.loginWithGoogle(mockCredential, true);
        };
      }
    }
  }

  showAuthModal(mode = 'login') {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
      // Dynamically inject the modal HTML into the body if it doesn't exist
      modal = document.createElement('div');
      modal.id = 'auth-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md hidden';
      modal.innerHTML = `
        <div class="glass-panel w-full max-w-md rounded-3xl p-8 border border-glass-stroke shadow-2xl relative mx-4">
          <button onclick="auth.hideAuthModal()" class="material-symbols-outlined absolute top-6 right-6 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">close</button>
          <h3 id="auth-modal-title" class="font-display-lg text-headline-lg text-primary mb-2 font-bold text-center">Join Movie Partner</h3>
          <p id="auth-modal-desc" class="text-text-muted font-body-md mb-6 text-center">Log in or create an account to persist your profile.</p>
          
          <form id="auth-form" class="space-y-4">
            <div>
              <label for="auth-username" class="block font-label-md text-label-md text-on-surface-variant mb-1 font-semibold">Username</label>
              <input type="text" id="auth-username" required placeholder="Enter username" class="w-full bg-surface-deep border border-glass-stroke rounded-xl px-4 py-3 focus:outline-none focus:border-secondary text-on-surface transition-all font-body-md">
            </div>
            <div>
              <label for="auth-password" class="block font-label-md text-label-md text-on-surface-variant mb-1 font-semibold">Password</label>
              <input type="password" id="auth-password" required placeholder="Enter password" class="w-full bg-surface-deep border border-glass-stroke rounded-xl px-4 py-3 focus:outline-none focus:border-secondary text-on-surface transition-all font-body-md">
            </div>
            <div id="auth-error-msg" class="text-error font-label-sm text-label-sm hidden"></div>
            
            <button type="submit" id="auth-submit-btn" class="w-full bg-primary-container text-on-primary-container font-bold py-3.5 rounded-xl hover:brightness-110 active:scale-95 transition-all text-title-md cursor-pointer mt-4">
              Submit
            </button>
          </form>
          
          <div class="relative flex py-4 items-center">
            <div class="flex-grow border-t border-glass-stroke"></div>
            <span class="flex-shrink mx-4 text-on-surface-variant text-label-sm font-medium">or</span>
            <div class="flex-grow border-t border-glass-stroke"></div>
          </div>

          <div id="google-signin-container" class="w-full flex justify-center pb-2">
            <div id="g-signin-btn-wrapper" class="w-full flex justify-center"></div>
            <button type="button" id="mock-google-btn" class="hidden w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-bold py-3 px-4 rounded-xl border border-gray-300 shadow-sm transition-all active:scale-95 text-title-md cursor-pointer">
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
          
          <div class="mt-4 text-center font-body-md text-on-surface-variant">
            <span id="auth-switch-text">Don't have an account?</span>
            <button onclick="auth.switchAuthMode()" id="auth-switch-btn" class="text-primary font-bold hover:underline ml-1">Sign Up</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('auth-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;
        const errorEl = document.getElementById('auth-error-msg');
        errorEl.classList.add('hidden');

        try {
          if (auth.currentMode === 'login') {
            await auth.login(username, password);
          } else {
            await auth.signup(username, password);
          }
          auth.hideAuthModal();
          
          if (auth.pendingCreateRoom) {
            auth.pendingCreateRoom = false;
            window.location.href = '/index.html?create=true';
          } else {
            window.location.reload();
          }
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.classList.remove('hidden');
        }
      });
    }

    this.currentMode = mode;
    this.updateAuthModalUI();
    
    modal.classList.remove('hidden');
    this.initGoogleSignIn();
  }

  hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
  }

  switchAuthMode() {
    this.currentMode = this.currentMode === 'login' ? 'signup' : 'login';
    this.updateAuthModalUI();
  }

  updateAuthModalUI() {
    const title = document.getElementById('auth-modal-title');
    const desc = document.getElementById('auth-modal-desc');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const switchBtn = document.getElementById('auth-switch-btn');
    const errorEl = document.getElementById('auth-error-msg');
    
    if (errorEl) errorEl.classList.add('hidden');

    if (this.currentMode === 'login') {
      if (title) title.textContent = "Log In to Movie Partner";
      if (desc) desc.textContent = "Welcome back! Log in to access your profile and rooms.";
      if (submitBtn) submitBtn.textContent = "Log In";
      if (switchText) switchText.textContent = "Don't have an account?";
      if (switchBtn) switchBtn.textContent = "Sign Up";
    } else {
      if (title) title.textContent = "Create Account";
      if (desc) desc.textContent = "Join the Movie Partner watch party platform today.";
      if (submitBtn) submitBtn.textContent = "Create Account";
      if (switchText) switchText.textContent = "Already have an account?";
      if (switchBtn) switchBtn.textContent = "Log In";
    }
  }
}

const auth = new AuthManager();
window.auth = auth;

document.addEventListener('DOMContentLoaded', () => auth.init());
