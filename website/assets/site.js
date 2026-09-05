(() => {
  const body = document.body;
  const root = body.dataset.root || "./";
  const page = body.dataset.page || "";
  const path = (value) => `${root}${value}`;

  const header = document.querySelector("[data-site-header]");
  if (header) {
    header.className = "site-header";
    header.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="container nav-shell">
        <a class="brand" href="${path("index.html")}" aria-label="Threatwatch home">
          <span class="brand-mark" aria-hidden="true"><span class="brand-dot"></span></span>
          <span>Threatwatch</span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-label="Open navigation">Menu</button>
        <nav class="nav-links" aria-label="Primary">
          <a href="${path("index.html")}" data-nav="home">Home</a>
          <a href="${path("help/index.html")}" data-nav="help">Help</a>
          <a href="${path("faq/index.html")}" data-nav="faq">FAQ</a>
          <a href="${path("safety/index.html")}" data-nav="safety">Safety</a>
          <a href="${path("changelog/index.html")}" data-nav="changelog">Changelog</a>
          <a class="nav-cta" href="https://github.com/MrMalkio/Threatwatch" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>`;

    const current = header.querySelector(`[data-nav="${page}"]`);
    current?.setAttribute("aria-current", "page");

    const toggle = header.querySelector(".nav-toggle");
    const nav = header.querySelector(".nav-links");
    toggle?.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  const footer = document.querySelector("[data-site-footer]");
  if (footer) {
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="container footer-grid">
        <div>
          <a class="brand" href="${path("index.html")}">
            <span class="brand-mark" aria-hidden="true"><span class="brand-dot"></span></span>
            <span>Threatwatch</span>
          </a>
          <p class="footer-note">Watching for threats while you watch. Threatwatch is a browser safety tool, not a streaming service, content host, antivirus replacement, or legal-status validator.</p>
        </div>
        <div><h3>Product</h3><div class="footer-links"><a href="${path("help/index.html")}">Help center</a><a href="${path("faq/index.html")}">FAQ</a><a href="${path("safety/index.html")}">Safety model</a><a href="${path("changelog/index.html")}">Changelog</a></div></div>
        <div><h3>Legal</h3><div class="footer-links"><a href="${path("legal/privacy.html")}">Privacy</a><a href="${path("legal/terms.html")}">Terms</a><a href="${path("legal/acceptable-use.html")}">Acceptable use</a></div></div>
        <div><h3>Project</h3><div class="footer-links"><a href="https://github.com/MrMalkio/Threatwatch" target="_blank" rel="noreferrer">Source code</a><a href="https://github.com/MrMalkio/Threatwatch/issues" target="_blank" rel="noreferrer">Issues</a><a href="https://github.com/MrMalkio/Threatwatch/security" target="_blank" rel="noreferrer">Security</a></div></div>
      </div>
      <div class="container footer-bottom"><span>Threatwatch Project · 2026</span><span>Free and open source · MIT licensed software</span></div>`;
  }
})();
