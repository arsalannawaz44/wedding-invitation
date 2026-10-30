/* ===== Petals ===== */
(function createPetals() {
  const container = document.querySelector('.petals');
  for (let i = 0; i < 20; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    petal.style.left = Math.random() * 100 + '%';
    petal.style.animationDuration = 8 + Math.random() * 12 + 's';
    petal.style.animationDelay = Math.random() * 10 + 's';
    container.appendChild(petal);
  }
})();

/* ===== Audio (Web Audio API — no external files) ===== */
const Sound = (function () {
  let ctx = null;
  let musicOn = false;
  let musicTimer = null;
  let masterGain = null;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.25;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, start, dur, type, peak) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak || 0.3, start + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  // A gentle harp/celesta-style arpeggio loop
  const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C major-ish
  function playPhrase() {
    if (!musicOn) return;
    const now = ctx.currentTime;
    const notes = 6;
    for (let i = 0; i < notes; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)];
      tone(f, now + i * 0.32, 1.4, 'sine', 0.12);
      if (i % 2 === 0) tone(f / 2, now + i * 0.32, 1.8, 'triangle', 0.05);
    }
  }

  // White-noise burst — used to synthesize realistic firework booms & crackle
  function noiseBurst(duration, fStart, fEnd, peak, type) {
    ensure();
    const now = ctx.currentTime;
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.setValueAtTime(fStart, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(fEnd, 1), now + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  return {
    chime() {
      ensure();
      const now = ctx.currentTime;
      [659.25, 783.99, 1046.5].forEach((f, i) => tone(f, now + i * 0.08, 1.2, 'sine', 0.25));
    },
    sparkle() {
      ensure();
      const now = ctx.currentTime;
      for (let i = 0; i < 5; i++) tone(880 + Math.random() * 660, now + i * 0.05, 0.4, 'sine', 0.12);
    },
    pop() {
      ensure();
      const now = ctx.currentTime;
      tone(180, now, 0.18, 'square', 0.18);
    },
    // Realistic firework: a low boom followed by scattered crackles
    explosion() {
      ensure();
      noiseBurst(0.55, 550, 45, 0.6, 'lowpass');
      const crackles = 12 + Math.floor(Math.random() * 6);
      for (let i = 0; i < crackles; i++) {
        setTimeout(
          () => noiseBurst(0.04, 4500, 2200, 0.1 + Math.random() * 0.06, 'highpass'),
          110 + i * 32 + Math.random() * 45
        );
      }
    },
    startMusic() {
      ensure();
      musicOn = true;
      playPhrase();
      musicTimer = setInterval(playPhrase, 2000);
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer) clearInterval(musicTimer);
    },
    toggleMusic() {
      if (musicOn) { this.stopMusic(); return false; }
      this.startMusic(); return true;
    },
    isOn() { return musicOn; },
  };
})();

/* Background music — Aaj Sajeya from the start after opening the envelope */
const MUSIC_START_SEC = 0;

const Music = (function () {
  const el = document.getElementById('bg-music');
  const fireworksEl = document.getElementById('fireworks-sfx');
  let started = false;
  let usingFile = false;

  function syncToggleUI() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    const on = isOn();
    btn.classList.toggle('muted', !on);
    btn.classList.toggle('playing', on);
  }

  function pauseAll() {
    if (el) {
      el.pause();
    }
    Sound.stopMusic();
    if (fireworksEl) fireworksEl.pause();
    syncToggleUI();
  }

  function start() {
    if (started) return;
    started = true;
    if (el && el.querySelector('source')) {
      el.volume = 0.55;
      el.currentTime = MUSIC_START_SEC;
      const p = el.play();
      if (p && p.then) {
        p.then(() => { usingFile = true; syncToggleUI(); }).catch(() => { usingFile = false; Sound.startMusic(); syncToggleUI(); });
      } else {
        usingFile = true;
      }
    } else {
      Sound.startMusic();
    }
    syncToggleUI();
  }

  function toggle() {
    if (!started) { start(); return true; }
    if (usingFile && el) {
      if (el.paused) { el.play(); syncToggleUI(); return true; }
      el.pause(); syncToggleUI(); return false;
    }
    const on = Sound.toggleMusic();
    syncToggleUI();
    return on;
  }

  function isOn() {
    return usingFile && el ? !el.paused : Sound.isOn();
  }

  function onPageHidden() {
    pauseAll();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onPageHidden();
  });
  window.addEventListener('pagehide', onPageHidden);
  window.addEventListener('beforeunload', onPageHidden);

  return { start, toggle, isOn, pauseAll };
})();

