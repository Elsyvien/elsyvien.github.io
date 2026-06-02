(() => {
  const html = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  html.classList.add("motion-ready");

  if (
    localStorage.theme === "dark" ||
    (!("theme" in localStorage) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    html.classList.add("dark");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      themeToggle.classList.add("is-switching");
      html.classList.toggle("dark");
      localStorage.theme = html.classList.contains("dark") ? "dark" : "light";
      window.setTimeout(() => {
        themeToggle.classList.remove("is-switching");
      }, 180);
    });
  }

  // Mobile menu
  const menuToggle = document.getElementById("mobile-menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  if (menuToggle && mobileMenu) {
    let closeTimer = null;

    const openMenu = () => {
      window.clearTimeout(closeTimer);
      mobileMenu.classList.remove("is-closing");
      mobileMenu.classList.add("is-open");
      menuToggle.setAttribute("aria-expanded", "true");
      menuToggle.setAttribute("aria-label", "Close navigation menu");
      document.body.style.overflow = "hidden";
    };

    const closeMenu = () => {
      window.clearTimeout(closeTimer);
      mobileMenu.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation menu");
      document.body.style.overflow = "";

      if (reducedMotion.matches) {
        mobileMenu.classList.remove("is-closing");
        return;
      }

      mobileMenu.classList.add("is-closing");
      closeTimer = window.setTimeout(() => {
        mobileMenu.classList.remove("is-closing");
      }, 260);
    };

    menuToggle.addEventListener("click", () => {
      if (mobileMenu.classList.contains("is-open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close when a nav link is clicked
    mobileMenu.querySelectorAll("[data-mobile-link]").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mobileMenu.classList.contains("is-open")) {
        closeMenu();
        menuToggle.focus();
      }
    });
  }

  // Scroll-triggered animations
  const animatedElements = document.querySelectorAll("[data-animate]");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.style.animationPlayState = "running";
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.25 },
    );

    animatedElements.forEach((el) => observer.observe(el));
  } else {
    animatedElements.forEach((el) => {
      el.style.animationPlayState = "running";
    });
  }

  const revealElements = document.querySelectorAll("[data-reveal]");
  const revealItems = Array.from(revealElements);

  revealItems.forEach((el) => {
    const parentGroup = el.closest("[data-reveal-group]");
    if (!parentGroup) {
      return;
    }

    const index = Array.from(parentGroup.querySelectorAll("[data-reveal]")).indexOf(el);
    el.style.setProperty("--reveal-delay", `${Math.min(index * 80, 240)}ms`);
  });

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((el) => el.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.16 },
    );

    revealItems.forEach((el) => revealObserver.observe(el));
  }

  const depthItems = document.querySelectorAll("[data-motion-depth]");
  if (!reducedMotion.matches && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
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

  // Photo slider
  const track = document.getElementById("image-track");
  const sliderSection = document.getElementById("slider-section");

  if (!track || !sliderSection) {
    return;
  }

  let pointerDownAt = null;
  let prevPercentage = 0;
  let percentage = 0;
  let currentPercentage = 0;
  let rafId = null;

  const lerp = (start, end, factor) => start + (end - start) * factor;
  const clamp = (value, min, max) => Math.max(Math.min(value, max), min);

  const updateFromPointer = (clientX) => {
    if (pointerDownAt === null) {
      return;
    }

    const pointerDelta = pointerDownAt - clientX;
    const maxDelta = window.innerWidth / 2;
    const nextPercentage = (pointerDelta / maxDelta) * -100;
    const nextPercentageUnconstrained = prevPercentage + nextPercentage;

    percentage = clamp(nextPercentageUnconstrained, -100, 0);
  };

  const handlePointerUp = () => {
    if (pointerDownAt === null) {
      return;
    }

    pointerDownAt = null;
    prevPercentage = percentage;
    sliderSection.classList.remove("is-dragging");
  };

  const scheduleUpdate = () => {
    if (!rafId) {
      rafId = requestAnimationFrame(update);
    }
  };

  sliderSection.addEventListener("mousedown", (event) => {
    pointerDownAt = event.clientX;
    sliderSection.classList.add("is-dragging");
    scheduleUpdate();
  });

  window.addEventListener("mousemove", (event) => {
    if (pointerDownAt === null) return;
    updateFromPointer(event.clientX);
    scheduleUpdate();
  });

  window.addEventListener("mouseup", handlePointerUp);

  sliderSection.addEventListener(
    "touchstart",
    (event) => {
      pointerDownAt = event.touches[0].clientX;
      sliderSection.classList.add("is-dragging");
      scheduleUpdate();
    },
    { passive: true },
  );

  sliderSection.addEventListener(
    "touchmove",
    (event) => {
      updateFromPointer(event.touches[0].clientX);
      scheduleUpdate();
    },
    { passive: true },
  );

  sliderSection.addEventListener("touchend", handlePointerUp, { passive: true });
  sliderSection.addEventListener("touchcancel", handlePointerUp, {
    passive: true,
  });

  sliderSection.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
        return;
      }

      event.preventDefault();
      const sensitivity = 0.15;
      const delta = event.deltaX * sensitivity;
      percentage = clamp(percentage - delta, -100, 0);
      prevPercentage = percentage;
      scheduleUpdate();
    },
    { passive: false },
  );

  sliderSection.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 4;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      percentage = clamp(percentage - step, -100, 0);
      prevPercentage = percentage;
      scheduleUpdate();
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      percentage = clamp(percentage + step, -100, 0);
      prevPercentage = percentage;
      scheduleUpdate();
    }
  });

  const IDLE_THRESHOLD = 0.01;

  const update = () => {
    rafId = null;
    const diff = Math.abs(currentPercentage - percentage);
    currentPercentage = lerp(currentPercentage, percentage, 0.1);

    track.style.transform = `translate(${currentPercentage}%, -50%)`;

    const images = track.getElementsByClassName("image-card");
    for (const image of images) {
      image.style.objectPosition = `${100 + currentPercentage}% center`;
    }

    // Keep animating until we've settled
    if (diff > IDLE_THRESHOLD || pointerDownAt !== null) {
      rafId = requestAnimationFrame(update);
    }
  };

  // Run one frame on load to set initial position
  rafId = requestAnimationFrame(update);
})();
