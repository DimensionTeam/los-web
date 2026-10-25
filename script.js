// Coded by: Maksieku
// Designed by: me
// Motion Videos: yet again, me (maksieku)
const root = document.documentElement;
root.classList.add('js');

const topbar = document.querySelector('.topbar');
const panels = [...document.querySelectorAll('.panel')];
const navButtons = document.querySelectorAll('.nav-btn');
const logo = document.querySelector('.logo');
const menuToggle = document.querySelector('.menu-toggle');

const TRANSITION_MS = 900;
const WHEEL_THRESHOLD = 4;
const WHEEL_QUIET_MS = 160;
const SNAP_TOLERANCE = 2;
const DOT_COUNT = 64;
const STAR_COUNT = [90, 150];
const STAR_SPARKLE_SHARE = 0.12;
const BURST_STARS = [10, 22];
const BURST_GLITTER = [14, 30];
const BURST_LIMIT = 320;
const BURST_COLORS = ['#ffffff', '#CFE6FF', '#9FCBFF', '#B9A8FF', '#8FF0FF'];
const NUDGE_FORCE = 1.3;
const NUDGE_SPRING = 0.09;
const NUDGE_DAMPING = 0.8;
const NUDGE_MAX = 9;
const RING_FORCE = 0.45;
const RING_MAX = 4;
const RING_REACH = 45;
const REVEAL_RATIO = 0.25;
const LATE_REVEAL_RATIO = 0.7;
const VIDEO_PRELOAD_MARGIN = '90% 0px';
const START_DELAY_MS = 800;
const SLIDE_MS = 850;
const SLIDE_EASE = 'cubic-bezier(0.7, 0, 0.2, 1)';
const MENU_PRESS_MS = 160;
const LOGO_SWAP_MS = 5000;
const THEME_CLICKS = 3;
const THEME_CLICK_GAP_MS = 600;
const THEME_KEY = 'lunaria-theme';
const JOIN_GLOW_FALLBACK_MS = 900;
const DONATE_LOVE_MS = 2000;
const MAGNET_PULL = 0.25;
const MAGNET_MIN_GAP = 0.6;
const LOVE_CLICKS = 3;
const LOVE_CLICK_GAP_MS = 600;
const LOVE_SHOW_MS = 3000;
const LOVE_PRESS_MS = 160;

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wideLayout = window.matchMedia('(min-width: 901px)');
const noHover = window.matchMedia('(hover: none)');
const keyDirections = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };

let isTransitioning = false;
let gestureHandled = false;
let wheelBuffer = 0;
let lastWheelAt = 0;
let glideId = 0;
let spyFrame = 0;
let resizeTimer;
let logoSwapTimer = 0;
let themeClicks = 0;
let themeClickTimer = 0;
let donateTimer = 0;
let donateOpener = null;
let menuPressTimer = 0;

const skipNextIntro = () => {
  try {
    sessionStorage.setItem('lunaria-skip-intro', '1');
  } catch (error) {}
};

document.querySelectorAll('a[href="team.html"], a[href="faq.html"], a[href="index.html"]').forEach((link) => {
  link.addEventListener('click', skipNextIntro);
});

logo.addEventListener('click', (event) => {
  const home = document.getElementById('introduction');
  if (!home) return;
  event.preventDefault();
  setMenuOpen(false);
  goToPanel(home);
});

logo.addEventListener('click', () => {
  themeClicks += 1;
  clearTimeout(themeClickTimer);

  if (themeClicks < THEME_CLICKS) {
    themeClickTimer = setTimeout(() => {
      themeClicks = 0;
    }, THEME_CLICK_GAP_MS);
    return;
  }

  themeClicks = 0;
  const dark = root.classList.toggle('theme-dark');
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch (error) {}
});

logo.addEventListener('click', () => {
  if (!noHover.matches) return;
  logo.classList.add('is-swapped');
  clearTimeout(logoSwapTimer);
  logoSwapTimer = setTimeout(() => logo.classList.remove('is-swapped'), LOGO_SWAP_MS);
});

