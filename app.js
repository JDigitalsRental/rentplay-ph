
/*
 RENTPLAY PH — CINEMATIC EDITION V1
 Customer Website
 Standalone demo — Firebase integration follows.

 IMPORTANT:
 Add your Facebook Page URL in CONFIG.
 Demo availability is not live rental data.
*/

"use strict";

const CONFIG = {
  facebookPage: "",
  unliSwapMonthly: 850,
  currency: "PHP"
};

/*
 GAME CATALOG

 Images can be added using public HTTPS URLs.
 Leave image blank to use cinematic gradient artwork.

 Prices and availability below are DEMO values.
 Update from Firebase before accepting live rentals.
*/

const GAMES = [
  {
    id: "ff7",
    title: "Final Fantasy VII Rebirth",
    genre: "RPG",
    description:
      "Embark on an unforgettable adventure across a vast world filled with exploration, memorable characters, and exciting battles.",
    week: 250,
    twoWeeks: null,
    month: 500,
    trophy: true,
    nonTrophy: true,
    image: "",
    colors: ["#23446c", "#111525", "#8a3548"],
    featured: true,
    requests: 12
  },
  {
    id: "witcher3",
    title: "The Witcher 3: Wild Hunt – Remastered",
    genre: "Adventure",
    description:
      "Explore a massive fantasy world filled with monsters, meaningful choices, and unforgettable quests.",
    week: 250,
    twoWeeks: null,
    month: 500,
    trophy: true,
    nonTrophy: true,
    image: "",
    colors: ["#42515a", "#10151c", "#354c60"],
    featured: true,
    requests: 8
  },
  {
    id: "wolverine",
    title: "Marvel's Wolverine",
    genre: "Action",
    description:
      "Discover an intense action adventure featuring Wolverine in a thrilling cinematic experience.",
    week: 350,
    twoWeeks: null,
    month: 800,
    trophy: false,
    nonTrophy: false,
    image: "",
    colors: ["#75501b", "#17120f", "#5c2321"],
    featured: true,
    requests: 20
  },
  {
    id: "onimusha",
    title: "Onimusha: Way of the Sword",
    genre: "Action",
    description:
      "Enter a dark samurai adventure featuring fierce sword combat and supernatural enemies.",
    week: 350,
    twoWeeks: null,
    month: 800,
    trophy: false,
    nonTrophy: false,
    image: "",
    colors: ["#633b32", "#151018", "#68211e"],
    featured: true,
    requests: 16
  }
];

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

const state = {
  filter: "all",
  search: "",
  heroIndex: 0,
  currentGame: null,
  favorites: loadFavorites()
};

function loadFavorites() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("rentplayFavorites") || "[]"
    );
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(
      "rentplayFavorites",
      JSON.stringify(state.favorites)
    );
  } catch (error) {
    console.warn("Favorites could not be saved.", error);
  }
}

function peso(amount) {
  if (amount === null || amount === undefined) {
    return "Ask for price";
  }

  return "₱" + Number(amount).toLocaleString("en-PH");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isAvailable(game) {
  return game.trophy || game.nonTrophy;
}

function gameBackground(game) {
  if (game.image && /^https:\/\//i.test(game.image)) {
    const safeURL = game.image
      .replace(/\\/g, "\\\\")
      .replace(/"/g, "%22")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29");

    return `linear-gradient(0deg,rgba(0,0,0,.35),transparent),url("${safeURL}")`;
  }

  const colors = game.colors || [
    "#481823",
    "#11121b",
    "#25314b"
  ];

  return `radial-gradient(circle at 78% 18%,${colors[0]},transparent 65%),
          linear-gradient(135deg,${colors[1]},${colors[2]})`;
}

function gameArt(game) {
  if (game.image) return "";

  return `
    <div class="rentplay-art-title"
         style="
           position:absolute;
           left:12px;
           right:12px;
           bottom:18px;
           z-index:1;
           font-size:clamp(15px,2vw,25px);
           font-weight:1000;
           font-style:italic;
           line-height:1.05;
           letter-spacing:-.5px;
           text-shadow:0 3px 14px #000;
           overflow-wrap:anywhere;
         ">
      ${escapeHTML(game.title)}
    </div>
  `;
}

function favoriteButton(game) {
  const active = state.favorites.includes(game.id);

  return `
    <button
      type="button"
      class="favorite ${active ? "active" : ""}"
      data-favorite="${escapeHTML(game.id)}"
      aria-label="${active ? "Remove favorite" : "Add favorite"}"
      aria-pressed="${active}"
    >${active ? "♥" : "♡"}</button>
  `;
}

function gameCard(game) {
  const available = isAvailable(game);

  return `
    <article class="game-card">
      <div
        class="game-image"
        style="background-image:${gameBackground(game)}"
      >
        <span class="genre">${escapeHTML(game.genre)}</span>
        ${favoriteButton(game)}
        ${gameArt(game)}
      </div>

      <div class="game-content">
        <h3>${escapeHTML(game.title)}</h3>

        <span class="status ${available ? "available" : "rented"}">
          ${available ? "● Available Now" : "● Currently Rented"}
        </span>

        <div class="prices">
          <span><strong>${peso(game.week)}</strong> / Week</span>
          <span><strong>${peso(game.month)}</strong> / Month</span>
        </div>

        <button
          type="button"
          class="details-btn"
          data-details="${escapeHTML(game.id)}"
        >
          ◉ View Details
        </button>
      </div>
    </article>
  `;
}

function renderTrending() {
  const container = $("#trendingGrid");
  if (!container) return;

  const ranked = [...GAMES]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 4);

  container.innerHTML = ranked.map(gameCard).join("");
}

