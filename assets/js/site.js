(() => {
  const html = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const lerp = (start, end, factor) => start + (end - start) * factor;

  /* ---------- Smooth scrolling (desktop wheel only; touch stays native) ---------- */
  let lenis = null;
  if (window.Lenis && !reducedMotion.matches) {
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    const lenisRaf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(lenisRaf);
    };
    requestAnimationFrame(lenisRaf);
  }

  // In-page links: glide there, then move focus so keyboard and screen reader users land in the right place.
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey) return;
    const id = link.getAttribute("href").slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    event.preventDefault();
    if (lenis) {
      lenis.start();
      lenis.scrollTo(id === "top" ? 0 : target, { duration: 1.4 });
    } else {
      target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
    }
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    history.replaceState(null, "", `#${id}`);
  });

  /* ---------- Theme ---------- */
  const readTheme = () => {
    try { return localStorage.getItem("theme"); } catch (_) { return null; }
  };
  const storeTheme = (theme) => {
    try { localStorage.setItem("theme", theme); } catch (_) { /* storage blocked */ }
  };

  const themeToggle = document.getElementById("theme-toggle");
  const syncThemeControl = () => {
    if (!themeToggle) return;
    const dark = html.classList.contains("dark");
    themeToggle.setAttribute("aria-pressed", String(dark));
    themeToggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };
  const applyTheme = (dark, persist = false) => {
    html.classList.toggle("dark", dark);
    if (persist) storeTheme(dark ? "dark" : "light");
    syncThemeControl();
  };
  syncThemeControl();

  themeToggle?.addEventListener("click", () => {
    const next = !html.classList.contains("dark");
    if (!document.startViewTransition || reducedMotion.matches) {
      applyTheme(next, true);
      return;
    }
    // Reveal the new theme as a circle growing out of the toggle.
    const rect = themeToggle.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => applyTheme(next, true));
    transition.ready.then(() => {
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: "cubic-bezier(0.77, 0, 0.18, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => {});
  });

  systemDark.addEventListener("change", (event) => {
    if (!readTheme()) applyTheme(event.matches);
  });

  /* ---------- Navigation ---------- */
  const nav = document.querySelector(".nav");
  const menuToggle = document.getElementById("menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  const main = document.getElementById("main-content");
  const footer = document.querySelector(".footer");
  let menuOpen = false;

  const setMenu = (open, { restoreFocus = true } = {}) => {
    if (!menuToggle || !mobileMenu) return;
    menuOpen = open;
    mobileMenu.classList.toggle("is-open", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
    mobileMenu.inert = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (main) main.inert = open;
    if (footer) footer.inert = open;
    document.body.style.overflow = open ? "hidden" : "";
    if (open) lenis?.stop();
    else lenis?.start();
    nav?.classList.remove("is-hidden");
    if (open) mobileMenu.querySelector("a")?.focus({ preventScroll: true });
    else if (restoreFocus) menuToggle.focus({ preventScroll: true });
  };

  menuToggle?.addEventListener("click", () => setMenu(!menuOpen));
  mobileMenu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false, { restoreFocus: false }));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) setMenu(false);
  });
  window.matchMedia("(min-width: 861px)").addEventListener("change", (event) => {
    if (event.matches && menuOpen) setMenu(false, { restoreFocus: false });
  });

  // Active section in the nav
  const navLinks = [...document.querySelectorAll(".nav-links a")];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          if (link.getAttribute("href") === `#${entry.target.id}`) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((section) => sectionObserver.observe(section));
    const hero = document.querySelector(".hero");
    if (hero) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) navLinks.forEach((link) => link.removeAttribute("aria-current"));
      }, { rootMargin: "-45% 0px -50% 0px" }).observe(hero);
    }
  }

  /* ---------- Local time (Tübingen) ---------- */
  const timeEl = document.getElementById("local-time");
  if (timeEl) {
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    const zone = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", timeZoneName: "short" });
    const tick = () => {
      const now = new Date();
      const zoneName = zone.formatToParts(now).find((part) => part.type === "timeZoneName")?.value || "";
      timeEl.textContent = `${formatter.format(now)} ${zoneName.replace("GMT+1", "CET").replace("GMT+2", "CEST")}`;
      timeEl.setAttribute("datetime", now.toISOString());
    };
    tick();
    setInterval(tick, 20000);
  }

  /* ---------- Split helpers ---------- */
  const splitChars = (element) => {
    const text = element.textContent;
    element.textContent = "";
    return [...text].map((char, index) => {
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = char === " " ? "\u00a0" : char; // inline-block would swallow a plain space
      span.style.setProperty("--i", index);
      element.append(span);
      return span;
    });
  };

  const splitWords = (root) => {
    const words = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          fragment.append(part);
          return;
        }
        const span = document.createElement("span");
        span.className = "w";
        span.textContent = part;
        fragment.append(span);
        words.push(span);
      });
      node.replaceWith(fragment);
    });
    return words;
  };

  /* ---------- Hero name: fit + kinetic weight ---------- */
  const heroName = document.querySelector(".hero-name");
  const kineticLines = [...document.querySelectorAll("[data-kinetic]")];
  const heroChars = kineticLines.flatMap(splitChars);
  const BASE_W = 640;
  const BASE_D = 88;

  const fitHeroName = () => {
    if (!heroName || !kineticLines.length) return;
    const hero = heroName.closest(".hero");
    const style = getComputedStyle(hero);
    const available = hero.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    heroName.style.setProperty("--hero-size", "100px");
    heroName.classList.add("is-measuring");
    const longest = Math.max(...[...heroName.querySelectorAll(".hero-line")].map((line) =>
      [...line.children].reduce((sum, child) => sum + child.getBoundingClientRect().width, 0)));
    heroName.classList.remove("is-measuring");
    if (!longest) return;
    // Leave headroom so the heavier letters under the pointer never overflow.
    // Fill the width, but keep both lines inside roughly 60% of the viewport height.
    const heightCap = (window.innerHeight * 0.6) / 1.7;
    const size = clamp(Math.min((available * 0.95 * 100) / longest, heightCap), 48, 520);
    heroName.style.setProperty("--hero-size", `${size}px`);
    document.querySelector(".hero")?.style.setProperty("--hero-size", `${size}px`);
  };

  const charState = heroChars.map(() => ({ w: 200, d: 75, tw: BASE_W, td: BASE_D }));
  let pointer = null;
  let kineticFrame = null;
  // Stays in the future until the intro runs, so the letters wait thin behind the loader.
  let introStart = Infinity;

  const kineticTick = (now) => {
    kineticFrame = null;
    let moving = false;
    const elapsed = now - introStart;
    if (!Number.isFinite(elapsed)) return;

    heroChars.forEach((char, index) => {
      const state = charState[index];
      let tw = BASE_W;
      let td = BASE_D;
      if (elapsed < 450 + index * 55) {
        tw = 200;
        td = 75;
      } else if (pointer) {
        const rect = char.getBoundingClientRect();
        const dx = pointer.x - (rect.left + rect.width / 2);
        const dy = pointer.y - (rect.top + rect.height / 2);
        const influence = clamp(1 - Math.hypot(dx, dy) / (rect.height * 1.6), 0, 1);
        const eased = influence * influence * (3 - 2 * influence);
        // Letters near the pointer turn heavy and condensed; the rest relax a little lighter.
        tw = 540 + (800 - 540) * eased;
        td = BASE_D - (BASE_D - 75) * eased;
      }
      state.w = lerp(state.w, tw, 0.12);
      state.d = lerp(state.d, td, 0.12);
      if (Math.abs(state.w - tw) > 0.5 || Math.abs(state.d - td) > 0.1) moving = true;
      char.style.setProperty("--w", state.w.toFixed(1));
      char.style.setProperty("--d", state.d.toFixed(2));
    });

    if (moving || elapsed < 450 + heroChars.length * 55) scheduleKinetic();
  };
  const scheduleKinetic = () => {
    if (!kineticFrame) kineticFrame = requestAnimationFrame(kineticTick);
  };

  if (heroChars.length && !reducedMotion.matches) {
    const hero = document.querySelector(".hero");
    hero?.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      pointer = { x: event.clientX, y: event.clientY };
      scheduleKinetic();
    });
    hero?.addEventListener("pointerleave", () => {
      pointer = null;
      scheduleKinetic();
    });
    scheduleKinetic();
  } else {
    heroChars.forEach((char) => {
      char.style.setProperty("--w", BASE_W);
      char.style.setProperty("--d", BASE_D);
    });
  }

  // Footer wordmark: per-letter spans for the hover, sized to span the full width.
  const footerMark = document.querySelector("[data-footer-mark]");
  if (footerMark) splitChars(footerMark);
  const fitFooterMark = () => {
    if (!footerMark) return;
    const available = footerMark.parentElement.clientWidth -
      parseFloat(getComputedStyle(footerMark.parentElement).paddingLeft) * 2;
    footerMark.style.fontSize = "100px";
    const width = footerMark.scrollWidth;
    if (width) footerMark.style.fontSize = `${Math.min((available * 0.995 * 100) / width, 600)}px`;
  };
  window.addEventListener("resize", fitFooterMark);

  // Contact links get per-letter spans so the hover can ripple through them.
  document.querySelectorAll("[data-hover-kinetic]").forEach(splitChars);

  /* ---------- Intro ---------- */
  const intro = () => {
    fitHeroName();
    fitFooterMark();
    document.querySelectorAll("[data-intro]").forEach((element, index) => {
      element.style.setProperty("--delay", `${0.35 + index * 0.08}s`);
    });
    introStart = performance.now();
    if (heroChars.length && !reducedMotion.matches) scheduleKinetic();
    requestAnimationFrame(() => html.classList.add("is-loaded"));
    // The hero rule gets plucked once the name has landed.
    setTimeout(() => document.dispatchEvent(new CustomEvent("site:intro")), 650);
  };

  // Preloaded fonts only join document.fonts once requested, so ask for the display face explicitly.
  const displayFont = document.fonts?.load
    ? document.fonts.load('640 100px "Bricolage Grotesque"').catch(() => {})
    : Promise.resolve();
  const fontsReady = Promise.race([displayFont, new Promise((resolve) => setTimeout(resolve, 1200))]);
  displayFont.then(() => { fitHeroName(); fitFooterMark(); });
  window.addEventListener("resize", fitHeroName);

  /* ---------- Loader (first visit per session) ---------- */
  const loader = document.querySelector(".loader");
  const loaderNum = document.getElementById("loader-num");
  const loaderSteps = [...document.querySelectorAll(".loader-log li")];
  if (loader && !html.classList.contains("skip-loader")) {
    try { sessionStorage.setItem("intro-seen", "1"); } catch (_) { /* storage blocked */ }
    let shown = 0;
    let target = 86;
    let fontsDone = false;
    fontsReady.then(() => { fontsDone = true; target = 100; });
    const started = performance.now();
    const countUp = (now) => {
      // Ease toward the target; it only reaches 100 once the fonts are in.
      shown = Math.min(target, shown + Math.max(0.5, (target - shown) * 0.06));
      if (loaderNum) loaderNum.textContent = String(Math.floor(shown)).padStart(2, "0");
      loaderSteps.forEach((step) => step.classList.toggle("is-done", shown >= Number(step.dataset.at)));
      if (shown >= 100 && fontsDone && now - started > 1100) {
        loader.classList.add("is-done");
        setTimeout(intro, 280);
        setTimeout(() => loader.remove(), 1300);
        return;
      }
      requestAnimationFrame(countUp);
    };
    requestAnimationFrame(countUp);
  } else {
    loader?.remove();
    fontsReady.then(intro);
  }

  /* ---------- Hero frame: contact-sheet slideshow ---------- */
  const heroFrame = document.querySelector(".hero-frame");
  const frameImages = [...document.querySelectorAll(".hero-frame-stack img")];
  const frameNo = document.getElementById("hero-frame-no");
  const framePlace = document.getElementById("hero-frame-place");
  let frameIndex = 0;
  let frameTimer = null;
  let frameSteps = 0;

  const showFrame = (index) => {
    frameImages.forEach((image) => image.classList.remove("is-prev"));
    frameImages[frameIndex]?.classList.replace("is-active", "is-prev");
    frameIndex = index;
    frameImages[frameIndex].classList.add("is-active");
    const image = frameImages[frameIndex];
    if (frameNo) frameNo.textContent = `No. ${String(Number(image.dataset.frame) + 1).padStart(2, "0")}`;
    if (framePlace) framePlace.textContent = image.dataset.caption || "";
  };

  if (frameImages.length) {
    showFrame(0);
    const stopFrames = () => {
      clearInterval(frameTimer);
      frameTimer = null;
    };
    const startFrames = () => {
      // One pass through the set, then it rests (no endless auto-motion).
      if (reducedMotion.matches || frameTimer || frameSteps >= frameImages.length) return;
      frameTimer = setInterval(() => {
        frameSteps += 1;
        showFrame((frameIndex + 1) % frameImages.length);
        if (frameSteps >= frameImages.length) stopFrames();
      }, 2800);
    };
    heroFrame?.addEventListener("pointerenter", stopFrames);
    heroFrame?.addEventListener("focus", stopFrames);
    heroFrame?.addEventListener("pointerleave", startFrames);
    document.addEventListener("visibilitychange", () => (document.hidden ? stopFrames() : startFrames()));
    setTimeout(startFrames, 1800);
  }

  /* ---------- Scroll reveals ---------- */
  const revealTargets = [...document.querySelectorAll("[data-reveal]")];
  if ("IntersectionObserver" in window && !reducedMotion.matches) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    // Stagger siblings that enter together (index rows, contact links).
    revealTargets.forEach((element) => {
      const siblings = [...element.parentElement.children].filter((child) => child.hasAttribute("data-reveal"));
      const position = siblings.indexOf(element);
      if (siblings.length > 2 && position > 0) element.style.setProperty("--delay", `${Math.min(position, 6) * 0.07}s`);
      revealObserver.observe(element);
    });
  } else {
    revealTargets.forEach((element) => element.classList.add("is-in"));
  }

  /* ---------- Scroll-linked effects ---------- */
  const progressBar = document.querySelector(".scroll-progress");
  const statement = document.querySelector("[data-words]");
  const statementWords = statement ? splitWords(statement) : [];
  const parallaxItems = [...document.querySelectorAll("[data-parallax]")].map((element) => ({
    element,
    strength: Number(element.dataset.parallax) || 0.06,
  }));
  let lastScrollY = window.scrollY;
  let scrollFrame = null;
  // Deterministic spread of sink speeds, so the exit looks the same on every visit.
  const heroDrift = heroChars.map((_, index) => 0.14 + ((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.5);
  const heroDot = document.querySelector(".hero-dot");

  const onScrollFrame = () => {
    scrollFrame = null;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;

    progressBar?.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);

    if (nav) {
      nav.classList.toggle("is-scrolled", y > 24);
      if (!menuOpen) {
        if (y > lastScrollY + 4 && y > vh * 0.6) nav.classList.add("is-hidden");
        else if (y < lastScrollY - 4) nav.classList.remove("is-hidden");
      }
    }
    lastScrollY = y;

    if (reducedMotion.matches) return;

    // Hero letters sink back into their masks at different speeds as the page leaves the hero.
    if (heroChars.length && y < vh * 1.3) {
      heroChars.forEach((char, index) => {
        char.style.transform = y > 1 ? `translate3d(0, ${(y * heroDrift[index]).toFixed(1)}px, 0)` : "";
      });
      // `translate` is separate from the intro transform (and its transition) on the dot.
      if (heroDot) heroDot.style.translate = y > 1 ? `0 ${(y * 0.75).toFixed(1)}px` : "";
    }

    if (statementWords.length) {
      const rect = statement.getBoundingClientRect();
      const progress = clamp((vh * 0.88 - rect.top) / (rect.height + vh * 0.35), 0, 1);
      const lit = progress * (statementWords.length + 4);
      statementWords.forEach((word, index) => {
        word.style.setProperty("--o", (0.16 + 0.84 * clamp(lit - index, 0, 1)).toFixed(3));
      });
    }

    parallaxItems.forEach(({ element, strength }) => {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > vh + 100) return;
      const offset = (rect.top + rect.height / 2 - vh / 2) * -strength;
      element.style.setProperty("--py", `${offset.toFixed(1)}px`);
    });
  };
  const requestScrollFrame = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(onScrollFrame);
  };
  window.addEventListener("scroll", requestScrollFrame, { passive: true });
  window.addEventListener("resize", requestScrollFrame);
  if (reducedMotion.matches) statementWords.forEach((word) => word.style.setProperty("--o", 1));
  requestScrollFrame();

  /* ---------- Photography gallery ---------- */
  const photoScroller = document.getElementById("slider-section");
  const photoTrack = document.getElementById("image-track");

  if (photoScroller && photoTrack) {
    const prevButton = document.getElementById("photo-prev");
    const nextButton = document.getElementById("photo-next");
    const progress = document.querySelector(".photo-progress span");
    const currentPhoto = document.getElementById("photo-current");
    const photoPlace = document.getElementById("photo-place");
    const photoAlt = document.getElementById("photo-alt");
    const photoStatus = document.getElementById("photo-status");
    const photoFrames = [...photoTrack.querySelectorAll(".photo-frame")];
    const photoImages = photoFrames.map((frame) => frame.querySelector("img"));

    let pointerDownAt = null;
    let pointerId = null;
    let translate = 0;
    let previousTranslate = 0;
    let currentTranslate = 0;
    let minTranslate = 0;
    let imageOffsets = [];
    let animationFrame = null;
    let lastIndex = -1;

    // Filmstrip: one thumbnail per photograph, magnified like a dock under the pointer.
    const filmstrip = document.querySelector(".filmstrip");
    const thumbs = filmstrip ? photoImages.map((image, index) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.tabIndex = -1;
      thumb.className = "film-thumb";
      thumb.dataset.src = image.getAttribute("src");
      thumb.addEventListener("click", () => moveToPhoto(index));
      filmstrip.append(thumb);
      return thumb;
    }) : [];
    // Thumbnails load only once the gallery comes near, not with the first paint.
    if (filmstrip) {
      new IntersectionObserver((entries, observer) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        thumbs.forEach((thumb) => { thumb.style.backgroundImage = `url("${thumb.dataset.src}")`; });
        observer.disconnect();
      }, { rootMargin: "400px 0px" }).observe(filmstrip);
    }
    if (filmstrip && finePointer.matches && !reducedMotion.matches) {
      const magnify = (pointerX) => {
        thumbs.forEach((thumb) => {
          const rect = thumb.getBoundingClientRect();
          const distance = pointerX === null ? Infinity : Math.abs(pointerX - (rect.left + rect.width / 2));
          const influence = clamp(1 - distance / 90, 0, 1);
          thumb.style.setProperty("--mag", (1 + influence * influence * 1.6).toFixed(3));
        });
      };
      filmstrip.addEventListener("pointermove", (event) => magnify(event.clientX));
      filmstrip.addEventListener("pointerleave", () => magnify(null));
    }

    // Blurred, full-bleed copy of the current photograph behind the gallery.
    const backdropLayers = [...document.querySelectorAll(".gallery-backdrop img")];
    let backdropTimer = null;
    let backdropFront = 0;
    const queueBackdrop = (index) => {
      if (backdropLayers.length < 2) return;
      clearTimeout(backdropTimer);
      backdropTimer = setTimeout(() => {
        const next = backdropLayers[1 - backdropFront];
        const source = photoImages[index].currentSrc || photoImages[index].src;
        if (next.src === source && next.classList.contains("is-active")) return;
        next.onload = () => {
          backdropLayers[backdropFront].classList.remove("is-active");
          next.classList.add("is-active");
          backdropFront = 1 - backdropFront;
        };
        next.src = source;
      }, 160);
    };

    const getPhotoIndex = () => {
      let nearest = 0;
      imageOffsets.forEach(({ offsetLeft }, index) => {
        if (Math.abs(translate + offsetLeft) < Math.abs(translate + imageOffsets[nearest].offsetLeft)) nearest = index;
      });
      return nearest;
    };

    const syncGalleryControls = (announce = false) => {
      const index = getPhotoIndex();
      if (index !== lastIndex) {
        lastIndex = index;
        if (currentPhoto) currentPhoto.textContent = String(index + 1).padStart(2, "0");
        if (photoPlace) photoPlace.textContent = photoImages[index].dataset.place || "";
        if (photoAlt) photoAlt.textContent = photoImages[index].alt;
        queueBackdrop(index);
        thumbs.forEach((thumb, thumbIndex) => thumb.classList.toggle("is-current", thumbIndex === index));
      }
      if (prevButton) prevButton.disabled = translate >= -1;
      if (nextButton) nextButton.disabled = translate <= minTranslate + 1;
      if (announce && photoStatus) photoStatus.textContent = `Photograph ${index + 1} of ${photoImages.length}. ${photoImages[index].alt}`;
    };

    const updateBounds = () => {
      imageOffsets = photoFrames.map((frame, index) => ({ element: photoImages[index], offsetLeft: frame.offsetLeft }));
      const lastFrame = photoFrames.at(-1);
      minTranslate = lastFrame ? -(lastFrame.offsetLeft - photoFrames[0].offsetLeft) : 0;
      translate = clamp(translate, minTranslate, 0);
      previousTranslate = translate;
      syncGalleryControls();
    };

    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(update);
    };

    const moveToPhoto = (index) => {
      updateBounds();
      const frame = imageOffsets[clamp(index, 0, photoImages.length - 1)];
      translate = clamp(-frame.offsetLeft, minTranslate, 0);
      previousTranslate = translate;
      syncGalleryControls(true);
      scheduleUpdate();
    };
    prevButton?.addEventListener("click", () => moveToPhoto(getPhotoIndex() - 1));
    nextButton?.addEventListener("click", () => moveToPhoto(getPhotoIndex() + 1));

    // The hero frame jumps straight to the photograph it was showing.
    heroFrame?.addEventListener("click", () => {
      const target = Number(frameImages[frameIndex]?.dataset.frame);
      if (Number.isFinite(target)) setTimeout(() => moveToPhoto(target), reducedMotion.matches ? 0 : 500);
    });

    const updateFromPointer = (clientX) => {
      if (pointerDownAt === null) return;
      translate = clamp(previousTranslate - (pointerDownAt - clientX), minTranslate, 0);
    };

    const finishDrag = (event) => {
      if (pointerId !== null && event?.pointerId !== pointerId) return;
      pointerDownAt = null;
      pointerId = null;
      previousTranslate = translate;
      photoScroller.classList.remove("is-dragging");
      dragCursor?.style.setProperty("--cs", 1);
      syncGalleryControls(true);
      scheduleUpdate();
    };

    photoScroller.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      updateBounds();
      pointerDownAt = event.clientX;
      pointerId = event.pointerId;
      previousTranslate = translate;
      photoScroller.classList.add("is-dragging");
      dragCursor?.style.setProperty("--cs", 0.72);
      photoScroller.setPointerCapture(event.pointerId);
      scheduleUpdate();
    });
    photoScroller.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;
      updateFromPointer(event.clientX);
      scheduleUpdate();
    });
    photoScroller.addEventListener("pointerup", finishDrag);
    photoScroller.addEventListener("pointercancel", finishDrag);
    photoScroller.addEventListener("lostpointercapture", finishDrag);

    photoScroller.addEventListener("wheel", (event) => {
      if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;
      event.preventDefault();
      event.stopPropagation(); // keep horizontal swipes away from the page scroller
      updateBounds();
      translate = clamp(translate - event.deltaX * 0.85, minTranslate, 0);
      previousTranslate = translate;
      scheduleUpdate();
    }, { passive: false });

    photoScroller.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home") moveToPhoto(0);
      else if (event.key === "End") moveToPhoto(photoImages.length - 1);
      else moveToPhoto(getPhotoIndex() + (event.key === "ArrowRight" ? 1 : -1));
    });

    window.addEventListener("resize", () => { updateBounds(); scheduleUpdate(); });
    window.addEventListener("load", () => { updateBounds(); scheduleUpdate(); });

    const update = () => {
      animationFrame = null;
      const difference = Math.abs(currentTranslate - translate);
      currentTranslate = reducedMotion.matches ? translate : lerp(currentTranslate, translate, 0.08);
      photoTrack.style.transform = `translate3d(${currentTranslate}px, -50%, 0)`;

      syncGalleryControls();
      if (progress) {
        const fraction = minTranslate ? currentTranslate / minTranslate : 0;
        progress.style.transform = `scaleX(${(1 + fraction * (photoImages.length - 1)) / photoImages.length})`;
      }
      const halfWidth = photoScroller.clientWidth / 2;
      imageOffsets.forEach(({ element, offsetLeft }) => {
        const distance = currentTranslate + offsetLeft;
        const normalized = clamp(distance / halfWidth, -1.5, 1.5);
        const parallax = reducedMotion.matches ? 0 : normalized * 13;
        element.style.setProperty("--parallax-x", `${parallax}%`);
      });

      if (difference > 0.08 || pointerDownAt !== null) scheduleUpdate();
    };

    /* Drag cursor that trails the pointer over the gallery */
    const stage = document.querySelector(".gallery-stage");
    const dragCursor = document.querySelector(".drag-cursor");
    if (stage && dragCursor && finePointer.matches) {
      let cx = 0, cy = 0, tx = 0, ty = 0, cursorFrame = null;
      const followCursor = () => {
        cursorFrame = null;
        cx = reducedMotion.matches ? tx : lerp(cx, tx, 0.2);
        cy = reducedMotion.matches ? ty : lerp(cy, ty, 0.2);
        dragCursor.style.setProperty("--cx", `${cx.toFixed(1)}px`);
        dragCursor.style.setProperty("--cy", `${cy.toFixed(1)}px`);
        if (Math.abs(cx - tx) > 0.3 || Math.abs(cy - ty) > 0.3) cursorFrame = requestAnimationFrame(followCursor);
      };
      stage.addEventListener("pointerenter", (event) => {
        const rect = stage.getBoundingClientRect();
        cx = tx = event.clientX - rect.left;
        cy = ty = event.clientY - rect.top;
        followCursor();
        dragCursor.classList.add("is-visible");
      });
      stage.addEventListener("pointermove", (event) => {
        const rect = stage.getBoundingClientRect();
        tx = event.clientX - rect.left;
        ty = event.clientY - rect.top;
        if (!cursorFrame) cursorFrame = requestAnimationFrame(followCursor);
      });
      stage.addEventListener("pointerleave", () => dragCursor.classList.remove("is-visible"));
    }

    reducedMotion.addEventListener("change", scheduleUpdate);
    updateBounds();
    scheduleUpdate();
  }

  /* ---------- Section headings rise letter by letter ---------- */
  const splitHeading = (element) => {
    const text = element.textContent.trim();
    element.textContent = "";
    const label = document.createElement("span");
    label.className = "sr-only";
    label.textContent = text;
    element.append(label);
    let index = 0;
    text.split(" ").forEach((word, wordIndex) => {
      if (wordIndex) element.append(" ");
      const wrap = document.createElement("span");
      wrap.className = "split-word";
      wrap.setAttribute("aria-hidden", "true");
      [...word].forEach((char) => {
        const span = document.createElement("span");
        span.className = "split-char";
        span.textContent = char;
        span.style.setProperty("--i", index++);
        wrap.append(span);
      });
      element.append(wrap);
    });
  };
  document.querySelectorAll(".section-head h2").forEach(splitHeading);

  /* ---------- Magnetic controls ---------- */
  if (finePointer.matches && !reducedMotion.matches) {
    document.querySelectorAll("[data-magnetic]").forEach((element) => {
      const strength = Number(element.dataset.magnetic) || 0.3;
      element.addEventListener("pointermove", (event) => {
        const rect = element.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        element.style.translate = `${(dx * strength).toFixed(1)}px ${(dy * strength).toFixed(1)}px`;
      });
      element.addEventListener("pointerleave", () => { element.style.translate = ""; });
    });
  }

  /* ---------- Strings: the rules on the page are plucked strings ---------- */
  const stringHosts = [...document.querySelectorAll("[data-string]")];
  if (stringHosts.length && !reducedMotion.matches && "ResizeObserver" in window) {
    const HEIGHT = 160;
    const MID = HEIGHT / 2;
    const GRAB_RANGE = 48;
    const pointerNow = { x: -1, y: -1, lastY: null, active: false };
    let stringFrame = null;

    const strings = stringHosts.map((host) => {
      const edge = host.dataset.string === "bottom" ? "bottom" : "top";
      const canvas = document.createElement("canvas");
      canvas.className = `string-canvas string-${edge}`;
      canvas.setAttribute("aria-hidden", "true");
      host.append(canvas);
      host.classList.add("has-string");
      return {
        host, edge, canvas,
        ctx: canvas.getContext("2d"),
        y: new Float32Array(2), v: new Float32Array(2),
        n: 2, spacing: 1, width: 0,
        grab: -1, grabY: 0,
        visible: false, awake: false, plucked: false,
        color: "", accent: "",
      };
    });

    const readColors = (string) => {
      const style = getComputedStyle(string.host);
      string.color = style.getPropertyValue("--line").trim() || "rgba(120,130,150,0.3)";
      string.accent = style.getPropertyValue("--accent").trim() || "#3459d8";
    };

    const resizeString = (string) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      string.width = string.host.clientWidth;
      string.canvas.width = Math.round(string.width * ratio);
      string.canvas.height = Math.round(HEIGHT * ratio);
      string.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      string.n = Math.max(8, Math.round(string.width / 7));
      string.spacing = string.width / (string.n - 1);
      string.y = new Float32Array(string.n);
      string.v = new Float32Array(string.n);
      string.grab = -1;
      drawString(string, 0);
    };

    const drawString = (string, amplitude) => {
      const { ctx, y, n, spacing, width } = string;
      ctx.clearRect(0, 0, width, HEIGHT);
      ctx.beginPath();
      ctx.moveTo(0, MID + y[0]);
      for (let i = 1; i < n - 1; i++) {
        const xc = (i + 0.5) * spacing;
        ctx.quadraticCurveTo(i * spacing, MID + y[i], xc, MID + (y[i] + y[i + 1]) / 2);
      }
      ctx.lineTo(width, MID + y[n - 1]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = string.color;
      ctx.stroke();
      if (amplitude > 0.4) {
        // The more it swings, the more the accent shows through.
        ctx.globalAlpha = clamp(amplitude / 16, 0, 1);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = string.accent;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    const pluck = (string, fraction, amount) => {
      const center = Math.round(fraction * (string.n - 1));
      for (let i = 1; i < string.n - 1; i++) {
        const t = (i - center) / 5;
        string.y[i] += amount * Math.exp(-t * t);
      }
      string.awake = true;
      scheduleStrings();
    };

    const release = (string) => {
      if (string.grab < 0) return;
      string.grab = -1;
      document.querySelector(".string-hint")?.classList.add("is-used");
    };

    const interact = (string) => {
      const rect = string.host.getBoundingClientRect();
      const lineY = string.edge === "top" ? rect.top : rect.bottom;
      const { x, y, lastY, active } = pointerNow;
      if (!active || x < rect.left || x > rect.right || lastY === null) {
        release(string);
        return;
      }
      const dy = y - lineY;
      const previous = lastY - lineY;
      if (string.grab < 0) {
        // Catch the string when the pointer crosses it.
        const crossed = (dy >= 0) !== (previous >= 0);
        if (!crossed || Math.abs(dy) > 40 || Math.abs(previous) > 40) return;
      } else if (Math.abs(dy) > GRAB_RANGE) {
        release(string); // let it ring
        return;
      }
      string.grab = clamp(Math.round((x - rect.left) / string.spacing), 1, string.n - 2);
      string.grabY = dy;
      string.awake = true;
    };

    const stepString = (string) => {
      const { y, v, n } = string;
      for (let iteration = 0; iteration < 8; iteration++) {
        for (let i = 1; i < n - 1; i++) v[i] += (y[i - 1] + y[i + 1] - 2 * y[i]) * 0.45;
        for (let i = 1; i < n - 1; i++) {
          v[i] *= 0.9984;
          y[i] += v[i];
        }
        if (string.grab >= 0) {
          y[string.grab] = lerp(y[string.grab], string.grabY, 0.5);
          v[string.grab] = 0;
        }
      }
      let amplitude = 0;
      let energy = 0;
      for (let i = 0; i < n; i++) {
        amplitude = Math.max(amplitude, Math.abs(y[i]));
        energy += Math.abs(v[i]);
      }
      if (string.grab < 0 && amplitude < 0.06 && energy < 0.5) {
        y.fill(0);
        v.fill(0);
        string.awake = false;
        amplitude = 0;
      }
      drawString(string, amplitude);
    };

    const stringTick = () => {
      stringFrame = null;
      let keepGoing = false;
      strings.forEach((string) => {
        if (!string.visible) return;
        interact(string);
        if (string.awake) {
          stepString(string);
          keepGoing = true;
        }
      });
      pointerNow.lastY = pointerNow.active ? pointerNow.y : null;
      if (keepGoing) scheduleStrings();
    };
    const scheduleStrings = () => {
      if (!stringFrame) stringFrame = requestAnimationFrame(stringTick);
    };

    window.addEventListener("pointermove", (event) => {
      pointerNow.x = event.clientX;
      pointerNow.y = event.clientY;
      pointerNow.active = true;
      scheduleStrings();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => {
      pointerNow.active = false;
      pointerNow.lastY = null;
    });
    // Scrolling moves the lines under a resting cursor, which plucks them too.
    window.addEventListener("scroll", () => { if (pointerNow.active) scheduleStrings(); }, { passive: true });

    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const string = strings.find((item) => item.host === entry.target);
        if (string) resizeString(string);
      });
    });
    const visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const string = strings.find((item) => item.host === entry.target);
        if (!string) return;
        string.visible = entry.isIntersecting;
        // Each rule rings once as it scrolls into view.
        if (entry.isIntersecting && !string.plucked && !("stringIntro" in string.host.dataset)) {
          string.plucked = true;
          setTimeout(() => pluck(string, 0.2 + Math.random() * 0.25, 9), 380);
        }
      });
    }, { rootMargin: "100px 0px" });

    strings.forEach((string) => {
      readColors(string);
      resizeString(string);
      resizeObserver.observe(string.host);
      visibilityObserver.observe(string.host);
    });

    document.addEventListener("site:intro", () => {
      strings.filter((string) => "stringIntro" in string.host.dataset).forEach((string) => {
        string.plucked = true;
        pluck(string, 0.12, 16);
      });
    });

    new MutationObserver(() => {
      strings.forEach((string) => {
        readColors(string);
        drawString(string, 0);
      });
      scheduleStrings();
    }).observe(html, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- Projects: horizontal reel pinned to the scroll ---------- */
  const reel = document.querySelector("[data-reel]");
  if (reel) {
    const svg = (body) => `<svg viewBox="0 0 320 200" aria-hidden="true">${body}</svg>`;
    const fmt = (value) => value.toFixed(1);

    const visuals = {
      harmony: () => {
        let bars = "";
        for (let i = 0; i < 30; i++) {
          const height = 14 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 78;
          bars += `<rect class="pv-bar" x="${fmt(36 + i * 8.4)}" y="${fmt(104 - height / 2)}" width="3.4" height="${fmt(height)}" rx="1.7" style="--d:${(0.55 + (i % 5) * 0.12).toFixed(2)}s;--o:${(-i * 0.11).toFixed(2)}s"/>`;
        }
        return svg(`<g class="pv-dots"><circle cx="36" cy="30" r="4"/><circle cx="50" cy="30" r="4"/><circle cx="64" cy="30" r="4"/></g>${bars}`);
      },
      taylor: () => {
        const toX = (x) => 20 + ((x + 2 * Math.PI) / (4 * Math.PI)) * 280;
        const toY = (y) => 100 - y * 34;
        const path = (fn) => {
          let d = "";
          for (let i = 0; i <= 140; i++) {
            const x = -2 * Math.PI + (i / 140) * 4 * Math.PI;
            const y = clamp(fn(x), -3.2, 3.2);
            d += `${i ? "L" : "M"}${fmt(toX(x))} ${fmt(toY(y))}`;
          }
          return d;
        };
        const factorial = (k) => (k <= 1 ? 1 : k * factorial(k - 1));
        const taylor = (terms) => (x) => {
          let sum = 0;
          for (let k = 0; k < terms; k++) sum += ((-1) ** k * x ** (2 * k + 1)) / factorial(2 * k + 1);
          return sum;
        };
        let approximations = "";
        for (let terms = 1; terms <= 5; terms++) {
          approximations += `<path class="pv-approx" pathLength="1" d="${path(taylor(terms))}" style="--o:${(terms * 0.45).toFixed(2)}s;opacity:${(0.35 + terms * 0.13).toFixed(2)}"/>`;
        }
        return svg(`<defs><clipPath id="pv-clip"><rect x="10" y="14" width="300" height="172"/></clipPath></defs>
          <line class="pv-axis" x1="20" y1="100" x2="300" y2="100"/><line class="pv-axis" x1="160" y1="18" x2="160" y2="182"/>
          <g clip-path="url(#pv-clip)"><path class="pv-curve" d="${path(Math.sin)}"/>${approximations}</g>`);
      },
      battery: () => svg(`<rect class="pv-faint" x="0" y="0" width="320" height="20"/>
          <rect class="pv-ink" x="252" y="7" width="16" height="7" rx="1.5"/><rect class="pv-ink" x="274" y="7" width="30" height="7" rx="1.5" opacity=".5"/>
          <rect class="pv-outline" x="96" y="70" width="118" height="56" rx="10"/>
          <rect class="pv-ink" x="216" y="88" width="6" height="20" rx="2"/>
          <rect class="pv-fill" x="103" y="77" width="104" height="42" rx="5"/>
          <polyline class="pv-line" pathLength="1" points="40,172 70,160 100,166 130,150 160,156 190,142 220,150 250,138 280,146"/>`),
      chat: () => {
        let lines = "";
        let packets = "";
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + 0.3;
          const cx = 160 + Math.cos(angle) * 118;
          const cy = 100 + Math.sin(angle) * 68;
          lines += `<line class="pv-axis" x1="160" y1="100" x2="${fmt(cx)}" y2="${fmt(cy)}"/><circle class="pv-node" cx="${fmt(cx)}" cy="${fmt(cy)}" r="7"/>`;
          packets += `<circle class="pv-packet" cx="160" cy="100" r="3.2" style="--dx:${fmt(cx - 160)}px;--dy:${fmt(cy - 100)}px;--d:${(1.4 + (i % 3) * 0.35).toFixed(2)}s;--o:${(-i * 0.4).toFixed(2)}s;animation-direction:${i % 2 ? "reverse" : "normal"}"/>`;
        }
        return svg(`${lines}${packets}<rect class="pv-server" x="140" y="86" width="40" height="28" rx="5"/>`);
      },
      mbcomp: () => {
        const toX = (t) => 24 + t * 220;
        const band = (center, width, gain) => {
          let d = "";
          for (let i = 0; i <= 80; i++) {
            const t = i / 80;
            const y = 160 - gain * Math.exp(-(((t - center) / width) ** 2));
            d += `${i ? "L" : "M"}${fmt(toX(t))} ${fmt(y)}`;
          }
          return d;
        };
        const meters = [0, 1, 2].map((i) => `<rect class="pv-faint" x="${262 + i * 14}" y="40" width="8" height="120" rx="2"/><rect class="pv-meter" x="${262 + i * 14}" y="40" width="8" height="120" rx="2" style="--d:${(0.7 + i * 0.23).toFixed(2)}s;--o:${(-i * 0.3).toFixed(2)}s"/>`).join("");
        return svg(`<line class="pv-axis" x1="24" y1="160" x2="244" y2="160"/>
          <line class="pv-dash" x1="${toX(0.33)}" y1="36" x2="${toX(0.33)}" y2="160"/><line class="pv-dash" x1="${toX(0.66)}" y1="36" x2="${toX(0.66)}" y2="160"/>
          <path class="pv-band" d="${band(0.16, 0.16, 92)}"/><path class="pv-band b2" d="${band(0.5, 0.15, 112)}"/><path class="pv-band b3" d="${band(0.83, 0.16, 78)}"/>${meters}`);
      },
    };


    reel.querySelectorAll("[data-visual]").forEach((media) => {
      media.innerHTML = visuals[media.dataset.visual]?.() || "";
    });

    const track = reel.querySelector(".reel-track");
    const panels = [...reel.querySelectorAll(".reel-panel")];
    const counter = document.getElementById("reel-current");
    const bar = reel.querySelector(".reel-bar span");
    const pinQuery = window.matchMedia("(min-width: 861px)");
    let pinned = false;
    let distance = 0;
    let x = 0;
    let skew = 0;
    let reelFrame = null;
    let activePanel = -1;

    const measureReel = () => {
      pinned = pinQuery.matches && !reducedMotion.matches;
      reel.classList.toggle("is-pinned", pinned);
      if (!pinned) {
        reel.style.height = "";
        track.style.transform = "";
        return;
      }
      distance = Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
      reel.style.height = `${distance + window.innerHeight}px`;
      updateReel();
    };

    const setActive = (index) => {
      if (index === activePanel) return;
      activePanel = index;
      panels.forEach((panel, i) => panel.classList.toggle("is-active", i === index));
      if (counter) counter.textContent = String(index + 1).padStart(2, "0");
    };

    const updateReel = () => {
      reelFrame = null;
      if (!pinned) {
        // Native swipe on small screens: follow the snap position instead.
        const index = Math.round(track.scrollLeft / Math.max(1, panels[0].offsetWidth));
        setActive(clamp(index, 0, panels.length - 1));
        if (bar) bar.style.transform = `scaleX(${(track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth)) || 0})`;
        return;
      }
      const rect = reel.getBoundingClientRect();
      const progress = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight), 0, 1);
      const target = -progress * distance;
      const velocity = target - x;
      x = target;
      // Panels lean into the direction of travel, then settle.
      skew = lerp(skew, clamp(velocity * 0.06, -5, 5), 0.18);
      track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      track.style.setProperty("--skew", `${skew.toFixed(3)}deg`);
      if (bar) bar.style.transform = `scaleX(${progress.toFixed(4)})`;
      setActive(clamp(Math.round(progress * (panels.length - 1)), 0, panels.length - 1));
      if (Math.abs(skew) > 0.01) reelFrame = requestAnimationFrame(updateReel);
    };
    const scheduleReel = () => {
      if (!reelFrame) reelFrame = requestAnimationFrame(updateReel);
    };

    window.addEventListener("scroll", scheduleReel, { passive: true });
    track.addEventListener("scroll", scheduleReel, { passive: true });
    window.addEventListener("resize", measureReel);
    pinQuery.addEventListener("change", measureReel);
    window.addEventListener("load", measureReel);

    // Keyboard users: focusing a link in a panel scrolls the page so that panel is in view.
    track.addEventListener("focusin", (event) => {
      if (!pinned) return;
      const index = panels.indexOf(event.target.closest(".reel-panel"));
      if (index < 0) return;
      const top = reel.getBoundingClientRect().top + window.scrollY;
      const y = top + (index / Math.max(1, panels.length - 1)) * (reel.offsetHeight - window.innerHeight);
      track.parentElement.scrollLeft = 0;
      if (lenis) lenis.scrollTo(y, { immediate: true });
      else window.scrollTo(0, y);
    });

    measureReel();
    setActive(0);
  }

  /* ---------- Profile: CV as a DAW arrangement with a scroll-driven playhead ---------- */
  const timeline = document.querySelector("[data-timeline]");
  if (timeline) {
    const START = 2016;
    const END = 2028;
    const today = new Date();
    const NOW = today.getFullYear() + today.getMonth() / 12;
    const arrangement = timeline.querySelector(".arrangement");
    const clips = [...timeline.querySelectorAll(".clip, .marker")];
    const entries = [...timeline.querySelectorAll(".cv-entry")];
    const yearEl = timeline.querySelector(".timeline-year");
    const monthEl = timeline.querySelector(".timeline-month");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const position = (value) => ((value - START) / (END - START)) * 100;

    arrangement?.style.setProperty("--now", `${position(NOW)}%`);

    // Lay out clips and draw a small waveform inside each, like audio regions.
    clips.forEach((clip, clipIndex) => {
      const start = Number(clip.dataset.start);
      const end = clip.dataset.end === "now" ? NOW : Number(clip.dataset.end);
      clip.dataset.endValue = end;
      clip.style.left = `${position(start)}%`;
      if (clip.classList.contains("clip")) {
        clip.style.width = `${position(end) - position(start)}%`;
        // Mirrored envelope, filled, like an audio region overview.
        const top = [];
        const bottom = [];
        for (let i = 0; i <= 80; i++) {
          const seed = Math.sin((i + 1) * (clipIndex + 3) * 12.9898) * 43758.5453;
          const amplitude = 1.5 + Math.abs(seed % 1) * 6 * (0.55 + 0.45 * Math.sin(i / 7 + clipIndex));
          const px = ((i / 80) * 100).toFixed(2);
          top.push(`${px},${(12 - amplitude).toFixed(2)}`);
          bottom.unshift(`${px},${(12 + amplitude).toFixed(2)}`);
        }
        const points = [...top, ...bottom].join(" ");
        const wave = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        wave.setAttribute("viewBox", "0 0 100 24");
        wave.setAttribute("preserveAspectRatio", "none");
        wave.setAttribute("class", "clip-wave");
        wave.innerHTML = `<polygon points="${points}"/>`;
        clip.prepend(wave);
        // Expected time after today is drawn hatched.
        if (end > NOW) clip.style.setProperty("--future-from", `${((NOW - start) / (end - start)) * 100}%`);
      }
    });

    // Clips too short for their label show it beside them instead.
    const markNarrowClips = () => {
      clips.forEach((clip) => {
        if (clip.classList.contains("clip")) clip.classList.toggle("clip-narrow", clip.offsetWidth < 96);
      });
    };
    markNarrowClips();
    window.addEventListener("resize", markNarrowClips);

    // Ruler ticks
    const ruler = timeline.querySelector(".ruler");
    if (ruler) {
      for (let year = START; year <= END; year++) {
        const tick = document.createElement("span");
        tick.className = "ruler-tick";
        tick.style.left = `${position(year)}%`;
        tick.textContent = year < END ? `’${String(year).slice(2)}` : "";
        ruler.append(tick);
      }
    }

    const setPlayhead = (value) => {
      arrangement?.style.setProperty("--t", `${position(value)}%`);
      const year = Math.floor(value);
      if (yearEl) yearEl.textContent = year;
      if (monthEl) monthEl.textContent = months[clamp(Math.floor((value - year) * 12 + 1e-6), 0, 11)];
      clips.forEach((clip) => {
        const start = Number(clip.dataset.start);
        const end = Number(clip.dataset.endValue);
        const isMarker = clip.classList.contains("marker");
        const active = isMarker ? Math.abs(value - start) < 0.5 : value >= start && value <= end;
        clip.classList.toggle("is-active", active);
        clip.classList.toggle("is-past", !active && value > (isMarker ? start : end));
      });
      entries.forEach((entry) => {
        const start = Number(entry.dataset.start);
        const end = entry.dataset.end === "now" ? NOW : Number(entry.dataset.end);
        const active = entry.dataset.marker ? Math.abs(value - start) < 0.5 : value >= start && value <= end;
        entry.classList.toggle("is-active", active);
        entry.classList.toggle("is-future", value < start - (entry.dataset.marker ? 0.5 : 0));
      });
    };

    const pinTimeline = window.matchMedia("(min-width: 861px)");
    let timelineFrame = null;
    const updateTimeline = () => {
      timelineFrame = null;
      const rect = timeline.getBoundingClientRect();
      const vh = window.innerHeight;
      const isPinned = pinTimeline.matches && !reducedMotion.matches;
      const progress = isPinned
        ? clamp(-rect.top / Math.max(1, rect.height - vh), 0, 1)
        : clamp((vh * 0.75 - rect.top) / (rect.height * 0.9), 0, 1);
      // Arrive at "today" slightly before the end, so the last stretch rests on the present.
      setPlayhead(START + 0.5 + clamp(progress / 0.94, 0, 1) * (NOW - START - 0.5));
    };
    const syncTimelineMode = () => {
      timeline.classList.toggle("is-pinned", pinTimeline.matches && !reducedMotion.matches);
      updateTimeline();
    };
    if (reducedMotion.matches) setPlayhead(NOW);
    else window.addEventListener("scroll", () => { if (!timelineFrame) timelineFrame = requestAnimationFrame(updateTimeline); }, { passive: true });
    pinTimeline.addEventListener("change", syncTimelineMode);

    // Clicking a clip jumps the playhead (and page) to that moment.
    clips.forEach((clip) => {
      clip.addEventListener("click", () => {
        if (!timeline.classList.contains("is-pinned")) return;
        const start = Number(clip.dataset.start) + 0.05;
        const fraction = ((start - START - 0.5) / (NOW - START - 0.5)) * 0.94;
        const top = timeline.getBoundingClientRect().top + window.scrollY;
        const y = top + clamp(fraction, 0, 1) * (timeline.offsetHeight - window.innerHeight);
        if (lenis) lenis.scrollTo(y, { duration: 1.2 });
        else window.scrollTo({ top: y, behavior: "smooth" });
      });
    });
    syncTimelineMode();
  }

  /* ---------- Cursor follower ---------- */
  if (finePointer.matches && !reducedMotion.matches) {
    const dot = document.createElement("div");
    dot.className = "cursor";
    dot.setAttribute("aria-hidden", "true");
    document.body.append(dot);
    let cx = -100, cy = -100, tx = -100, ty = -100, cursorFrame = null;
    const moveDot = () => {
      cursorFrame = null;
      cx = lerp(cx, tx, 0.22);
      cy = lerp(cy, ty, 0.22);
      dot.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      if (Math.abs(cx - tx) > 0.2 || Math.abs(cy - ty) > 0.2) cursorFrame = requestAnimationFrame(moveDot);
    };
    window.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      tx = event.clientX;
      ty = event.clientY;
      if (cx < -50) { cx = tx; cy = ty; }
      const target = event.target;
      // The gallery and project list bring their own pointers.
      dot.classList.toggle("is-hidden", !!target.closest?.(".gallery-stage"));
      dot.classList.toggle("is-link", !!target.closest?.("a, button, [role='button']"));
      dot.classList.add("is-visible");
      if (!cursorFrame) cursorFrame = requestAnimationFrame(moveDot);
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => dot.classList.remove("is-visible"));
    window.addEventListener("pointerdown", () => dot.classList.add("is-down"));
    window.addEventListener("pointerup", () => dot.classList.remove("is-down"));
  }
})();
