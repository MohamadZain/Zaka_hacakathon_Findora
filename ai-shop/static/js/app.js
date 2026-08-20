(() => {
  "use strict";

  // ---------------------------------------------------------------------
  // Static config that mirrors the backend catalog structure
  // ---------------------------------------------------------------------
  const SIZE_OPTIONS = {
    shirt: ["S", "M", "L", "XL"],
    pants: ["28", "30", "32", "34", "36"],
    shoes: ["40", "41", "42", "43", "44"],
    bag: ["One Size"],
    watch: ["One Size"],
  };

  const TAB_LABELS = {
    closest_match: "Closest Match",
    best_value: "Best Value",
    best_price: "Best Price",
  };

  const STEP_LABELS = {
    landing: "",
    upload: "Step 1 — Upload",
    sizes: "Step 2 — Sizes",
    budget: "Step 3 — Budget",
    analyze: "Analyzing",
    results: "Your options",
  };

  // ---------------------------------------------------------------------
  // App state
  // ---------------------------------------------------------------------
  const state = {
    referenceImageSrc: "",
    detectedItems: [],       // [{category, label, icon}]
    selected: new Set(),     // category keys
    sizes: {},               // {category: size}
    budget: 250,
    source: "all",           // 'all' | 'online' | 'qatar'
    results: null,           // last /api/recommend or /api/recalculate payload ({tabs, any_in_budget, message})
    activeTab: "closest_match",
  };

  // ---------------------------------------------------------------------
  // Screen navigation
  // ---------------------------------------------------------------------
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("active", el.dataset.screen === name);
    });
    document.getElementById("step-indicator").textContent = STEP_LABELS[name] || "";
    const refThumb = document.getElementById("topbar-ref-thumb");
    const showRef = state.referenceImageSrc && name !== "landing" && name !== "upload";
    refThumb.classList.toggle("hidden", !showRef);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelector('[data-nav="landing"]').addEventListener("click", () => {
    resetFlow();
    showScreen("landing");
  });

  function resetFlow() {
    state.referenceImageSrc = "";
    state.detectedItems = [];
    state.selected = new Set();
    state.sizes = {};
    state.budget = 250;
    state.source = "all";
    state.results = null;
    state.activeTab = "closest_match";
    document.getElementById("file-input").value = "";
    document.getElementById("upload-stage").classList.remove("hidden");
    document.getElementById("detect-stage").classList.add("hidden");
    document.getElementById("topbar-ref-thumb").classList.add("hidden");
    document.querySelectorAll("#source-group .chip").forEach((c) => c.classList.remove("chip--active"));
    document.querySelector('#source-group .chip[data-value="all"]').classList.add("chip--active");
    document.querySelectorAll(".result-tab").forEach((t) => t.classList.remove("result-tab--active"));
    document.querySelector('.result-tab[data-tab="closest_match"]').classList.add("result-tab--active");
  }

  // ---------------------------------------------------------------------
  // SCREEN 1 — Landing
  // ---------------------------------------------------------------------
  document.getElementById("cta-upload").addEventListener("click", () => {
    showScreen("upload");
  });

  // ---------------------------------------------------------------------
  // SCREEN 2 — Upload + Detect + Select
  // ---------------------------------------------------------------------
  const fileInput = document.getElementById("file-input");
  const dropzone = document.getElementById("dropzone");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => beginDetection(e.target.result);
    reader.readAsDataURL(file);
  });

  ["dragover", "dragenter"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "var(--accent)";
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.style.borderColor = "";
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => beginDetection(ev.target.result);
    reader.readAsDataURL(file);
  });

  document.getElementById("use-demo-image").addEventListener("click", () => {
    // beginDetection("/static/images/demo-look.svg");
       beginDetection("/static/images/reference_image.jfif");

  });

  function beginDetection(imageSrc) {
    state.referenceImageSrc = imageSrc;
    document.getElementById("uploaded-preview").src = imageSrc;
    const refThumb = document.getElementById("topbar-ref-thumb");
    refThumb.src = imageSrc;
    document.getElementById("upload-stage").classList.add("hidden");
    document.getElementById("detect-stage").classList.remove("hidden");

    fetch("/api/analyze", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        state.detectedItems = data.items;
        state.selected = new Set();
        renderItemList(data.items, data.confident);
      })
      .catch(() => {
        // graceful fallback so the demo never dead-ends
        const fallback = [
          { category: "shirt", label: "Shirt", icon: "👕" },
          { category: "pants", label: "Pants", icon: "👖" },
        ];
        renderItemList(fallback, false);
      });
  }

  function renderItemList(items, confident) {
    const list = document.getElementById("item-list");
    list.innerHTML = "";
    document.getElementById("low-confidence-note").classList.toggle("hidden", confident);

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "item-row";
      li.dataset.category = item.category;
      li.innerHTML = `
        <span class="item-row__check">✓</span>
        <span class="item-row__icon">${item.icon}</span>
        <span class="item-row__label">${item.label}</span>
      `;
      li.addEventListener("click", () => {
        if (state.selected.has(item.category)) {
          state.selected.delete(item.category);
          li.classList.remove("selected");
        } else {
          state.selected.add(item.category);
          li.classList.add("selected");
        }
        document.getElementById("cta-continue-to-sizes").disabled = state.selected.size === 0;
      });
      list.appendChild(li);
    });
  }

  document.getElementById("cta-continue-to-sizes").addEventListener("click", () => {
    buildSizeScreen();
    showScreen("sizes");
  });

  // ---------------------------------------------------------------------
  // SCREEN 3 — Sizes
  // ---------------------------------------------------------------------
  function buildSizeScreen() {
    const container = document.getElementById("size-groups");
    container.innerHTML = "";
    state.sizes = {};

    state.detectedItems
      .filter((item) => state.selected.has(item.category))
      .forEach((item) => {
        const options = SIZE_OPTIONS[item.category] || ["One Size"];
        const group = document.createElement("div");
        group.className = "size-group";
        group.innerHTML = `<p class="size-group__label">${item.label}</p>
          <div class="size-options" data-category="${item.category}"></div>`;
        container.appendChild(group);

        const optWrap = group.querySelector(".size-options");
        options.forEach((size) => {
          const pill = document.createElement("button");
          pill.className = "size-pill";
          pill.type = "button";
          pill.textContent = size;
          pill.addEventListener("click", () => {
            optWrap.querySelectorAll(".size-pill").forEach((p) => p.classList.remove("selected"));
            pill.classList.add("selected");
            state.sizes[item.category] = size;
            checkSizesComplete();
          });
          optWrap.appendChild(pill);
        });

        // auto-select single "One Size" categories
        if (options.length === 1) {
          optWrap.firstChild.classList.add("selected");
          state.sizes[item.category] = options[0];
        }
      });

    checkSizesComplete();
  }

  function checkSizesComplete() {
    const allSet = [...state.selected].every((cat) => state.sizes[cat]);
    document.getElementById("cta-sizes-continue").disabled = !allSet;
  }

  document.getElementById("cta-sizes-continue").addEventListener("click", () => {
    showScreen("budget");
  });

  // ---------------------------------------------------------------------
  // SCREEN 4 — Budget + Shopping Source
  // ---------------------------------------------------------------------
  const budgetRange = document.getElementById("budget-range");
  const budgetValue = document.getElementById("budget-value");
  budgetRange.addEventListener("input", () => {
    state.budget = parseInt(budgetRange.value, 10);
    budgetValue.textContent = state.budget;
  });

  document.querySelectorAll("#source-group .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#source-group .chip").forEach((c) => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
      state.source = chip.dataset.value;
    });
  });

  document.getElementById("cta-find-options").addEventListener("click", () => {
    showScreen("analyze");
    runAnalyzeAnimation(fetchRecommendations);
  });

  // ---------------------------------------------------------------------
  // SCREEN 5 — Analyze (simulated locally, no external AI calls)
  // ---------------------------------------------------------------------
  function runAnalyzeAnimation(onComplete) {
    const items = document.querySelectorAll("#analyze-checklist li");
    items.forEach((li) => li.classList.remove("done"));
    items.forEach((li) => {
      const delay = parseInt(li.dataset.delay, 10);
      setTimeout(() => li.classList.add("done"), delay);
    });
    const totalDelay = Math.max(...Array.from(items).map((li) => parseInt(li.dataset.delay, 10))) + 500;
    setTimeout(onComplete, totalDelay);
  }

  function fetchRecommendations() {
    const body = {
      items: [...state.selected],
      sizes: state.sizes,
      budget: state.budget,
      source: state.source,
    };
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          showScreen("budget");
          return;
        }
        state.results = data;
        state.activeTab = "closest_match";
        document.querySelectorAll(".result-tab").forEach((t) =>
          t.classList.toggle("result-tab--active", t.dataset.tab === "closest_match")
        );
        renderResults();
        showScreen("results");
        // sync the second budget slider
        document.getElementById("budget-range-2").value = state.budget;
        document.getElementById("budget-value-2").textContent = state.budget;
      });
  }

  // ---------------------------------------------------------------------
  // SCREEN 6 — Results
  // ---------------------------------------------------------------------
  function renderResults() {
    renderSummaryStrip();
    renderRecalcBanner();
    renderResultCards(state.results.tabs[state.activeTab]);
  }

  function renderRecalcBanner() {
    const banner = document.getElementById("recalc-banner");
    if (state.results.message) {
      banner.textContent = state.results.message;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  function renderSummaryStrip() {
    const strip = document.getElementById("summary-strip");
    const labels = state.detectedItems
      .filter((i) => state.selected.has(i.category))
      .map((i) => i.label);
    const sizesText = [...state.selected]
      .map((cat) => `${capitalize(cat)}: <strong>${state.sizes[cat]}</strong>`)
      .join(" &nbsp;·&nbsp; ");

    strip.innerHTML = `
      <span>${labels.join(" + ")}</span>
      <span>${sizesText}</span>
      <span>Budget: <strong>${state.budget} QAR</strong></span>
    `;
  }

  document.querySelectorAll(".result-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll(".result-tab").forEach((t) => t.classList.remove("result-tab--active"));
      tabBtn.classList.add("result-tab--active");
      state.activeTab = tabBtn.dataset.tab;
      renderResultCards(state.results.tabs[state.activeTab]);
    });
  });

  function renderResultCards(results) {
    const wrap = document.getElementById("result-cards");
    wrap.innerHTML = "";

    results.forEach((res) => {
      const isHero = res.rank === 1;
      const card = document.createElement("div");
      card.className = "result-card" + (isHero ? " result-card--hero" : "");

      const itemLines = res.items
        .map(
          (p) => `
        <div class="item-line" data-product-id="${p.id}">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
          <div>
            <div class="item-line__name">${p.name}</div>
            <div class="item-line__meta">${p.retailer} · ${p.color}</div>
          </div>
        </div>`
        )
        .join("");

      card.innerHTML = `
        <div class="result-card__badge"><span class="rank-badge">#${res.rank}</span>${res.visual_match}% Visual Match</div>
        ${itemLines}
        <hr class="result-card__divider">
        <div class="result-card__total">
          <span class="result-card__total-label">Total</span>
          <span class="result-card__total-value">${res.total_price} ${res.currency}</span>
        </div>
        ${res.over_budget ? `<div class="result-card__over">Closest option — above your ${state.budget} QAR budget</div>` : ""}
        <button class="btn btn--primary view-products-btn">View Products</button>
      `;

      card.querySelector(".view-products-btn").addEventListener("click", () => openComboModal(res));
      card.querySelectorAll(".item-line").forEach((line) => {
        line.addEventListener("click", () => {
          const product = res.items.find((p) => p.id === line.dataset.productId);
          openComboModal(res, product.id);
        });
      });

      wrap.appendChild(card);
    });
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // recalculate
  const budgetRange2 = document.getElementById("budget-range-2");
  const budgetValue2 = document.getElementById("budget-value-2");
  budgetRange2.addEventListener("input", () => {
    budgetValue2.textContent = budgetRange2.value;
  });

  document.getElementById("cta-recalculate").addEventListener("click", () => {
    const newBudget = parseInt(budgetRange2.value, 10);
    const oldBudget = state.budget;
    const body = {
      items: [...state.selected],
      sizes: state.sizes,
      old_budget: oldBudget,
      new_budget: newBudget,
      source: state.source,
    };
    fetch("/api/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          alert(data.error);
          return;
        }
        state.budget = newBudget;
        state.results = data;
        renderResults();
      });
  });

  // shop online / shop in store toggle
  document.querySelectorAll("#mode-toggle .mode-toggle__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#mode-toggle .mode-toggle__btn").forEach((b) => b.classList.remove("mode-toggle__btn--active"));
      btn.classList.add("mode-toggle__btn--active");
      const mode = btn.dataset.mode;
      document.getElementById("results-online").classList.toggle("hidden", mode !== "online");
      document.getElementById("results-store").classList.toggle("hidden", mode !== "store");
      if (mode === "store") loadMalls();
    });
  });

  let mallsLoaded = false;
  function loadMalls() {
    if (mallsLoaded) return;
    fetch("/api/malls")
      .then((r) => r.json())
      .then((malls) => {
        const list = document.getElementById("mall-list");
        list.innerHTML = malls
          .map(
            (m) => `
          <div class="mall-card">
            <div class="mall-card__name">${m.name}</div>
            <div class="mall-card__retailers">${m.retailers.join(" · ")}</div>
          </div>`
          )
          .join("");
        mallsLoaded = true;
      });
  }

  document.getElementById("cta-start-over").addEventListener("click", () => {
    resetFlow();
    showScreen("landing");
  });

  // ---------------------------------------------------------------------
  // Product detail modal
  // ---------------------------------------------------------------------
  const modalOverlay = document.getElementById("product-modal");
  document.getElementById("modal-close").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  function closeModal() {
    modalOverlay.classList.add("hidden");
  }

  function openComboModal(res, focusProductId) {
    const content = document.getElementById("modal-content");
    const items = focusProductId ? res.items.filter((p) => p.id === focusProductId).concat(res.items.filter((p) => p.id !== focusProductId)) : res.items;

    content.innerHTML = items
      .map(
        (p, idx) => `
      <div>
        <img src="${p.image}" alt="${p.name}">
        <div class="modal__body">
          <div class="modal__retailer">${p.retailer}</div>
          <h3 class="modal__name">${p.name}</h3>
          <div class="modal__specs">
            <div><div class="modal__spec-label">Size</div><div class="modal__spec-value">${state.sizes[p.category] || "—"}</div></div>
            <div><div class="modal__spec-label">Color</div><div class="modal__spec-value">${p.color}</div></div>
            <div><div class="modal__spec-label">Visual Match</div><div class="modal__spec-value">${p.visual_match}%</div></div>
            <div><div class="modal__spec-label">Category</div><div class="modal__spec-value">${p.category_label}</div></div>
          </div>
          <div class="modal__price">${p.price} ${p.currency}</div>
          <a class="btn btn--primary" href="${p.product_url}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;">View Product</a>
        </div>
      </div>
      ${idx < items.length - 1 ? '<hr class="result-card__divider" style="margin:0 28px;">' : ""}
    `
      )
      .join("");

    modalOverlay.classList.remove("hidden");
  }
})();