function filteredGames() {
  return GAMES.filter(game => {
    const query = state.search.toLowerCase();

    const matchesSearch =
      game.title.toLowerCase().includes(query) ||
      game.genre.toLowerCase().includes(query);

    let matchesFilter = true;

    switch (state.filter) {
      case "available":
        matchesFilter = isAvailable(game);
        break;

      case "favorites":
        matchesFilter = state.favorites.includes(game.id);
        break;

      case "rpg":
      case "action":
      case "adventure":
        matchesFilter =
          game.genre.toLowerCase() === state.filter;
        break;
    }

    return matchesSearch && matchesFilter;
  });
}

function renderGames() {
  const container = $("#gameGrid");
  if (!container) return;

  const games = filteredGames();

  container.innerHTML = games.map(gameCard).join("");

  const count = $("#gameCount");
  if (count) {
    count.textContent =
      `${games.length} ${games.length === 1 ? "Game" : "Games"}`;
  }

  const empty = $("#emptyState");
  if (empty) empty.hidden = games.length > 0;
}

function toggleFavorite(id) {
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter(
      item => item !== id
    );
  } else {
    state.favorites.push(id);
  }

  saveFavorites();
  renderGames();
  renderTrending();
}

const FEATURED = GAMES.filter(game => game.featured);

function renderHero() {
  if (!FEATURED.length) return;

  const game = FEATURED[state.heroIndex];

  const art = $("#heroArt");
  const title = $("#heroTitle");
  const desc = $("#heroDesc");
  const dots = $("#heroDots");

  if (art) {
    art.style.backgroundImage = gameBackground(game);
  }

  if (title) title.textContent = game.title;
  if (desc) desc.textContent = game.description;

  if (dots) {
    dots.innerHTML = FEATURED.map((item, index) => `
      <button
        type="button"
        data-hero="${index}"
        class="${index === state.heroIndex ? "active" : ""}"
        aria-label="Show ${escapeHTML(item.title)}"
        aria-current="${index === state.heroIndex}"
      ></button>
    `).join("");
  }
}

function changeHero(direction) {
  state.heroIndex =
    (state.heroIndex + direction + FEATURED.length) %
    FEATURED.length;

  renderHero();
}

function slotMarkup(name, available) {
  return `
    <div class="slot">
      <b>${escapeHTML(name)}</b>
      <span style="color:${available ? "#42f5a1" : "#ff6974"}">
        ${available ? "● Available Now" : "● Currently Rented"}
      </span>
    </div>
  `;
}