/* Sound toggle button */
const soundToggle = document.getElementById('sound-toggle');
soundToggle.classList.add('muted');
soundToggle.addEventListener('click', () => {
  const on = Music.toggle();
  soundToggle.classList.toggle('muted', !on);
  soundToggle.classList.toggle('playing', on);
});

/* ===== Envelope Welcome ===== */
const welcome = document.getElementById('welcome');
const env = document.getElementById('env');
const envHint = document.getElementById('env-hint');
const main = document.getElementById('main');
let envOpened = false;
let entered = false;

function startMusicIfNeeded() {
  Music.start();
  soundToggle.classList.remove('muted');
  soundToggle.classList.add('playing');
}

function openEnvelope() {
  if (envOpened || entered) return;
  envOpened = true;
  env.classList.add('open');
  Sound.pop();
  setTimeout(() => Sound.sparkle(), 250);
  startMusicIfNeeded();
  if (envHint) envHint.textContent = '';

  // Offer calendar reminder (Google Calendar on Android, picker for others)
  setTimeout(() => Reminder.promptAfterOpen(), 1200);

  // Let the flaps slide off and reveal the card, then flow into the invitation
  setTimeout(enterInvitation, 3600);
}

let toastTimer = null;
function showReminderToast(title, message, icon) {
  const toast = document.getElementById('reminder-toast');
  const titleEl = document.getElementById('reminder-toast-title');
  const msgEl = document.getElementById('reminder-toast-msg');
  const iconEl = toast && toast.querySelector('.reminder-toast__icon');
  if (!toast) return;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (iconEl) iconEl.textContent = icon || '🔔';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 6000);
}

function enterInvitation() {
  if (entered) return;
  entered = true;
  Sound.chime();
  main.classList.remove('hidden');
  document.getElementById('quick-nav').classList.remove('hidden');
  welcome.classList.add('done');
  initScratchCard();
  setTimeout(() => { welcome.style.display = 'none'; }, 1100);
}

welcome.addEventListener('click', () => {
  if (!envOpened) openEnvelope();
  else if (!entered) enterInvitation();
});

/* ===== Envelope asset preloader ===== */
(function envelopePreloader() {
  const ASSETS = [
    'assets/kraft-paper.png',
    'assets/wax-love.png',
    'assets/gold-corner.png',
    'assets/monogram-ah.jpg',
  ];
  const loader = document.getElementById('env-loader');
  const scene = document.querySelector('.env-scene');
  const envEl = document.getElementById('env');
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    if (envEl) envEl.classList.add('ready');
    if (scene) scene.classList.add('ready');
    if (loader) {
      loader.classList.add('hide');
      setTimeout(() => loader.remove(), 900);
    }
  }

  let loaded = 0;
  ASSETS.forEach((src) => {
    const img = new Image();
    const tick = () => { if (++loaded >= ASSETS.length) finish(); };
    img.onload = tick;
    img.onerror = tick;
    img.src = src;
  });

  setTimeout(finish, 4500);
})();

