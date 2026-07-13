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

  const photoScroller = document.getElementById("photo-scroller");
  const photoTrack = document.getElementById("image-track");
  const photoImages = photoScroller
    ? [...photoScroller.querySelectorAll(".image-card")]
    : [];
  const photoPrev = document.getElementById("photo-prev");
  const photoNext = document.getElementById("photo-next");
  const photoProgress = document.getElementById("photo-progress");

  if (photoScroller && photoTrack && photoImages.length) {
    const photoFrames = photoImages.map((image) => {
      const frame = document.createElement("div");
      frame.className = "photo-frame";
      image.before(frame);
      frame.append(image);
      return frame;
    });

    photoScroller.classList.add("is-parallax");

    let photoUpdateFrame = null;
    let lastPhotoIndex = -1;
    let dragPointerId = null;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let dragTarget = 0;
    let dragCurrent = 0;
    let dragFrame = null;

    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    const lerp = (start, end, factor) => start + (end - start) * factor;

    const updateEdgePadding = () => {
      const edge = Math.max(
        20,
        (photoScroller.clientWidth - photoFrames[0].offsetWidth) / 2,
      );
      photoScroller.style.setProperty("--photo-edge-padding", `${edge}px`);
    };

    const getActivePhotoIndex = (frameRects = null) => {
      const scrollerRect = photoScroller.getBoundingClientRect();
      const center = scrollerRect.left + scrollerRect.width / 2;
      const rects = frameRects || photoFrames.map((frame) => frame.getBoundingClientRect());
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      rects.forEach((rect, index) => {
        const distance = Math.abs(rect.left + rect.width / 2 - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });

      return bestIndex;
    };

    const updatePhotoGallery = () => {
      photoUpdateFrame = null;
      const scrollerRect = photoScroller.getBoundingClientRect();
      const frameRects = photoFrames.map((frame) => frame.getBoundingClientRect());
      const index = getActivePhotoIndex(frameRects);

      if (index !== lastPhotoIndex) {
        lastPhotoIndex = index;
        const displayIndex = String(index + 1).padStart(2, "0");
        const total = String(photoImages.length).padStart(2, "0");
        if (photoProgress) photoProgress.textContent = `${displayIndex} / ${total}`;
      }

      if (photoPrev) photoPrev.disabled = photoScroller.scrollLeft <= 2;
      if (photoNext) {
        const end = photoScroller.scrollWidth - photoScroller.clientWidth;
        photoNext.disabled = photoScroller.scrollLeft >= end - 2;
      }

      const scrollerCenter = scrollerRect.left + scrollerRect.width / 2;
      const strength = precisePointer.matches ? 10 : 6;
      photoImages.forEach((image, imageIndex) => {
        let offset = 0;
        if (!reducedMotion.matches) {
          const rect = frameRects[imageIndex];
          const frameCenter = rect.left + rect.width / 2;
          const travel = (scrollerRect.width + rect.width) / 2;
          offset = clamp((frameCenter - scrollerCenter) / travel, -1, 1) * strength;
        }
        image.style.setProperty("--photo-parallax-x", `${offset}%`);
      });
    };

    const schedulePhotoUpdate = () => {
      if (!photoUpdateFrame) {
        photoUpdateFrame = window.requestAnimationFrame(updatePhotoGallery);
      }
    };

    const movePhotos = (direction) => {
      const currentIndex = getActivePhotoIndex();
      const nextIndex = clamp(currentIndex + direction, 0, photoFrames.length - 1);
      const frame = photoFrames[nextIndex];
      const left = frame.offsetLeft + frame.offsetWidth / 2 - photoScroller.clientWidth / 2;
      photoScroller.scrollTo({
        left,
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
    };

    const updateDrag = () => {
      dragFrame = null;
      const difference = dragTarget - dragCurrent;
      dragCurrent = reducedMotion.matches
        ? dragTarget
        : lerp(dragCurrent, dragTarget, 0.18);
      photoScroller.scrollLeft = dragCurrent;

      if (Math.abs(difference) > 0.15) {
        dragFrame = window.requestAnimationFrame(updateDrag);
      }
    };

    const scheduleDrag = () => {
      if (!dragFrame) dragFrame = window.requestAnimationFrame(updateDrag);
    };

    const finishDrag = (event) => {
      if (event.pointerId !== dragPointerId) return;
      dragPointerId = null;
      photoScroller.classList.remove("is-dragging");
      scheduleDrag();
    };

    photoPrev?.addEventListener("click", () => movePhotos(-1));
    photoNext?.addEventListener("click", () => movePhotos(1));
    photoScroller.addEventListener("scroll", schedulePhotoUpdate, { passive: true });
    photoScroller.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        movePhotos(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        movePhotos(-1);
      }
    });

    photoScroller.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragPointerId = event.pointerId;
      dragStartX = event.clientX;
      dragStartScroll = photoScroller.scrollLeft;
      dragTarget = dragStartScroll;
      dragCurrent = dragStartScroll;
      photoScroller.classList.add("is-dragging");
      photoScroller.setPointerCapture(event.pointerId);
    });

    photoScroller.addEventListener("pointermove", (event) => {
      if (event.pointerId !== dragPointerId) return;
      event.preventDefault();
      const end = photoScroller.scrollWidth - photoScroller.clientWidth;
      dragTarget = clamp(dragStartScroll + dragStartX - event.clientX, 0, end);
      scheduleDrag();
    });

    photoScroller.addEventListener("pointerup", finishDrag);
    photoScroller.addEventListener("pointercancel", finishDrag);
    photoScroller.addEventListener("lostpointercapture", (event) => {
      if (event.pointerId === dragPointerId) finishDrag(event);
    });

    window.addEventListener("resize", () => {
      updateEdgePadding();
      schedulePhotoUpdate();
    });

    reducedMotion.addEventListener("change", schedulePhotoUpdate);
    updateEdgePadding();
    updatePhotoGallery();
  }
})();
