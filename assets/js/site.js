(() => {
  const html = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const lerp = (start, end, factor) => start + (end - start) * factor;

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
      span.textContent = char;
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
  let introStart = performance.now();

  const kineticTick = (now) => {
    kineticFrame = null;
    let moving = false;
    const elapsed = now - introStart;

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

  // Contact links get per-letter spans so the hover can ripple through them.
  document.querySelectorAll("[data-hover-kinetic]").forEach(splitChars);

  /* ---------- Intro ---------- */
  const intro = () => {
    fitHeroName();
    document.querySelectorAll("[data-intro]").forEach((element, index) => {
      element.style.setProperty("--delay", `${0.35 + index * 0.08}s`);
    });
    introStart = performance.now();
    requestAnimationFrame(() => html.classList.add("is-loaded"));
  };
  if (document.fonts?.load) {
    // Preloaded fonts only join document.fonts once requested, so ask for the display face explicitly.
    const displayFont = document.fonts.load('640 100px "Bricolage Grotesque"').catch(() => {});
    Promise.race([displayFont, new Promise((resolve) => setTimeout(resolve, 1200))]).then(intro);
    displayFont.then(fitHeroName);
  } else {
    intro();
  }
  window.addEventListener("resize", fitHeroName);

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
})();