document.querySelectorAll('.btn-dots').forEach((container) => {
  for (let i = 0; i < DOT_COUNT; i += 1) {
    const dot = document.createElement('span');
    const duration = 5 + Math.random() * 5;
    dot.className = 'dot';
    dot.style.setProperty('--x', `${(2 + Math.random() * 96).toFixed(1)}%`);
    dot.style.setProperty('--size', `${(1.4 + Math.random() * 1.6).toFixed(2)}px`);
    dot.style.setProperty('--duration', `${duration.toFixed(2)}s`);
    dot.style.setProperty('--delay', `${(-Math.random() * duration).toFixed(2)}s`);
    container.append(dot);
  }
});

const syncTopbarHeight = () => {
  root.style.setProperty('--topbar-h', `${topbar.offsetHeight}px`);
};

new ResizeObserver(syncTopbarHeight).observe(topbar);
syncTopbarHeight();

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const pagingAvailable = () => {
  if (!finePointer.matches || reducedMotion.matches) return false;
  const room = window.innerHeight - topbar.offsetHeight;
  return panels.every((panel) => panel.offsetHeight <= room + 1);
};

const panelStops = () => {
  const offset = topbar.offsetHeight;
  return panels.map((panel) => {
    const margin = parseFloat(getComputedStyle(panel).scrollMarginTop) || 0;
    return panel.getBoundingClientRect().top + window.scrollY - offset - margin;
  });
};

const nearestPanel = (position) => {
  const stops = panelStops();
  const index = stops.reduce((best, stop, i) => (Math.abs(stop - position) < Math.abs(stops[best] - position) ? i : best), 0);
  return panels[index];
};

const stopFor = (direction) => {
  const y = window.scrollY;
  const stops = panelStops();
  return direction > 0
    ? stops.find((stop) => stop > y + SNAP_TOLERANCE)
    : stops.reverse().find((stop) => stop < y - SNAP_TOLERANCE);
};

const navKey = (panel) => panel.dataset.nav || panel.id;

const setActiveNav = (id) => {
  navButtons.forEach((button) => {
    if (button.dataset.target === id) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });
};

const cancelGlide = () => {
  glideId += 1;
  isTransitioning = false;
};

const glideTo = (target) => {
  glideId += 1;
  const id = glideId;
  const start = window.scrollY;
  const distance = target - start;
  setActiveNav(navKey(nearestPanel(target)));
  if (Math.abs(distance) < 1) return;

  const room = window.innerHeight - topbar.offsetHeight;
  const duration = TRANSITION_MS * Math.min(Math.max(Math.abs(distance) / room, 1), 4) ** 0.6;
  const startedAt = performance.now();
  isTransitioning = true;

  const frame = (now) => {
    if (id !== glideId) return;
    const progress = Math.min(Math.max((now - startedAt) / duration, 0), 1);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      isTransitioning = false;
    }
  };

  requestAnimationFrame(frame);
};

const goToPanel = (panel) => {
  const target = panelStops()[panels.indexOf(panel)];
  setActiveNav(navKey(panel));

  if (reducedMotion.matches) {
    window.scrollTo(0, target);
  } else if (finePointer.matches) {
    glideTo(target);
  } else {
    isTransitioning = true;
    window.scrollTo({ top: target, behavior: 'smooth' });
    setTimeout(() => {
      isTransitioning = false;
      setActiveNav(navKey(nearestPanel(window.scrollY)));
    }, 1500);
  }
};

const setMenuOpen = (open) => {
  topbar.classList.toggle('is-menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};

menuToggle.addEventListener('click', () => {
  setMenuOpen(!topbar.classList.contains('is-menu-open'));
  menuToggle.classList.add('is-pressed');
  clearTimeout(menuPressTimer);
  menuPressTimer = setTimeout(() => menuToggle.classList.remove('is-pressed'), MENU_PRESS_MS);
});

document.addEventListener('click', (event) => {
  if (!topbar.contains(event.target)) setMenuOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenuOpen(false);
});

wideLayout.addEventListener('change', () => setMenuOpen(false));

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const panel = document.getElementById(button.dataset.target);
    setMenuOpen(false);
    if (panel) {
      goToPanel(panel);
    } else {
      skipNextIntro();
      window.location.href = `index.html#${button.dataset.target}`;
    }
  });
});

const exploreButton = document.querySelector('.btn-explore');

if (exploreButton) {
  exploreButton.addEventListener('click', (event) => {
    const panel = document.getElementById(exploreButton.getAttribute('href').slice(1));
    if (!panel) return;
    event.preventDefault();
    goToPanel(panel);
  });
}

const magnetButtons = [...document.querySelectorAll('.hero-actions .btn, .download-actions .btn, .team-join')];

