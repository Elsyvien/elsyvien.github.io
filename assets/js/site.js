(() => {
  const html = document.documentElement;
  const body = document.body;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  const readStoredTheme = () => {
    try {
      return localStorage.getItem("theme");
    } catch (_) {
      return null;
    }
  };

  const storeTheme = (theme) => {
    try {
      localStorage.setItem("theme", theme);
    } catch (_) {
      // A blocked storage API should never prevent theme switching.
    }
  };

  const themeToggle = document.getElementById("theme-toggle");

  const syncThemeControl = () => {
    if (!themeToggle) return;
    const isDark = html.classList.contains("dark");
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light theme" : "Switch to dark theme",
    );
  };

  const applyTheme = (isDark, persist = false) => {
    html.classList.toggle("dark", isDark);
    if (persist) storeTheme(isDark ? "dark" : "light");
    syncThemeControl();
  };

  syncThemeControl();

  themeToggle?.addEventListener("click", () => {
    themeToggle.classList.add("is-switching");
    applyTheme(!html.classList.contains("dark"), true);
    window.setTimeout(() => themeToggle.classList.remove("is-switching"), 180);
  });

  systemTheme.addEventListener("change", (event) => {
    if (!readStoredTheme()) applyTheme(event.matches);
  });

  const menuToggle = document.getElementById("mobile-menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  const main = document.getElementById("main-content");
  const footer = document.querySelector(".site-footer");
  const brandLink = document.querySelector(".brand-mark");
  const skipLink = document.querySelector(".skip-link");
  let menuCloseTimer = null;

  const setPageInert = (inert) => {
    if (main) main.inert = inert;
    if (footer) footer.inert = inert;
    if (themeToggle) themeToggle.inert = inert;
    if (brandLink) brandLink.inert = inert;
    if (skipLink) skipLink.inert = inert;
  };

  const openMenu = () => {
    if (!menuToggle || !mobileMenu) return;
    window.clearTimeout(menuCloseTimer);
    mobileMenu.classList.remove("is-closing");
    mobileMenu.removeAttribute("inert");
    mobileMenu.setAttribute("aria-hidden", "false");
    mobileMenu.classList.add("is-open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close navigation menu");
    body.classList.add("menu-open");
    setPageInert(true);
    window.requestAnimationFrame(() => {
      mobileMenu.querySelector("[data-mobile-link]")?.focus();
    });
  };

  const closeMenu = ({ restoreFocus = true } = {}) => {
    if (!menuToggle || !mobileMenu) return;
    window.clearTimeout(menuCloseTimer);
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
    mobileMenu.setAttribute("inert", "");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    body.classList.remove("menu-open");
    setPageInert(false);

    if (reducedMotion.matches) {
      mobileMenu.classList.remove("is-closing");
    } else {
      mobileMenu.classList.add("is-closing");
      menuCloseTimer = window.setTimeout(() => {
        mobileMenu.classList.remove("is-closing");
      }, 260);
    }

    if (restoreFocus) menuToggle.focus();
  };

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", () => {
      if (mobileMenu.classList.contains("is-open")) closeMenu();
      else openMenu();
    });

    mobileMenu.querySelectorAll("[data-mobile-link]").forEach((link) => {
      link.addEventListener("click", () => closeMenu({ restoreFocus: false }));
    });

    document.addEventListener("keydown", (event) => {
      if (!mobileMenu.classList.contains("is-open")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = [
        ...mobileMenu.querySelectorAll("[data-mobile-link]"),
        menuToggle,
      ];
      const first = focusable[0];
      const currentIndex = focusable.indexOf(document.activeElement);
      if (currentIndex === -1) {
        event.preventDefault();
        first.focus();
        return;
      }

      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + focusable.length) % focusable.length;
      focusable[nextIndex].focus();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768 && mobileMenu.classList.contains("is-open")) {
        closeMenu({ restoreFocus: false });
      }
    });
  }

  const depthItems = document.querySelectorAll("[data-motion-depth]");
  const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  if (!reducedMotion.matches && precisePointer.matches) {
    depthItems.forEach((item) => {
      item.addEventListener("pointermove", (event) => {
        const rect = item.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        item.style.setProperty("--motion-depth-x", `${x * 8}px`);
        item.style.setProperty("--motion-depth-y", `${y * 8}px`);
      });

      item.addEventListener("pointerleave", () => {
        item.style.setProperty("--motion-depth-x", "0px");
        item.style.setProperty("--motion-depth-y", "0px");
      });
    });
  }

  const navLinks = [...document.querySelectorAll('.site-nav-links a[href^="#"]')];
  const observedSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if ("IntersectionObserver" in window && observedSections.length) {
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;

        navLinks.forEach((link) => {
          const active = link.getAttribute("href") === `#${visible.target.id}`;
          if (active) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.1, 0.5] },
    );
    observedSections.forEach((section) => sectionObserver.observe(section));
  }

  const photoScroller = document.getElementById("slider-section");
  const photoTrack = document.getElementById("image-track");

  if (photoScroller && photoTrack) {
    const photoImages = [...photoTrack.querySelectorAll(".image-card")];
    const photoFrames = photoImages.map((image) => {
      const frame = document.createElement("div");
      frame.className = "image-card-wrap";
      image.before(frame);
      frame.append(image);
      return frame;
    });

    let pointerDownAt = null;
    let pointerId = null;
    let translate = 0;
    let previousTranslate = 0;
    let currentTranslate = 0;
    let minTranslate = 0;
    let imageOffsets = [];
    let animationFrame = null;

    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    const lerp = (start, end, factor) => start + (end - start) * factor;

    const updateBounds = () => {
      imageOffsets = photoFrames.map((frame, index) => ({
        element: photoImages[index],
        offsetLeft: frame.offsetLeft,
      }));
      const lastFrame = photoFrames.at(-1);
      minTranslate = lastFrame
        ? -(lastFrame.offsetLeft - photoFrames[0].offsetLeft)
        : 0;
      translate = clamp(translate, minTranslate, 0);
      previousTranslate = translate;
    };

    const updateFromPointer = (clientX) => {
      if (pointerDownAt === null) return;
      translate = clamp(
        previousTranslate - (pointerDownAt - clientX),
        minTranslate,
        0,
      );
    };

    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(update);
    };

    const finishDrag = (event) => {
      if (pointerId !== null && event?.pointerId !== pointerId) return;
      pointerDownAt = null;
      pointerId = null;
      previousTranslate = translate;
      photoScroller.classList.remove("is-dragging");
      scheduleUpdate();
    };

    photoScroller.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      updateBounds();
      pointerDownAt = event.clientX;
      pointerId = event.pointerId;
      previousTranslate = translate;
      photoScroller.classList.add("is-dragging");
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

    photoScroller.addEventListener(
      "wheel",
      (event) => {
        if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;
        event.preventDefault();
        updateBounds();
        translate = clamp(translate - event.deltaX * 0.85, minTranslate, 0);
        previousTranslate = translate;
        scheduleUpdate();
      },
      { passive: false },
    );

    photoScroller.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      updateBounds();
      const step = Math.round(
        window.innerWidth * (event.shiftKey ? 0.22 : 0.08),
      );
      const direction = event.key === "ArrowRight" ? -1 : 1;
      translate = clamp(translate + step * direction, minTranslate, 0);
      previousTranslate = translate;
      scheduleUpdate();
    });

    window.addEventListener("resize", () => {
      updateBounds();
      scheduleUpdate();
    });
    window.addEventListener("load", () => {
      updateBounds();
      scheduleUpdate();
    });

    const update = () => {
      animationFrame = null;
      const difference = Math.abs(currentTranslate - translate);
      currentTranslate = reducedMotion.matches
        ? translate
        : lerp(currentTranslate, translate, 0.08);

      photoTrack.style.transform = `translate3d(${currentTranslate}px, -50%, 0)`;

      const halfWidth = window.innerWidth / 2;
      imageOffsets.forEach(({ element, offsetLeft }) => {
        const distance = currentTranslate + offsetLeft;
        const normalized = clamp(distance / halfWidth, -1.5, 1.5);
        const parallax = reducedMotion.matches ? 0 : normalized * 13;
        element.style.setProperty("--parallax-x", `${parallax}%`);
      });

      if (difference > 0.08 || pointerDownAt !== null) scheduleUpdate();
    };

    reducedMotion.addEventListener("change", scheduleUpdate);
    updateBounds();
    scheduleUpdate();
  }
})();