/* Loader sparkle canvas */
(function loaderSparkles() {
  const canvas = document.getElementById('loader-sparkles');
  const loader = document.getElementById('env-loader');
  if (!canvas || !loader) return;
  const ctx = canvas.getContext('2d');
  const particles = [];
  let rafId = null;

  function size() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  size();

  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random(), y: Math.random(),
      r: 0.5 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.004 + Math.random() * 0.01,
    });
  }

  function loop(now) {
    if (!loader.parentElement) return;
    const w = canvas.width, h = canvas.height;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p) => {
      p.y -= p.speed;
      if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
      const sx = p.x * w + Math.sin(t * 1.5 + p.phase) * 10;
      const sy = p.y * h;
      const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 3 + p.phase));
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * 6);
      grad.addColorStop(0, `rgba(255,228,150,${tw})`);
      grad.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r * 6, 0, Math.PI * 2);
      ctx.fill();
    });
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
  window.addEventListener('resize', size);
})();

/* Floating gold sparkles behind the envelope */
(function welcomeSparkles() {
  const canvas = document.getElementById('welcome-sparkles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let rafId = null;
  const particles = [];

  function size() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  size();

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      rise: 0.006 + Math.random() * 0.014,
      drift: (Math.random() - 0.5) * 0.0006,
    });
  }

  function loop(now) {
    if (welcome.classList.contains('done')) {
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const w = canvas.width, h = canvas.height;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    particles.forEach((p) => {
      p.y -= p.rise * 0.016;
      p.x += p.drift;
      if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      const sx = p.x * w + Math.sin(t + p.phase) * 14;
      const sy = p.y * h;
      const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 2 + p.phase));
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * 5);
      grad.addColorStop(0, `rgba(255,228,150,${tw * 0.9})`);
      grad.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r * 5, 0, Math.PI * 2);
      ctx.fill();
    });
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
  window.addEventListener('resize', size);
})();

/* ===== Add-to-Calendar Reminder ===== */
const Reminder = (function () {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // 16 Jan 2027, gathering 9:00 PM PKT (UTC+5). Reminder alarm at 7:00 PM PKT.
  // PKT->UTC: 21:00 -> 16:00Z, 23:00 -> 18:00Z, 19:00 (alarm) -> 14:00Z
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ammar & Haniya Reception//Invite//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:wedding-ammar-haniya-20270116@wedding.invite',
    'DTSTAMP:20261030T000000Z',
    'DTSTART:20270116T160000Z',
    'DTEND:20270116T180000Z',
    'SUMMARY:Reception — Ammar & Haniya',
    'DESCRIPTION:Reception of Ammar & Haniya.\\nGathering 9:00 PM\\, Dinner 10:00 PM.',
    'LOCATION:Elanora Marquee\\, Block 15 Gulistan-e-Johar\\, Karachi',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reception Reminder — Ammar & Haniya',
    'TRIGGER;VALUE=DATE-TIME:20270116T140000Z',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const modal = document.getElementById('reminder-modal');
  const backdrop = document.getElementById('reminder-modal-backdrop');
  const googleBtn = document.getElementById('reminder-google-btn');
  const icsBtn = document.getElementById('reminder-ics-btn');
  const dismissBtn = document.getElementById('reminder-dismiss');
  const mainBtn = document.getElementById('valima-reminder');
  const hint = document.getElementById('reminder-hint');

  function googleUrl() {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: 'Reception — Ammar & Haniya',
      dates: '20270116T160000Z/20270116T180000Z',
      details: 'Reception of Ammar & Haniya. Gathering 9:00 PM, Dinner 10:00 PM. Reminder: arrive by 7:00 PM.',
      location: 'Elanora Marquee, Block 15 Gulistan-e-Johar, Karachi',
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  function openGoogle() {
    window.open(googleUrl(), 'weddingExternalTab');
    showReminderToast(
      'Opening Google Calendar',
      'Tap Save to add the reception reminder (7:00 PM alert).'
    );
    Sound.sparkle();
    closeModal();
    markButtonDone('✓ Opened in Google Calendar');
  }

  function downloadIcs() {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Reception-Ammar-Haniya.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showReminderToast(
      'Calendar file saved',
      isIOS
        ? 'Open the downloaded file — tap Add to Calendar on your iPhone.'
        : 'Open the .ics file in your calendar app.'
    );
    Sound.sparkle();
    closeModal();
    markButtonDone('✓ Reminder file saved');
  }

  function markButtonDone(label) {
    if (!mainBtn) return;
    const original = mainBtn.innerHTML;
    mainBtn.innerHTML = label;
    mainBtn.classList.add('reminder-btn--done');
    setTimeout(() => {
      mainBtn.innerHTML = original;
      mainBtn.classList.remove('reminder-btn--done');
    }, 4000);
  }

  function openModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function promptAfterOpen() {
    if (isAndroid) {
      openModal();
      return;
    }
    showReminderToast(
      'Don\u2019t miss the reception',
      'Tap the reminder button below to add it to your calendar.'
    );
  }

  function handleMainButton() {
    if (isAndroid) {
      openModal();
      return;
    }
    if (isIOS) {
      openModal();
      return;
    }
    openModal();
  }

  // Tailor labels for the guest's device
  if (hint) {
    hint.textContent = isAndroid
      ? 'Recommended: Google Calendar on Android'
      : isIOS
        ? 'Google Calendar or Apple Calendar (.ics)'
        : 'Google Calendar or download .ics file';
  }
  if (mainBtn && isAndroid) {
    mainBtn.innerHTML = '🔔 Add to Google Calendar — 7:00 PM';
  }

  if (googleBtn) googleBtn.addEventListener('click', openGoogle);
  if (icsBtn) icsBtn.addEventListener('click', downloadIcs);
  if (dismissBtn) dismissBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);
  if (mainBtn) {
    mainBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleMainButton();
    });
  }

  return { openModal, openGoogle, downloadIcs, googleUrl, promptAfterOpen, isAndroid, isIOS };
})();

