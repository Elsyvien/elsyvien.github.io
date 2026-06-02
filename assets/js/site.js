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

  // Wrap each gallery image in an overflow-hidden container for uniform parallax
  Array.from(track.querySelectorAll(".image-card")).forEach((img) => {
    const wrap = document.createElement("div");
    wrap.className = "image-card-wrap";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);
  });

  let pointerDownAt = null;
  let translate = 0;
  let prevTranslate = 0;
  let currentTranslate = 0;
  let minTranslate = 0;
  let rafId = null;

  const lerp = (start, end, factor) => start + (end - start) * factor;
  const clamp = (value, min, max) => Math.max(Math.min(value, max), min);

  let imageOffsets = [];
  const updateMinTranslate = () => {
    const images = track.querySelectorAll(".image-card-wrap");
    imageOffsets = [];
    if (images.length > 0) {
      images.forEach((wrap) => {
        const img = wrap.querySelector(".image-card");
        if (img) {
          imageOffsets.push({
            element: img,
            offsetLeft: wrap.offsetLeft
          });
        }
      });
      const dist = images[images.length - 1].offsetLeft - images[0].offsetLeft;
      if (dist > 0) {
        minTranslate = -dist;
      }
    }
  };

  // Calculate limits initially, on resize, and on load
  updateMinTranslate();
  window.addEventListener("resize", updateMinTranslate);
  window.addEventListener("load", updateMinTranslate);

  const clampTranslate = (value) => {
    if (minTranslate === 0) {
      updateMinTranslate();
    }
    return clamp(value, minTranslate, 0);
  };

  const updateFromPointer = (clientX) => {
    if (pointerDownAt === null) {
      return;
    }

    const pointerDelta = pointerDownAt - clientX;
    translate = clampTranslate(prevTranslate - pointerDelta);
  };

  const handlePointerUp = () => {
    if (pointerDownAt === null) {
      return;
    }

    pointerDownAt = null;
    prevTranslate = translate;
    sliderSection.classList.remove("is-dragging");
  };

  const scheduleUpdate = () => {
    if (!rafId) {
      rafId = requestAnimationFrame(update);
    }
  };

  sliderSection.addEventListener("mousedown", (event) => {
    updateMinTranslate();
    pointerDownAt = event.clientX;
    prevTranslate = translate;
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
      updateMinTranslate();
      pointerDownAt = event.touches[0].clientX;
      prevTranslate = translate;
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
      updateMinTranslate();
      const sensitivity = 0.85;
      const delta = event.deltaX * sensitivity;
      translate = clampTranslate(translate - delta);
      prevTranslate = translate;
      scheduleUpdate();
    },
    { passive: false },
  );

  sliderSection.addEventListener("keydown", (event) => {
    updateMinTranslate();
    const step = event.shiftKey
      ? Math.round(window.innerWidth * 0.22)
      : Math.round(window.innerWidth * 0.08);

    if (event.key === "ArrowRight") {
      event.preventDefault();
      translate = clampTranslate(translate - step);
      prevTranslate = translate;
      scheduleUpdate();
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      translate = clampTranslate(translate + step);
      prevTranslate = translate;
      scheduleUpdate();
    }
  });

  const IDLE_THRESHOLD = 0.08;

  const update = () => {
    rafId = null;
    if (minTranslate === 0 || imageOffsets.length === 0) {
      updateMinTranslate();
    }
    const diff = Math.abs(currentTranslate - translate);
    currentTranslate = lerp(currentTranslate, translate, 0.08);

    track.style.transform = `translate(${currentTranslate}px, -50%)`;

    // Compute parallax individually for each image based on its viewport-relative position
    const halfWidth = window.innerWidth / 2;
    for (const item of imageOffsets) {
      const dist = currentTranslate + item.offsetLeft;
      const normalizedDist = dist / halfWidth;
      const clamped = Math.max(Math.min(normalizedDist, 1.5), -1.5);
      const parallaxX = clamped * 13; // max 13% shift
      item.element.style.setProperty("--parallax-x", `${parallaxX}%`);
    }

    // Keep animating until we've settled
    if (diff > IDLE_THRESHOLD || pointerDownAt !== null) {
      rafId = requestAnimationFrame(update);
    }
  };

  // Run one frame on load to set initial position
  rafId = requestAnimationFrame(update);

  // 1. Mouse Spotlight Aura Tracking
  if (!reducedMotion.matches && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const root = document.documentElement;
    const aura = document.createElement("div");
    aura.className = "cursor-aura pointer-events-none fixed inset-0 z-30 opacity-0 transition-opacity duration-500";
    document.body.appendChild(aura);

    window.addEventListener("pointermove", (e) => {
      aura.style.opacity = "1";
      root.style.setProperty("--mouse-x", `${e.clientX}px`);
      root.style.setProperty("--mouse-y", `${e.clientY}px`);
    });

    document.body.addEventListener("pointerleave", () => {
      aura.style.opacity = "0";
    });
  }

  // 2. Interactive Skill Tag Highlighting
  const skillPills = document.querySelectorAll(".skill-pill");
  const projectCards = document.querySelectorAll(".project-card");

  skillPills.forEach((pill) => {
    const skill = pill.getAttribute("data-skill");
    if (!skill) return;

    pill.addEventListener("pointerenter", () => {
      projectCards.forEach((card) => {
        const cardSkills = card.getAttribute("data-skills") || "";
        if (cardSkills.split(" ").includes(skill)) {
          card.classList.add("skill-highlight");
        } else {
          card.classList.add("skill-dimmed");
        }
      });
    });

    pill.addEventListener("pointerleave", () => {
      projectCards.forEach((card) => {
        card.classList.remove("skill-highlight");
        card.classList.remove("skill-dimmed");
      });
    });
  });

  // Highlight skills when hovering project cards
  projectCards.forEach((card) => {
    const cardSkills = (card.getAttribute("data-skills") || "").split(" ");
    if (cardSkills.length === 0 || cardSkills[0] === "") return;

    card.addEventListener("pointerenter", () => {
      skillPills.forEach((pill) => {
        const skill = pill.getAttribute("data-skill");
        if (cardSkills.includes(skill)) {
          pill.classList.add("bg-black", "text-white", "dark:bg-white", "dark:text-black", "scale-105");
        } else {
          pill.classList.add("opacity-40");
        }
      });
    });

    card.addEventListener("pointerleave", () => {
      skillPills.forEach((pill) => {
        pill.classList.remove("bg-black", "text-white", "dark:bg-white", "dark:text-black", "scale-105", "opacity-40");
      });
    });
  });

  // 3. Project Filter Tags
  const filterBtns = document.querySelectorAll(".project-filter-btn");
  if (filterBtns.length > 0) {
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => {
          b.classList.remove("bg-black", "text-white", "dark:bg-white", "dark:text-black");
          b.classList.add("border-black/10", "dark:border-white/10");
        });
        btn.classList.add("bg-black", "text-white", "dark:bg-white", "dark:text-black");
        btn.classList.remove("border-black/10", "dark:border-white/10");

        const filters = btn.getAttribute("data-filter").split("-");

        projectCards.forEach((card) => {
          const isSelectedProject = card.closest("#work") !== null;
          if (!isSelectedProject) return;

          const categories = (card.getAttribute("data-project-category") || "").split(" ");

          const matches = filters.includes("all") || categories.some((cat) => filters.includes(cat));
          if (matches) {
            card.classList.remove("is-filtered-out");
          } else {
            card.classList.add("is-filtered-out");
          }
        });
      });
    });
  }
})();
