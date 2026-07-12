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
  const photoImages = photoScroller
    ? [...photoScroller.querySelectorAll(".image-card")]
    : [];
  const photoPrev = document.getElementById("photo-prev");
  const photoNext = document.getElementById("photo-next");
  const photoProgress = document.getElementById("photo-progress");
  let photoUpdateFrame = null;

  const getPhotoStep = () => {
    if (!photoImages.length) return 0;
    const track = document.getElementById("image-track");
    const gap = track ? Number.parseFloat(getComputedStyle(track).columnGap) || 0 : 0;
    return photoImages[0].getBoundingClientRect().width + gap;
  };

  const getActivePhotoIndex = () => {
    if (!photoScroller || !photoImages.length) return 0;
    const scrollerRect = photoScroller.getBoundingClientRect();
    const start = scrollerRect.left + Number.parseFloat(getComputedStyle(photoScroller).paddingLeft);
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    photoImages.forEach((image, index) => {
      const distance = Math.abs(image.getBoundingClientRect().left - start);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  };

  const updatePhotoControls = () => {
    photoUpdateFrame = null;
    if (!photoScroller || !photoImages.length) return;
    const index = getActivePhotoIndex();
    const displayIndex = String(index + 1).padStart(2, "0");
    const total = String(photoImages.length).padStart(2, "0");
    if (photoProgress) photoProgress.textContent = `${displayIndex} / ${total}`;
    if (photoPrev) photoPrev.disabled = photoScroller.scrollLeft <= 2;
    if (photoNext) {
      const end = photoScroller.scrollWidth - photoScroller.clientWidth;
      photoNext.disabled = photoScroller.scrollLeft >= end - 2;
    }
  };

  const schedulePhotoUpdate = () => {
    if (!photoUpdateFrame) {
      photoUpdateFrame = window.requestAnimationFrame(updatePhotoControls);
    }
  };

  const movePhotos = (direction) => {
    if (!photoScroller) return;
    photoScroller.scrollBy({
      left: direction * getPhotoStep(),
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  };

  if (photoScroller && photoImages.length) {
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
    window.addEventListener("resize", schedulePhotoUpdate);
    updatePhotoControls();
  }
})();