function openDetails(id) {
  const game = GAMES.find(item => item.id === id);
  if (!game) return;

  state.currentGame = game;

  const modal = $("#modal");
  const body = $("#modalBody");

  if (!modal || !body) return;

  const coverText = game.image
    ? ""
    : `
      <div style="
        position:absolute;
        left:20px;
        right:20px;
        bottom:20px;
        font-size:clamp(24px,5vw,40px);
        font-weight:1000;
        font-style:italic;
        line-height:1.1;
        text-shadow:0 4px 20px #000;
      ">${escapeHTML(game.title)}</div>
    `;

  body.innerHTML = `
    <div
      class="modal-cover"
      style="background-image:${gameBackground(game)};position:relative"
    >
      ${coverText}
    </div>

    <div class="modal-info">
      <span class="kicker">${escapeHTML(game.genre)} · PS5 DIGITAL</span>
      <h2 id="modalTitle">${escapeHTML(game.title)}</h2>
      <p>${escapeHTML(game.description)}</p>

      <h3>Rental Availability</h3>

      <div class="slot-row">
        ${slotMarkup("🏆 Trophy", game.trophy)}
        ${slotMarkup("🎮 Non-Trophy", game.nonTrophy)}
      </div>

      <h3>Choose Your Rental</h3>

      <form id="bookingForm" class="booking-fields">
        <label class="full">
          Your Name
          <input
            id="renterName"
            type="text"
            placeholder="Enter your name"
            maxlength="80"
            required
          >
        </label>

        <label>
          Account Type
          <select id="rentalSlot" required>
            <option value="Trophy">Trophy</option>
            <option value="Non-Trophy">Non-Trophy</option>
          </select>
        </label>

        <label>
          Rental Period
          <select id="rentalPeriod" required>
            <option value="1 Week">1 Week</option>
            <option value="2 Weeks">2 Weeks</option>
            <option value="1 Month">1 Month</option>
            <option value="UNLI SWAP">UNLI SWAP</option>
          </select>
        </label>

        <div class="full" id="rentalSummary"
             style="
               background:#0d1017;
               border:1px solid #454853;
               border-radius:10px;
               padding:14px;
             ">
        </div>

        <button
          type="submit"
          class="btn primary booking-submit full"
        >
          💬 Continue to Messenger
        </button>
      </form>

      <p class="notice">
        Prices and availability shown are demo data until
        live Firebase sync is enabled. Booking is subject
        to confirmation.
      </p>
    </div>
  `;

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  $("#rentalSlot")?.addEventListener(
    "change",
    updateRentalSummary
  );

  $("#rentalPeriod")?.addEventListener(
    "change",
    updateRentalSummary
  );

  $("#bookingForm")?.addEventListener(
    "submit",
    submitBooking
  );

  updateRentalSummary();
}

function closeDetails() {
  const modal = $("#modal");

  if (modal) modal.hidden = true;

  document.body.style.overflow = "";
  state.currentGame = null;
}

function getSelectedPrice(game, period) {
  switch (period) {
    case "1 Week":
      return game.week;

    case "2 Weeks":
      return game.twoWeeks;

    case "1 Month":
      return game.month;

    case "UNLI SWAP":
      return CONFIG.unliSwapMonthly;

    default:
      return null;
  }
}

function updateRentalSummary() {
  const game = state.currentGame;
  if (!game) return;

  const slot = $("#rentalSlot")?.value || "Trophy";
  const period = $("#rentalPeriod")?.value || "1 Week";

  const available =
    slot === "Trophy" ? game.trophy : game.nonTrophy;

  const price = getSelectedPrice(game, period);

  const summary = $("#rentalSummary");
  if (!summary) return;

  summary.innerHTML = `
    <strong style="display:block;margin-bottom:8px">
      Rental Summary
    </strong>

    <div style="font-size:13px;color:#c5c7d1">
      Game: ${escapeHTML(game.title)}<br>
      Slot: ${escapeHTML(slot)}<br>
      Period: ${escapeHTML(period)}<br>
      Availability:
      <strong style="color:${available ? "#42f5a1" : "#ff6974"}">
        ${available ? "Available Now" : "Currently Rented"}
      </strong>
    </div>

    <div style="
      margin-top:12px;
      font-size:20px;
      font-weight:900;
      color:white;
    ">
      ${price === null ? "Price to be confirmed" : peso(price)}
    </div>

    <small style="color:#a5a8b5">
      ${available
        ? "Subject to final confirmation."
        : "You can request to join the waiting list."}
    </small>
  `;

  const button = $("#bookingForm button[type='submit']");

  if (button) {
    button.textContent = available
      ? "💬 Request Rental via Messenger"
      : "💬 Join Waiting List via Messenger";
  }
}