const restRect = (element) => {
  const rect = element.getBoundingClientRect();
  const shift = new DOMMatrixReadOnly(getComputedStyle(element).transform);
  const left = rect.left - shift.m41;
  const top = rect.top - shift.m42;
  return { left, top, right: left + rect.width, bottom: top + rect.height, width: rect.width, height: rect.height };
};

const clearPull = (element) => {
  element.classList.remove('is-pulled', 'is-pushed');
  element.style.removeProperty('--pull-x');
  element.style.removeProperty('--pull-y');
};

magnetButtons.forEach((button) => {
  const others = magnetButtons.filter((other) => other !== button && other.parentElement === button.parentElement);
  let isPulled = false;

  const release = () => {
    if (!isPulled) return;
    isPulled = false;
    clearPull(button);
    others.forEach((other) => {
      if (other.classList.contains('is-pushed')) clearPull(other);
    });
    window.removeEventListener('pointermove', follow);
  };

  const pushAway = (other, rest, pullX, pullY) => {
    if (other.classList.contains('is-pulled')) return;
    const otherRest = restRect(other);
    const sameRow = rest.top < otherRest.bottom && otherRest.top < rest.bottom;
    let pushX = 0;
    let pushY = 0;

    if (sameRow) {
      const side = otherRest.left >= rest.left ? 1 : -1;
      const gap = side > 0 ? otherRest.left - rest.right : rest.left - otherRest.right;
      pushX = side * Math.max(0, side * pullX - gap * (1 - MAGNET_MIN_GAP));
    } else {
      const side = otherRest.top >= rest.top ? 1 : -1;
      const gap = side > 0 ? otherRest.top - rest.bottom : rest.top - otherRest.bottom;
      pushY = side * Math.max(0, side * pullY - gap * (1 - MAGNET_MIN_GAP));
    }

    other.classList.add('is-pushed');
    other.style.setProperty('--pull-x', `${pushX.toFixed(1)}px`);
    other.style.setProperty('--pull-y', `${pushY.toFixed(1)}px`);
  };

  const follow = (event) => {
    const rest = restRect(button);
    const x = event.clientX - rest.left;
    const y = event.clientY - rest.top;

    if (x < 0 || y < 0 || x > rest.width || y > rest.height) {
      release();
      return;
    }

    const pullX = (x - rest.width / 2) * MAGNET_PULL;
    const pullY = (y - rest.height / 2) * MAGNET_PULL;
    button.style.setProperty('--pull-x', `${pullX.toFixed(1)}px`);
    button.style.setProperty('--pull-y', `${pullY.toFixed(1)}px`);
    others.forEach((other) => pushAway(other, rest, pullX, pullY));
  };

  button.addEventListener('pointerenter', (event) => {
    if (isPulled || event.pointerType === 'touch' || !finePointer.matches || reducedMotion.matches) return;
    isPulled = true;
    button.classList.remove('is-pushed');
    button.classList.add('is-pulled');
    window.addEventListener('pointermove', follow);
    follow(event);
  });

  window.addEventListener('blur', release);
});

window.addEventListener('scroll', () => {
  if (isTransitioning || spyFrame) return;
  spyFrame = requestAnimationFrame(() => {
    spyFrame = 0;
    setActiveNav(navKey(nearestPanel(window.scrollY)));
  });
}, { passive: true });

setActiveNav(navKey(nearestPanel(window.scrollY)));

const loadVideo = (video) => {
  if (!video.dataset.src) return;
  video.src = video.dataset.src;
  video.removeAttribute('data-src');
};

const playVideo = (video) => {
  loadVideo(video);
  Promise.resolve(video.play()).catch(() => {});
};

const lazyVideoObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('video[data-src]').forEach(loadVideo);
    observer.unobserve(entry.target);
  });
}, { rootMargin: VIDEO_PRELOAD_MARGIN });

