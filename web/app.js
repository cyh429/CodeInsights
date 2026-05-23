const langToggles = document.querySelectorAll("[data-lang-toggle]");

function syncLanguageState(nextLang) {
  document.body.dataset.lang = nextLang;
  document.documentElement.lang = nextLang === "zh" ? "zh-CN" : "en";

  langToggles.forEach((toggle) => {
    toggle.textContent = nextLang === "zh" ? "EN" : "中文";
  });
}

langToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const nextLang = document.body.dataset.lang === "zh" ? "en" : "zh";
    syncLanguageState(nextLang);
  });
});

const revealNodes = document.querySelectorAll("[data-reveal]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (prefersReducedMotion) {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
} else if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealNodes.forEach((node) => observer.observe(node));
} else {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
}

syncLanguageState(document.body.dataset.lang || "zh");