function createBookingMessage(game, name, slot, period) {
  const available =
    slot === "Trophy" ? game.trophy : game.nonTrophy;

  const price = getSelectedPrice(game, period);

  const lines = [
    "Hello RENTPLAY PH! 🎮",
    "",
    available
      ? "I would like to inquire about renting a PS5 game."
      : "I would like to join the waiting list.",
    "",
    `Name: ${name}`,
    `Game: ${game.title}`,
    `Account Type: ${slot}`,
    `Rental Period: ${period}`,
    `Estimated Price: ${price === null ? "To be confirmed" : peso(price)}`,
    "",
    "My name matches my Facebook account.",
    "",
    available
      ? "Please confirm availability and the final rental price. Thank you!"
      : "Please let me know when a slot becomes available. Thank you!"
  ];

  return lines.join("\n");
}

async function submitBooking(event) {
  event.preventDefault();

  const game = state.currentGame;
  if (!game) return;

  const name = $("#renterName")?.value.trim();
  const slot = $("#rentalSlot")?.value;
  const period = $("#rentalPeriod")?.value;

  if (!name || !slot || !period) {
    alert("Please complete your rental details.");
    return;
  }

  const message = createBookingMessage(
    game,
    name,
    slot,
    period
  );

  /*
    Messenger does not reliably support prefilled
    text in every browser.

    Copy the inquiry first, then open the Page.
  */

  let copied = false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(message);
      copied = true;
    }
  } catch (error) {
    console.warn("Clipboard permission unavailable.", error);
  }

  if (!copied) {
    const field = document.createElement("textarea");
    field.value = message;
    field.style.position = "fixed";
    field.style.opacity = "0";

    document.body.appendChild(field);
    field.focus();
    field.select();

    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }

    field.remove();
  }

  if (!CONFIG.facebookPage) {
    window.prompt(
      "Messenger Page is not configured yet. Copy this rental inquiry:",
      message
    );
    return;
  }

  if (!copied) {
    window.prompt(
      "Copy this inquiry before continuing to Facebook:",
      message
    );
  } else {
    alert(
      "Your rental inquiry has been copied!\n\n" +
      "Open our Facebook Page and paste the message in Messenger."
    );
  }

  window.open(
    CONFIG.facebookPage,
    "_blank",
    "noopener,noreferrer"
  );
}

function setupEvents() {
  $("#search")?.addEventListener("input", event => {
    state.search = event.target.value.trim();
    renderGames();
  });

  $("#filters")?.addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    state.filter = button.dataset.filter;

    $$("#filters .chip").forEach(chip => {
      chip.classList.toggle(
        "active",
        chip === button
      );
    });

    renderGames();
  });

  document.addEventListener("click", event => {
    const favorite = event.target.closest("[data-favorite]");

    if (favorite) {
      toggleFavorite(favorite.dataset.favorite);
      return;
    }

    const details = event.target.closest("[data-details]");

    if (details) {
      openDetails(details.dataset.details);
      return;
    }

    const heroDot = event.target.closest("[data-hero]");

    if (heroDot) {
      state.heroIndex = Number(heroDot.dataset.hero);
      renderHero();
      return;
    }

    if (event.target.closest("[data-close]")) {
      closeDetails();
    }
  });

  $("#heroDetails")?.addEventListener("click", () => {
    const game = FEATURED[state.heroIndex];
    if (game) openDetails(game.id);
  });

  $("#prevHero")?.addEventListener("click", () => {
    changeHero(-1);
  });

  $("#nextHero")?.addEventListener("click", () => {
    changeHero(1);
  });

  $("#closeModal")?.addEventListener(
    "click",
    closeDetails
  );

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeDetails();
    }
  });

  const menuToggle = $("#menuToggle");
  const nav = $("#nav");

  menuToggle?.addEventListener("click", () => {
    const opened = nav?.classList.toggle("open");

    menuToggle.setAttribute(
      "aria-expanded",
      String(Boolean(opened))
    );
  });

  $$("#nav a").forEach(link => {
    link.addEventListener("click", () => {
      nav?.classList.remove("open");
      menuToggle?.setAttribute(
        "aria-expanded",
        "false"
      );
    });
  });
}

function initRentPlay() {
  const year = $("#year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  renderHero();
  renderTrending();
  renderGames();
  setupEvents();

  console.log(
    "RENTPLAY PH Cinematic Edition V1 loaded."
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initRentPlay
  );
} else {
  initRentPlay();
}