/* Single-tab guard for all external links (maps, directions, whatsapp) */
(function singleTabLinks() {
  document.querySelectorAll('a[data-external]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const href = a.getAttribute('href');
      // Named target => reuse the same tab instead of spawning a new one each click
      if (href) window.open(href, 'weddingExternalTab');
    });
  });
})();

/* ===== Countdown ===== */
const VALIMA_EVENT = {
  date: new Date('2027-01-16T21:00:00+05:00'),
  label: 'Monday, 16th January 2027',
  ids: { days: 'cd-days-v', hours: 'cd-hours-v', mins: 'cd-mins-v', secs: 'cd-secs-v' },
};

const pad = (n) => String(n).padStart(2, '0');

function updateCountdown() {
  const now = new Date();
  const ev = VALIMA_EVENT;
  const diff = ev.date - now;
  let d = 0, h = 0, m = 0, s = 0;
  if (diff > 0) {
    d = Math.floor(diff / 86400000);
    h = Math.floor((diff / 3600000) % 24);
    m = Math.floor((diff / 60000) % 60);
    s = Math.floor((diff / 1000) % 60);
  }
  document.getElementById(ev.ids.days).textContent = pad(d);
  document.getElementById(ev.ids.hours).textContent = pad(h);
  document.getElementById(ev.ids.mins).textContent = pad(m);
  document.getElementById(ev.ids.secs).textContent = pad(s);
}
updateCountdown();
setInterval(updateCountdown, 1000);