panels.forEach((panel) => {
  if (panel.querySelector('video[data-src]')) lazyVideoObserver.observe(panel);
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const section = entry.target;
    const video = section.querySelector('[data-reveal-video]');

    const ratio = Number(section.dataset.revealRatio) || REVEAL_RATIO;

    if (entry.intersectionRatio >= ratio && !section.classList.contains('is-visible')) {
      section.classList.add('is-visible');
      section.dispatchEvent(new Event('reveal-enter'));
      if (video) {
        video.currentTime = 0;
        playVideo(video);
      }
    } else if (entry.intersectionRatio === 0 && section.classList.contains('is-visible')) {
      section.classList.remove('is-visible');
      section.dispatchEvent(new Event('reveal-exit'));
      if (video) video.pause();
    }
  });
}, {
  rootMargin: `-${topbar.offsetHeight + 2}px 0px -2px 0px`,
  threshold: [0, REVEAL_RATIO, LATE_REVEAL_RATIO],
});

document.querySelectorAll('[data-reveal]').forEach((section) => revealObserver.observe(section));

window.addEventListener('wheel', (event) => {
  if (donateModal.classList.contains('is-open')) {
    event.preventDefault();
    return;
  }
  if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  if (!pagingAvailable()) {
    if (isTransitioning) cancelGlide();
    return;
  }

  const direction = Math.sign(event.deltaY);
  if (!direction || stopFor(direction) === undefined) return;

  event.preventDefault();

  const now = performance.now();
  if (now - lastWheelAt > WHEEL_QUIET_MS) {
    wheelBuffer = 0;
    gestureHandled = false;
  }
  lastWheelAt = now;

  if (isTransitioning || gestureHandled) return;

  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  wheelBuffer += event.deltaY * unit;
  if (Math.abs(wheelBuffer) < WHEEL_THRESHOLD) return;

  gestureHandled = true;
  const target = stopFor(Math.sign(wheelBuffer));
  if (target !== undefined) glideTo(target);
}, { passive: false });

window.addEventListener('keydown', (event) => {
  if (donateModal.classList.contains('is-open')) {
    if (event.key === ' ' || event.key in keyDirections || event.key === 'Home' || event.key === 'End') {
      if (!event.target.closest('a, button')) event.preventDefault();
    }
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest('input, textarea, select, [contenteditable]')) return;

  let direction = keyDirections[event.key];
  if (event.key === ' ' && event.target === document.body) direction = event.shiftKey ? -1 : 1;
  if (!direction) return;

  if (!pagingAvailable()) {
    if (isTransitioning) cancelGlide();
    return;
  }
  if (stopFor(direction) === undefined) return;

  event.preventDefault();
  if (!isTransitioning && !event.repeat) glideTo(stopFor(direction));
});

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!pagingAvailable() || isTransitioning) return;
    const y = window.scrollY;
    const nearest = panelStops().reduce((best, stop) => (Math.abs(stop - y) < Math.abs(best - y) ? stop : best));
    window.scrollTo(0, nearest);
  }, 120);
});

const experience = document.getElementById('experience');

