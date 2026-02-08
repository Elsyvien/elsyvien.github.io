(() => {
  const html = document.documentElement;
  const themeToggle = document.getElementById("theme-toggle");

  if (
    localStorage.theme === "dark" ||
    (!("theme" in localStorage) &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    html.classList.add("dark");
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      html.classList.toggle("dark");
      localStorage.theme = html.classList.contains("dark") ? "dark" : "light";
    });
  }

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

  const track = document.getElementById("image-track");
  const sliderSection = document.getElementById("slider-section");

  if (!track || !sliderSection) {
    return;
  }

  let pointerDownAt = null;
  let prevPercentage = 0;
  let percentage = 0;
  let currentPercentage = 0;

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

  sliderSection.addEventListener("mousedown", (event) => {
    pointerDownAt = event.clientX;
    sliderSection.classList.add("is-dragging");
  });

  window.addEventListener("mousemove", (event) => {
    updateFromPointer(event.clientX);
  });

  window.addEventListener("mouseup", handlePointerUp);

  sliderSection.addEventListener(
    "touchstart",
    (event) => {
      pointerDownAt = event.touches[0].clientX;
      sliderSection.classList.add("is-dragging");
    },
    { passive: true },
  );

  sliderSection.addEventListener(
    "touchmove",
    (event) => {
      updateFromPointer(event.touches[0].clientX);
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
    },
    { passive: false },
  );

  sliderSection.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 10 : 4;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      percentage = clamp(percentage - step, -100, 0);
      prevPercentage = percentage;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      percentage = clamp(percentage + step, -100, 0);
      prevPercentage = percentage;
    }
  });

  const update = () => {
    currentPercentage = lerp(currentPercentage, percentage, 0.1);
    track.style.transform = `translate(${currentPercentage}%, -50%)`;

    const images = track.getElementsByClassName("image-card");
    for (const image of images) {
      image.style.objectPosition = `${100 + currentPercentage}% center`;
    }

    requestAnimationFrame(update);
  };

  update();
})();