/* ===== Scratch Card ===== */
let scratchInitialized = false;
function initScratchCard() {
  if (scratchInitialized) return;
  scratchInitialized = true;

  const canvas = document.getElementById('scratch-canvas');
  const resetBtn = document.getElementById('scratch-reset');
  const wrapper = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  let revealed = false;

  function drawOverlay() {
    const w = canvas.width, h = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#d4af37');
    grad.addColorStop(0.3, '#f0e6c8');
    grad.addColorStop(0.5, '#c9a84c');
    grad.addColorStop(0.7, '#e8d5a3');
    grad.addColorStop(1, '#b8963e');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(107, 29, 58, 0.15)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#6b1d3a';
    ctx.font = '600 14px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦  SCRATCH HERE  ✦', w / 2, h / 2 - 8);
    ctx.font = '12px Lato, sans-serif';
    ctx.fillStyle = 'rgba(107, 29, 58, 0.7)';
    ctx.fillText('Reveal the blessing', w / 2, h / 2 + 14);
  }

  function resize() {
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    drawOverlay();
  }

  let isDrawing = false;
  const brushRadius = 28;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  }

  function scratch(x, y) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
    ctx.fill();
    checkReveal();
  }

  function checkReveal() {
    if (revealed) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent++;
    if (transparent / (data.length / 4) * 100 > 55) {
      revealed = true;
      canvas.style.transition = 'opacity 0.6s ease';
      canvas.style.opacity = '0';
      canvas.style.pointerEvents = 'none';
      resetBtn.classList.remove('hidden');
      Sound.sparkle();
    }
  }

  canvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(getPos(e).x, getPos(e).y); });
  canvas.addEventListener('mousemove', (e) => { if (isDrawing) scratch(getPos(e).x, getPos(e).y); });
  canvas.addEventListener('mouseup', () => { isDrawing = false; });
  canvas.addEventListener('mouseleave', () => { isDrawing = false; });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isDrawing = true; scratch(getPos(e).x, getPos(e).y); });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (isDrawing) scratch(getPos(e).x, getPos(e).y); });
  canvas.addEventListener('touchend', () => { isDrawing = false; });

  resetBtn.addEventListener('click', () => {
    revealed = false;
    canvas.style.transition = 'none';
    canvas.style.opacity = '1';
    canvas.style.pointerEvents = 'auto';
    drawOverlay();
    resetBtn.classList.add('hidden');
  });

  resize();
  window.addEventListener('resize', resize);
}

/* ===== Scroll reveal for cards & sections ===== */
const cardObserver = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.style.animationPlayState = 'running'; }),
  { threshold: 0.15 }
);
document.querySelectorAll('.invite-card').forEach((card) => {
  card.style.animationPlayState = 'paused';
  cardObserver.observe(card);
});

const revealObserver = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      revealObserver.unobserve(e.target);
    }
  }),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

/* ===== Personalised guest name (?to=Ali%20Raza) ===== */
const guestName = (function () {
  const raw = new URLSearchParams(window.location.search).get('to');
  const name = raw ? raw.trim().slice(0, 60) : '';
  if (!name) return '';
  document.querySelectorAll('.guest-name').forEach((el) => {
    el.classList.remove('hidden');
    if (el.classList.contains('hero__guest')) {
      el.textContent = 'Dear ';
      const strong = document.createElement('strong');
      strong.textContent = name;
      el.appendChild(strong);
    } else {
      el.textContent = 'Dear ' + name;
    }
  });
  const rsvpName = document.getElementById('rsvp-name');
  if (rsvpName) rsvpName.value = name;
  return name;
})();

/* ===== RSVP via WhatsApp ===== */
(function rsvp() {
  const RSVP_NUMBER = '923171119548';
  const form = document.getElementById('rsvp-form');
  if (!form) return;
  const nameInput = document.getElementById('rsvp-name');
  const guestsField = document.getElementById('rsvp-guests-field');
  const guestsSelect = document.getElementById('rsvp-guests');
  const messageInput = document.getElementById('rsvp-message');
  const error = document.getElementById('rsvp-error');

  form.querySelectorAll('input[name="attending"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      guestsField.classList.toggle('hidden', form.attending.value !== 'yes');
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      error.classList.remove('hidden');
      nameInput.focus();
      return;
    }
    error.classList.add('hidden');

    const attending = form.attending.value === 'yes';
    const guests = guestsSelect.options[guestsSelect.selectedIndex].text;
    const lines = [
      'Assalam-o-Alaikum! RSVP for the Reception of Ammar & Haniya (16 Jan 2027):',
      '',
      'Name: ' + name,
      attending ? 'Attending: Yes, InshaAllah' : 'Attending: Sorry, we can\u2019t make it',
    ];
    if (attending) lines.push('Guests: ' + guests);
    const message = messageInput.value.trim();
    if (message) lines.push('', 'Wishes: ' + message);

    const url = 'https://wa.me/' + RSVP_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
    window.open(url, 'weddingExternalTab');
    Sound.sparkle();
    showReminderToast('Opening WhatsApp', 'Tap send to deliver your RSVP. Thank you!', '💌');
  });
})();

