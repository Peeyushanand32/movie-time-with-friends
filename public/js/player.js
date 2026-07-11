// Unified Player Wrapper to abstract different video platforms (YouTube, Vimeo, Twitch, HTML5)

class UnifiedPlayer {
  constructor(containerId, url, options = {}) {
    this.containerId = containerId;
    this.url = url;
    this.options = options; // { isHost: Boolean, onReady: Function, onStateChange: Function }
    this.provider = this.detectProvider(url);
    this.player = null;
    this.playerInstance = null; // Used for Twitch sub-player
    this.lastTime = 0;
    this.playing = false;

    this.init();
  }

  detectProvider(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('vimeo.com')) return 'vimeo';
    if (url.includes('twitch.tv')) return 'twitch';
    return 'html5'; // fallback for direct MP4 links
  }

  loadYouTubeAPI() {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }
      
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previousCallback) previousCallback();
        resolve();
      };
      
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    });
  }

  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.innerHTML = ''; // clear previous contents

    if (this.provider === 'youtube') {
      await this.loadYouTubeAPI();
      this.initYouTube();
    } else if (this.provider === 'vimeo') {
      await this.loadScript('https://player.vimeo.com/api/player.js');
      this.initVimeo();
    } else if (this.provider === 'twitch') {
      await this.loadScript('https://embed.twitch.tv/v1/embed.js');
      this.initTwitch();
    } else {
      this.initHtml5();
    }
  }

  loadScript(src) {
    return new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const tag = document.createElement('script');
      tag.src = src;
      tag.onload = () => resolve();
      document.head.appendChild(tag);
    });
  }

  // YOUTUBE PROVIDER
  initYouTube() {
    const videoId = this.extractYouTubeId(this.url);
    if (!videoId) {
      this.showError("Failed to extract YouTube Video ID.");
      return;
    }

    const targetDiv = document.createElement('div');
    targetDiv.id = 'yt-actual-player';
    targetDiv.className = "w-full h-full";
    document.getElementById(this.containerId).appendChild(targetDiv);

    const createPlayer = () => {
      this.player = new YT.Player('yt-actual-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 1, // Enable controls for everyone to bypass autoplay blocks and allow volume/quality changes
          rel: 0,
          disablekb: 0,
          modestbranding: 1
        },
        events: {
          'onReady': () => {
            if (this.options.onReady) this.options.onReady();
          },
          'onStateChange': (event) => {
            let stateStr = 'paused';
            if (event.data === YT.PlayerState.PLAYING) {
              stateStr = 'playing';
              this.playing = true;
            } else if (event.data === YT.PlayerState.PAUSED) {
              stateStr = 'paused';
              this.playing = false;
            }
            if (this.options.onStateChange) {
              this.options.onStateChange({ type: stateStr, time: this.getCurrentTime() });
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const checkYT = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkYT);
          createPlayer();
        }
      }, 100);
    }
  }

  extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  // VIMEO PROVIDER
  initVimeo() {
    const container = document.getElementById(this.containerId);
    const videoId = this.extractVimeoId(this.url);
    if (!videoId) {
      this.showError("Failed to extract Vimeo Video ID.");
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.src = `https://player.vimeo.com/video/${videoId}?autoplay=0&controls=${this.options.isHost ? 1 : 0}`;
    iframe.className = "w-full h-full border-0";
    iframe.allow = 'autoplay; fullscreen';
    container.appendChild(iframe);

    this.player = new Vimeo.Player(iframe);
    this.player.ready().then(() => {
      this.player.getDuration().then(d => { this.vimeoDuration = d; });
      if (this.options.onReady) this.options.onReady();
    });

    this.player.on('play', () => {
      this.playing = true;
      if (this.options.onStateChange) this.options.onStateChange({ type: 'playing', time: this.getCurrentTime() });
    });

    this.player.on('pause', () => {
      this.playing = false;
      if (this.options.onStateChange) this.options.onStateChange({ type: 'paused', time: this.getCurrentTime() });
    });

    this.player.on('timeupdate', (data) => {
      this.lastTime = data.seconds;
    });
  }

  extractVimeoId(url) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  }

  // TWITCH PROVIDER
  initTwitch() {
    const channel = this.extractTwitchChannel(this.url);
    const targetDiv = document.createElement('div');
    targetDiv.id = 'twitch-actual-player';
    targetDiv.className = "w-full h-full";
    document.getElementById(this.containerId).appendChild(targetDiv);

    this.player = new Twitch.Embed('twitch-actual-player', {
      width: '100%',
      height: '100%',
      channel: channel,
      layout: 'video',
      autoplay: false,
      muted: false,
      controls: this.options.isHost
    });

    this.player.addEventListener(Twitch.Embed.VIDEO_READY, () => {
      this.playerInstance = this.player.getPlayer();
      if (this.options.onReady) this.options.onReady();

      this.playerInstance.addEventListener(Twitch.Player.PLAY, () => {
        this.playing = true;
        if (this.options.onStateChange) this.options.onStateChange({ type: 'playing', time: 0 });
      });

      this.playerInstance.addEventListener(Twitch.Player.PAUSE, () => {
        this.playing = false;
        if (this.options.onStateChange) this.options.onStateChange({ type: 'paused', time: 0 });
      });
    });
  }

  extractTwitchChannel(url) {
    const match = url.match(/twitch\.tv\/([^/?#]+)/);
    return match ? match[1] : 'twitch';
  }

  // HTML5 VIDEO (MP4) PROVIDER
  initHtml5() {
    const video = document.createElement('video');
    video.src = this.url;
    video.className = "w-full h-full object-contain outline-none";
    video.controls = this.options.isHost;
    document.getElementById(this.containerId).appendChild(video);

    this.player = video;

    video.addEventListener('canplay', () => {
      if (this.options.onReady) this.options.onReady();
    }, { once: true });

    video.addEventListener('play', () => {
      this.playing = true;
      if (this.options.onStateChange) this.options.onStateChange({ type: 'playing', time: this.getCurrentTime() });
    });

    video.addEventListener('pause', () => {
      this.playing = false;
      if (this.options.onStateChange) this.options.onStateChange({ type: 'paused', time: this.getCurrentTime() });
    });
  }

  // UNIFIED CONTROLS
  play() {
    try {
      if (this.provider === 'youtube' && this.player.playVideo) this.player.playVideo();
      else if (this.provider === 'vimeo' && this.player.play) this.player.play();
      else if (this.provider === 'twitch' && this.playerInstance) this.playerInstance.play();
      else if (this.provider === 'html5') this.player.play();
    } catch (e) {}
  }

  pause() {
    try {
      if (this.provider === 'youtube' && this.player.pauseVideo) this.player.pauseVideo();
      else if (this.provider === 'vimeo' && this.player.pause) this.player.pause();
      else if (this.provider === 'twitch' && this.playerInstance) this.playerInstance.pause();
      else if (this.provider === 'html5') this.player.pause();
    } catch (e) {}
  }

  seekTo(seconds) {
    try {
      if (this.provider === 'youtube' && this.player.seekTo) this.player.seekTo(seconds, true);
      else if (this.provider === 'vimeo' && this.player.setCurrentTime) this.player.setCurrentTime(seconds);
      else if (this.provider === 'html5') this.player.currentTime = seconds;
    } catch (e) {}
  }

  getCurrentTime() {
    try {
      if (this.provider === 'youtube' && this.player.getCurrentTime) return this.player.getCurrentTime();
      if (this.provider === 'vimeo') return this.lastTime;
      if (this.provider === 'html5') return this.player.currentTime;
    } catch (e) {}
    return 0;
  }

  getDuration() {
    try {
      if (this.provider === 'youtube' && this.player.getDuration) return this.player.getDuration();
      if (this.provider === 'vimeo') return this.vimeoDuration || 0;
      if (this.provider === 'html5') return this.player.duration || 0;
    } catch (e) {}
    return 0;
  }

  isPlaying() {
    return this.playing;
  }

  destroy() {
    try {
      if (this.provider === 'youtube' && this.player && typeof this.player.destroy === 'function') {
        this.player.destroy();
      } else if (this.provider === 'html5' && this.player) {
        this.player.pause();
        this.player.src = "";
        this.player.load();
        this.player.remove();
      }
      this.player = null;
      this.playerInstance = null;
      document.getElementById(this.containerId).innerHTML = '';
    } catch (e) {}
  }

  loadVideo(url) {
    this.destroy();
    this.url = url;
    this.provider = this.detectProvider(url);
    this.init();
  }

  showError(msg) {
    document.getElementById(this.containerId).innerHTML = `
      <div class="flex items-center justify-center h-full text-on-surface-variant text-center p-6">
        <div>
          <span class="material-symbols-outlined text-[48px] text-error mb-2">error</span>
          <p class="font-body-lg">Failed to load video source.</p>
          <p class="font-label-sm text-text-muted">${msg}</p>
        </div>
      </div>
    `;
  }
}
window.UnifiedPlayer = UnifiedPlayer;