if (experience) {
  const slides = [...experience.querySelectorAll('.carousel-slide')];
  const captions = [...experience.querySelectorAll('.carousel-caption')];
  const pills = [...experience.querySelectorAll('.carousel-pill')];
  const pillsBox = experience.querySelector('.carousel-pills');
  const prevArrow = experience.querySelector('.carousel-prev');
  const nextArrow = experience.querySelector('.carousel-next');

  let slideIndex = 0;
  let startTimer = 0;
  const slideAnimations = [];

  const slideVideo = (slide) => slide.querySelector('video');

  const clearTransitions = () => {
    slideAnimations.splice(0).forEach((animation) => animation.cancel());
    [...slides, ...captions].forEach((element) => element.classList.remove('is-leaving'));
  };

  const transitionSlides = (previous, current, direction) => {
    clearTransitions();
    if (previous === current || reducedMotion.matches) return;

    const shift = direction * -100;
    const captionShift = direction * -28;
    const swaps = [
      {
        outgoing: slides[previous],
        incoming: slides[current],
        outFrames: [{ transform: 'translateX(0)' }, { transform: `translateX(${shift}%)` }],
        inFrames: [{ transform: `translateX(${-shift}%)` }, { transform: 'translateX(0)' }],
        outOptions: { duration: SLIDE_MS, easing: SLIDE_EASE },
        inOptions: { duration: SLIDE_MS, easing: SLIDE_EASE },
      },
      {
        outgoing: captions[previous],
        incoming: captions[current],
        outFrames: [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${captionShift}px)` }],
        inFrames: [{ opacity: 0, transform: `translateX(${-captionShift}px)` }, { opacity: 1, transform: 'translateX(0)' }],
        outOptions: { duration: 350, easing: 'ease-in' },
        inOptions: { duration: 550, delay: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
      },
    ];

    swaps.forEach(({ outgoing, incoming, outFrames, inFrames, outOptions, inOptions }) => {
      outgoing.classList.add('is-leaving');
      const outAnimation = outgoing.animate(outFrames, outOptions);
      const inAnimation = incoming.animate(inFrames, inOptions);
      slideAnimations.push(outAnimation, inAnimation);
      outAnimation.finished.then(() => outgoing.classList.remove('is-leaving')).catch(() => {});
    });
  };

  const showSlide = (index, mode, direction = 1) => {
    const previous = slideIndex;
    slideIndex = (index + slides.length) % slides.length;
    transitionSlides(previous, slideIndex, direction);

    slides.forEach((slide, i) => {
      const active = i === slideIndex;
      const video = slideVideo(slide);
      slide.classList.toggle('is-active', active);
      captions[i].classList.toggle('is-active', active);

      if (active && video) {
        video.currentTime = 0;
        playVideo(video);
      } else if (i === previous && video) {
        setTimeout(() => {
          if (!slide.classList.contains('is-active')) video.pause();
        }, SLIDE_MS + 50);
      }
    });

    pills.forEach((pill, i) => {
      const wasActive = pill.classList.contains('is-active');
      pill.classList.remove('is-active', 'is-leaving', 'is-exiting');

      if (i === slideIndex) {
        void pill.offsetWidth;
        pill.classList.add('is-active');
        pill.setAttribute('aria-current', 'true');
      } else {
        pill.removeAttribute('aria-current');
        if (wasActive && mode === 'complete') pill.classList.add('is-leaving');
        if (wasActive && mode === 'loop') pill.classList.add('is-exiting');
      }
    });
  };

  const resetCarousel = () => {
    clearTimeout(startTimer);
    clearTransitions();
    slideIndex = 0;

    slides.forEach((slide, i) => {
      const video = slideVideo(slide);
      slide.classList.toggle('is-active', i === 0);
      captions[i].classList.toggle('is-active', i === 0);
      if (video) video.pause();
    });

    pills.forEach((pill) => {
      pill.classList.remove('is-active', 'is-leaving', 'is-exiting');
      pill.removeAttribute('aria-current');
    });
  };

  const nudge = (arrow) => {
    arrow.classList.remove('is-nudging');
    void arrow.offsetWidth;
    arrow.classList.add('is-nudging');
  };

  experience.addEventListener('reveal-enter', () => {
    resetCarousel();
    if (reducedMotion.matches) {
      showSlide(0, 'jump');
    } else {
      startTimer = setTimeout(() => showSlide(0, 'jump'), START_DELAY_MS);
    }
  });

  experience.addEventListener('reveal-exit', resetCarousel);

  pills.forEach((pill, i) => {
    pill.addEventListener('click', () => {
      clearTimeout(startTimer);
      showSlide(i, 'jump', i > slideIndex ? 1 : -1);
    });
  });

  prevArrow.addEventListener('click', () => {
    clearTimeout(startTimer);
    nudge(prevArrow);
    showSlide(slideIndex - 1, 'jump', -1);
  });

  nextArrow.addEventListener('click', () => {
    clearTimeout(startTimer);
    nudge(nextArrow);
    showSlide(slideIndex + 1, 'jump', 1);
  });

  [prevArrow, nextArrow].forEach((arrow) => {
    arrow.addEventListener('animationend', () => arrow.classList.remove('is-nudging'));
  });

  pillsBox.addEventListener('animationend', (event) => {
    if (event.animationName === 'pill-fill') {
      showSlide(slideIndex + 1, slideIndex === slides.length - 1 ? 'loop' : 'complete');
    } else if (event.animationName === 'pill-exit') {
      event.target.closest('.carousel-pill').classList.remove('is-exiting');
    }
  });

  pillsBox.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'opacity') event.target.closest('.carousel-pill').classList.remove('is-leaving');
  });
}

document.querySelectorAll('.feature-media').forEach((media) => {
  const video = media.querySelector('video');

  const start = () => {
    media.classList.add('is-playing');
    playVideo(video);
  };

  const stop = () => {
    media.classList.remove('is-playing');
    video.pause();
  };

  media.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') start();
  });

  media.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') stop();
  });

  media.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'touch') return;
    if (media.classList.contains('is-playing')) {
      stop();
    } else {
      start();
    }
  });

  media.addEventListener('focus', start);
  media.addEventListener('blur', stop);
});

const footerBrand = document.querySelector('.footer-brand');
const footerLogoButton = footerBrand.querySelector('.footer-logo-btn');

let loveClicks = 0;
let loveClickTimer = 0;
let lovePressTimer = 0;

footerLogoButton.addEventListener('click', () => {
  if (footerBrand.classList.contains('is-love')) return;

  footerLogoButton.classList.add('is-pressed');
  clearTimeout(lovePressTimer);
  lovePressTimer = setTimeout(() => footerLogoButton.classList.remove('is-pressed'), LOVE_PRESS_MS);

  loveClicks += 1;
  clearTimeout(loveClickTimer);

  if (loveClicks < LOVE_CLICKS) {
    loveClickTimer = setTimeout(() => {
      loveClicks = 0;
    }, LOVE_CLICK_GAP_MS);
    return;
  }

  loveClicks = 0;
  footerBrand.classList.add('is-love');
  setTimeout(() => footerBrand.classList.remove('is-love'), LOVE_SHOW_MS);
});

const donateModal = document.getElementById('donate-modal');
const donateConfirm = donateModal.querySelector('.donate-confirm');
const donateDismiss = donateModal.querySelector('.donate-dismiss');

const openDonate = (opener) => {
  clearTimeout(donateTimer);
  donateOpener = opener;
  donateConfirm.classList.remove('is-loved');
  donateModal.classList.add('is-open');
  donateModal.setAttribute('aria-hidden', 'false');
  setMenuOpen(false);
  donateConfirm.focus({ preventScroll: true });
};

const closeDonate = () => {
  if (!donateModal.classList.contains('is-open')) return;
  clearTimeout(donateTimer);
  donateModal.classList.remove('is-open');
  donateModal.setAttribute('aria-hidden', 'true');
  if (donateOpener) donateOpener.focus({ preventScroll: true });
  donateOpener = null;
};

document.querySelectorAll('.btn-donate, .social-btn--donate').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    openDonate(button);
  });
});

donateDismiss.addEventListener('click', closeDonate);

donateModal.addEventListener('click', (event) => {
  if (event.target === donateModal) closeDonate();
});

donateConfirm.addEventListener('click', () => {
  clearTimeout(donateTimer);
  donateConfirm.classList.add('is-loved');
  void donateConfirm.offsetWidth;
  requestAnimationFrame(() => {
    setTimeout(() => donateConfirm.classList.remove('is-loved'), 140);
  });
  donateTimer = setTimeout(closeDonate, 140 + DONATE_LOVE_MS);
});

donateModal.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeDonate();
  } else if (event.key === 'Tab') {
    event.preventDefault();
    (document.activeElement === donateConfirm ? donateDismiss : donateConfirm).focus();
  }
});

document.querySelectorAll('video').forEach((video) => {
  const box = video.parentElement;

  const setState = (state) => {
    box.classList.remove('is-loading', 'is-loaded', 'is-failed');
    box.classList.add(state);
  };

  if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
    setState('is-failed');
  } else if (video.readyState >= 2) {
    setState('is-loaded');
  } else {
    setState('is-loading');
  }

  video.addEventListener('loadeddata', () => setState('is-loaded'));
  video.addEventListener('error', () => setState('is-failed'));
});

const teamStars = document.querySelector('.team-stars');

if (teamStars) {
  const scatterStars = () => {
    const count = STAR_COUNT[0] + Math.round(Math.random() * (STAR_COUNT[1] - STAR_COUNT[0]));
    const stars = [];

    for (let i = 0; i < count; i += 1) {
      const star = document.createElement('span');
      const sparkle = Math.random() < STAR_SPARKLE_SHARE;
      const duration = 1.6 + Math.random() * 3.6;
      const size = sparkle ? 4 + Math.random() * 6 : 1 + Math.random() * Math.random() * 2.4;
      star.className = sparkle ? 'star star--sparkle' : 'star';
      star.style.setProperty('--x', `${(Math.random() * 100).toFixed(2)}%`);
      star.style.setProperty('--y', `${(Math.random() * 100).toFixed(2)}%`);
      star.style.setProperty('--size', `${size.toFixed(2)}px`);
      star.style.setProperty('--star-color', BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)]);
      star.style.setProperty('--duration', `${duration.toFixed(2)}s`);
      star.style.setProperty('--delay', `${(-Math.random() * duration).toFixed(2)}s`);
      stars.push(star);
    }

    teamStars.replaceChildren(...stars);
  };

  const teamJoin = teamStars.closest('section').querySelector('.team-join');
  scatterStars();
  if (teamJoin) {
    teamJoin.addEventListener('pointerenter', scatterStars);
    teamJoin.addEventListener('focus', scatterStars);
  }
}

const downloadSection = document.getElementById('download');

if (downloadSection) {
  const burstLayer = document.createElement('div');
  burstLayer.className = 'star-burst';
  burstLayer.setAttribute('aria-hidden', 'true');
  downloadSection.querySelector('.eclipses').after(burstLayer);

  downloadSection.addEventListener('mousedown', (event) => {
    if (event.detail > 1 && !event.target.closest('a, button')) event.preventDefault();
  });

  const boxHit = (element) => (cx, cy, radius) => {
    const box = element.getBoundingClientRect();
    return cx >= box.left - radius && cx <= box.right + radius && cy >= box.top - radius && cy <= box.bottom + radius;
  };

  const ringHit = (element) => {
    const [width, centerX, centerY, radiusX, radiusY] = element.dataset.ring.split(' ').map(Number);
    return (cx, cy, radius) => {
      const box = element.getBoundingClientRect();
      if (!box.width) return false;
      const scale = box.width / width;
      const dx = (cx - box.left) / scale - centerX;
      const dy = (cy - box.top) / scale - centerY;
      const ratio = Math.hypot(dx / radiusX, dy / radiusY);
      if (!ratio) return false;
      const gap = Math.abs(ratio - 1) * (Math.hypot(dx, dy) / ratio);
      return gap <= RING_REACH + radius / scale;
    };
  };

  const nudgeTargets = [
    ...[...downloadSection.querySelectorAll('.download-title, .download-text, .btn-discord, .btn-donate--light')].map((element) => ({
      hit: boxHit(element),
      force: NUDGE_FORCE,
      max: NUDGE_MAX,
      apply: (x, y) => {
        element.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      },
      reset: () => element.style.removeProperty('translate'),
    })),
    ...[...downloadSection.querySelectorAll('.eclipse[data-ring]')].map((element) => ({
      hit: ringHit(element),
      force: RING_FORCE,
      max: RING_MAX,
      apply: (x, y) => {
        element.style.setProperty('--nudge-x', `${x.toFixed(2)}px`);
        element.style.setProperty('--nudge-y', `${y.toFixed(2)}px`);
      },
      reset: () => {
        element.style.removeProperty('--nudge-x');
        element.style.removeProperty('--nudge-y');
      },
    })),
  ].map((target) => ({ ...target, x: 0, y: 0, vx: 0, vy: 0 }));
  const flyingStars = [];
  let nudgeFrame = 0;

  const nudgeStep = () => {
    nudgeFrame = 0;

    for (let i = flyingStars.length - 1; i >= 0; i -= 1) {
      const star = flyingStars[i];
      if (!star.element.isConnected) {
        flyingStars.splice(i, 1);
        continue;
      }

      const rect = star.element.getBoundingClientRect();
      if (!rect.width) continue;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = rect.width / 2;

      nudgeTargets.forEach((target) => {
        if (star.hits.has(target) || !target.hit(cx, cy, radius)) return;
        star.hits.add(target);
        const dx = cx - star.originX;
        const dy = cy - star.originY;
        const length = Math.hypot(dx, dy) || 1;
        target.vx += (dx / length) * target.force;
        target.vy += (dy / length) * target.force;
      });
    }

    let moving = false;

    nudgeTargets.forEach((target) => {
      target.vx = (target.vx - target.x * NUDGE_SPRING) * NUDGE_DAMPING;
      target.vy = (target.vy - target.y * NUDGE_SPRING) * NUDGE_DAMPING;
      target.x = Math.max(-target.max, Math.min(target.max, target.x + target.vx));
      target.y = Math.max(-target.max, Math.min(target.max, target.y + target.vy));

      if (Math.abs(target.x) + Math.abs(target.y) + Math.abs(target.vx) + Math.abs(target.vy) > 0.03) {
        moving = true;
        target.apply(target.x, target.y);
      } else if (target.x || target.y || target.vx || target.vy) {
        target.x = 0;
        target.y = 0;
        target.vx = 0;
        target.vy = 0;
        target.reset();
      }
    });

    if (moving || flyingStars.length) nudgeFrame = requestAnimationFrame(nudgeStep);
  };

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const between = (min, max) => min + Math.random() * (max - min);
  const countBetween = ([min, max]) => Math.round(between(min, max));
  const centered = (dx, dy, scale, rotate = 0) => `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px)) scale(${scale}) rotate(${rotate.toFixed(0)}deg)`;

  const spawn = (className, x, y, size, color) => {
    const element = document.createElement('span');
    element.className = className;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    if (size) {
      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
    }
    if (color) element.style.setProperty('--star-color', color);
    burstLayer.append(element);
    return element;
  };

  const play = (element, frames, options) => {
    element.animate(frames, options).finished.then(() => element.remove(), () => element.remove());
  };

  downloadSection.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || reducedMotion.matches || event.target.closest('a, button')) return;
    if (burstLayer.childElementCount > BURST_LIMIT) return;

    const rect = downloadSection.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    play(spawn('burst-flash', x, y), [
      { transform: centered(0, 0, 0.2), opacity: 1 },
      { transform: centered(0, 0, between(1.1, 1.9)), opacity: 0 },
    ], { duration: between(340, 520), easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });

    play(spawn('burst-ring', x, y), [
      { transform: centered(0, 0, 0.05, between(0, 360)), opacity: 1 },
      { transform: centered(0, 0, between(0.7, 1.4), between(0, 360)), opacity: 0 },
    ], { duration: between(560, 860), easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });

    const starCount = countBetween(BURST_STARS);
    const glitterCount = countBetween(BURST_GLITTER);
    const gravity = between(20, 70);

    for (let i = 0; i < starCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = between(70, 340);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const bend = (Math.random() - 0.5) * 60;
      const spin = (Math.random() - 0.5) * 720;
      const star = spawn('burst-star', x, y, between(4, 20), pick(BURST_COLORS));
      flyingStars.push({ element: star, originX: event.clientX, originY: event.clientY, hits: new Set() });

      play(star, [
        { transform: centered(0, 0, 0.2), opacity: 1 },
        { transform: centered(dx * 0.55 - Math.sin(angle) * bend, dy * 0.55 + Math.cos(angle) * bend, 1.15, spin * 0.5), opacity: 1, offset: 0.32 },
        { transform: centered(dx, dy + gravity, 0.1, spin), opacity: 0 },
      ], { duration: between(550, 1300), delay: between(0, 80), easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
    }

    if (!nudgeFrame) nudgeFrame = requestAnimationFrame(nudgeStep);

    for (let i = 0; i < glitterCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 140;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const glitter = spawn('burst-glitter', x, y, 1.5 + Math.random() * 2.5, pick(BURST_COLORS));

      play(glitter, [
        { transform: centered(0, 0, 0.4), opacity: 0 },
        { transform: centered(dx * 0.6, dy * 0.6, 1), opacity: 1, offset: 0.2 },
        { transform: centered(dx * 0.85, dy * 0.85 + 20, 0.8), opacity: 0.25, offset: 0.55 },
        { transform: centered(dx * 0.95, dy * 0.95 + 35, 1), opacity: 0.9, offset: 0.7 },
        { transform: centered(dx, dy + 55, 0.3), opacity: 0 },
      ], { duration: 1100 + Math.random() * 900, delay: Math.random() * 120, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
    }
  });
}
const faqAsk = document.querySelector('.faq-ask');

if (faqAsk) {
  faqAsk.addEventListener('click', (event) => {
    const target = document.getElementById(faqAsk.getAttribute('href').slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });

    const button = target.querySelector('.team-join');
    if (!button) return;
    let glowed = false;
    const glow = () => {
      if (glowed) return;
      glowed = true;
      window.removeEventListener('scrollend', glow);
      button.classList.remove('is-glowing');
      void button.offsetWidth;
      button.classList.add('is-glowing');
    };
    window.addEventListener('scrollend', glow, { once: true });
    setTimeout(glow, JOIN_GLOW_FALLBACK_MS);
  });

  document.querySelectorAll('.team-join').forEach((button) => {
    button.addEventListener('animationend', (event) => {
      if (event.animationName === 'join-glow') button.classList.remove('is-glowing');
    });
  });
}