/* ===== Share invitation ===== */
(function share() {
  const shareUrl = window.location.origin + window.location.pathname;
  const shareText = 'You\u2019re invited to the Reception of Ammar & Haniya — Monday, 16 January 2027, Elanora Marquee, Karachi.';

  async function doShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ammar & Haniya — Reception', text: shareText, url: shareUrl });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText + '\n' + shareUrl), 'weddingExternalTab');
  }

  document.querySelectorAll('[data-share]').forEach((btn) => btn.addEventListener('click', doShare));
})();

/* ===== Copy venue address ===== */
(function copyAddress() {
  const btn = document.getElementById('copy-address');
  if (!btn) return;
  const address = 'Elanora Marquee, W4GG+4CJ, Block 15 Gulistan-e-Johar, Karachi, Pakistan';
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(address);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    btn.textContent = '✓ Copied';
    showReminderToast('Address copied', 'Paste it into Careem, Uber or Maps.', '📍');
    setTimeout(() => { btn.textContent = 'Copy address'; }, 2500);
  });
})();

/* ===== Quick nav: highlight current section ===== */
(function quickNav() {
  const links = document.querySelectorAll('.quick-nav a');
  const sections = [...links].map((a) => document.querySelector(a.getAttribute('href')));
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }),
    { rootMargin: '-45% 0px -45% 0px' }
  );
  sections.forEach((s) => s && observer.observe(s));
})();

/* ===== Fireworks Finale ===== */
const fireworks = (function () {
  const canvas = document.getElementById('fireworks');
  const sfx = document.getElementById('fireworks-sfx');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let running = false;
  let rafId = null;
  let autoTimer = null;

  const COLORS = ['#c9a84c', '#f5eccf', '#d4848a', '#f5d5d0', '#ffffff', '#e8d5a3'];

  function size() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function burst(x, y) {
    const count = 60 + Math.floor(Math.random() * 40);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 1 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        color,
        size: 1 + Math.random() * 2,
      });
    }
  }

  function playSfx() {
    if (!sfx) return;
    sfx.volume = 0.3; // kept below the main song (0.55)
    sfx.currentTime = 0;
    sfx.play().catch(() => Sound.explosion());
  }

  function loop() {
    ctx.fillStyle = 'rgba(58, 14, 31, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.vx *= 0.99;
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    particles = particles.filter((p) => p.life > 0);
    if (particles.length > 0 || running) {
      rafId = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafId);
      rafId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function show(duration) {
    size();
    running = true;
    playSfx();
    if (!rafId) loop();
    let shots = 0;
    const maxShots = 8;
    const interval = setInterval(() => {
      burst(
        canvas.width * (0.15 + Math.random() * 0.7),
        canvas.height * (0.15 + Math.random() * 0.5)
      );
      shots++;
      if (shots >= maxShots) {
        clearInterval(interval);
        running = false;
      }
    }, 450);
  }

  return { show, size };
})();

/* Trigger fireworks when footer scrolls into view (once) + button */
const finale = document.getElementById('finale');
const celebrateBtn = document.getElementById('celebrate-btn');
let finaleFired = false;

const finaleObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && !finaleFired) {
        finaleFired = true;
        fireworks.show();
      }
    });
  },
  { threshold: 0.4 }
);
finaleObserver.observe(finale);

celebrateBtn.addEventListener('click', () => {
  startMusicIfNeeded();
  fireworks.show();
});

window.addEventListener('resize', () => fireworks.size());
