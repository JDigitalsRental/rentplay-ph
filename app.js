
/*
 RENTPLAY PH — CINEMATIC EDITION V2
 Customer Website

 V2:
 - Game cover image URLs
 - Featured banner images
 - Search and filters
 - Favorites
 - Trophy / Non-Trophy availability
 - View Details
 - Rental inquiry

 Firebase is not connected yet.
*/

"use strict";

const CONFIG = {
  facebookPage: "",
  // Rental prices are defined in RENTPLAY_PRICES / RENTPLAY_UNLI_SWAP,
  currency: "PHP"
};

// Populated from the shared public Firestore catalog; never use demo availability.
let GAMES = [];
let FEATURED = [];
let catalogReady = false;
let catalogError = false;
let latestWaitingCounts = {};

// RENTPLAY-only prices. Key by Firestore document ID OR normalized game title.
// Enter actual RENTPLAY PH rates here; null means "Price to be confirmed".
// Each slot can have different prices. These values never write to JDigitalsRental.
const RENTPLAY_PRICES = {
  // Example (replace with actual approved prices):
  // "ff7": {
  //   trophy: {week: null, twoWeeks: null, month: null, unliSwap: null},
  //   nonTrophy: {week: null, twoWeeks: null, month: null, unliSwap: null}
  // }
};
const RENTPLAY_UNLI_SWAP = {
  trophy: null, // enter RENTPLAY monthly Trophy UNLI SWAP rate
  nonTrophy: null // enter RENTPLAY monthly Non-Trophy UNLI SWAP rate
};
function normalizedTitle(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function slotRented(data, slot) {
  const trophy = slot === "trophy";
  const status = data[trophy ? "trophyStatus" : "nonTrophyStatus"] ?? data[trophy ? "trophyRented" : "nonTrophyRented"];
  if (typeof status === "boolean") return status;
  if (typeof status === "string") {
    const s = status.trim().toLowerCase();
    if (["available", "available now", "false", "open", "vacant"].includes(s)) return false;
    if (["rented", "currently rented", "currently-rented", "true"].includes(s)) return true;
  }
  const date = String(data[trophy ? "trophyDate" : "nonTrophyDate"] || "").trim();
  if (/^(available now|available)$/i.test(date)) return false;
  return String(data.status || "").toLowerCase() === "currently-rented";
}
function liveGame(doc) {
  const data = doc.data();
  const title = String(data.name || data.title || "Untitled Game");
  const priceConfig = RENTPLAY_PRICES[doc.id] || RENTPLAY_PRICES[normalizedTitle(title)] || {};
  const genre = String(data.genre || data.type || "Other");
  const image = String(data.image || "");
  return {
    id: doc.id, title, genre,
    description: String(data.description || data.meta || "PS5 digital game rental"),
    image: /^https:\/\//i.test(image) ? image : (image && !/^(javascript:|data:)/i.test(image) ? new URL(image, document.baseURI).href : ""),
    colors: ["#23446c", "#111525", "#8a3548"],
    trophy: !slotRented(data, "trophy"),
    nonTrophy: !slotRented(data, "nonTrophy"),
    slotPrices: priceConfig,
    featured: data.featured !== false,
    requests: 0
  };
}
function onLiveGames(docs) {
  GAMES = docs.filter(d => String(d.data().status || "").toLowerCase() !== "upcoming").map(liveGame);
  catalogReady = true;
  catalogError = false;
  applyWaitingCounts();
}
function applyWaitingCounts() {
  for (const game of GAMES) {
    const count = latestWaitingCounts[game.title] || latestWaitingCounts[game.id] || {};
    game.requests = (Number(count.trophy) || 0) + (Number(count.nonTrophy) || 0);
  }
  refreshLiveView();
}
function onLiveWaitingList(counts) {
  latestWaitingCounts = counts;
  applyWaitingCounts();
}
function refreshLiveView() {
  FEATURED = GAMES.filter(game => game.featured);
  if (state.heroIndex >= FEATURED.length) state.heroIndex = 0;
  renderHero(); renderTrending(); renderGames();
  if (state.currentGame) {
    const updated = GAMES.find(g => g.id === state.currentGame.id);
    if (updated) {
      state.currentGame = updated;
      // Update visible summary without resetting user-entered booking fields.
      if (document.querySelector("#rentalSummary")) updateRentalSummary();
    }
  }
}
window.addEventListener("rentplay:games", event => onLiveGames(event.detail));
window.addEventListener("rentplay:waiting", event => onLiveWaitingList(event.detail));
window.addEventListener("rentplay:error", () => {
  catalogError = true;
  if (!catalogReady) {
    const el = document.querySelector("#emptyState");
    if (el) { el.hidden = false; el.textContent = "Unable to load live games. Please try again later."; }
  }
});

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

    return `linear-gradient(
      0deg,
      rgba(0,0,0,.35),
      transparent
    ),url("${safeURL}")`;
  }

  const colors = game.colors || [
    "#481823",
    "#11121b",
    "#25314b"
  ];

  return `radial-gradient(
      circle at 78% 18%,
      ${colors[0]},
      transparent 65%
    ),
    linear-gradient(
      135deg,
      ${colors[1]},
      ${colors[2]}
    )`;
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
          ${available
            ? "● Available Now"
            : "● Currently Rented"}
        </span>

        <div class="prices">
          <span>🏆 Trophy / 🎮 Non-Trophy</span>
          <span>See separate prices in View Details</span>
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
    .filter(game => game.requests > 0)
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
        matchesFilter =
          state.favorites.includes(game.id);
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
      `${games.length} ${
        games.length === 1 ? "Game" : "Games"
      }`;
  }

  const empty = $("#emptyState");

  if (empty) {
    empty.hidden = games.length > 0;
    empty.textContent = catalogError ? "Unable to load live games. Please try again later." : !catalogReady ? "Loading live games…" : "No games match your search.";
  }
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

// FEATURED is refreshed when live games change.

function renderHero() {
  if (!FEATURED.length) {
    const title = $("#heroTitle");
    if (title) title.textContent = catalogReady ? "Explore our game collection" : "Loading live games…";
    return;
  }

  const game = FEATURED[state.heroIndex];

  const art = $("#heroArt");
  const title = $("#heroTitle");
  const desc = $("#heroDesc");
  const dots = $("#heroDots");

  if (art) {
    art.style.backgroundImage = gameBackground(game);
  }

  if (title) {
    title.textContent = game.title;
  }

  if (desc) {
    desc.textContent = game.description;
  }

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
      <span style="color:${
        available ? "#42f5a1" : "#ff6974"
      }">
        ${available
          ? "● Available Now"
          : "● Currently Rented"}
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
      ">
        ${escapeHTML(game.title)}
      </div>
    `;

  body.innerHTML = `
    <div
      class="modal-cover"
      style="
        background-image:${gameBackground(game)};
        position:relative
      "
    >
      ${coverText}
    </div>

    <div class="modal-info">
      <span class="kicker">
        ${escapeHTML(game.genre)} · PS5 DIGITAL
      </span>

      <h2 id="modalTitle">
        ${escapeHTML(game.title)}
      </h2>

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
            <option value="Trophy">
              Trophy
            </option>
            <option value="Non-Trophy">
              Non-Trophy
            </option>
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

        <div
          class="full"
          id="rentalSummary"
          style="
            background:#0d1017;
            border:1px solid #454853;
            border-radius:10px;
            padding:14px;
          "
        ></div>

        <button
          type="submit"
          class="btn primary booking-submit full"
        >
          💬 Continue to Messenger
        </button>
      </form>

      <p class="notice">
        Live availability is shared with JDigitalsRental.
        RENTPLAY PH prices and booking are subject to confirmation.
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

  if (modal) {
    modal.hidden = true;
  }

  document.body.style.overflow = "";
  state.currentGame = null;
}

function getSelectedPrice(game, period, slot) {
  const key = slot === "Non-Trophy" ? "nonTrophy" : "trophy";
  const p = game.slotPrices?.[key] || {};
  let value = null;
  if (period === "1 Week") value = p.week;
  if (period === "2 Weeks") value = p.twoWeeks;
  if (period === "1 Month") value = p.month;
  if (period === "UNLI SWAP") value = p.unliSwap ?? RENTPLAY_UNLI_SWAP[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function updateRentalSummary() {
  const game = state.currentGame;
  if (!game) return;

  const slot =
    $("#rentalSlot")?.value || "Trophy";

  const period =
    $("#rentalPeriod")?.value || "1 Week";

  const available =
    slot === "Trophy"
      ? game.trophy
      : game.nonTrophy;

  const price = getSelectedPrice(game, period, slot);

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
      <strong style="color:${
        available ? "#42f5a1" : "#ff6974"
      }">
        ${available
          ? "Available Now"
          : "Currently Rented"}
      </strong>
    </div>

    <div style="
      margin-top:12px;
      font-size:20px;
      font-weight:900;
      color:white;
    ">
      ${price === null
        ? "Price to be confirmed"
        : peso(price)}
    </div>

    <small style="color:#a5a8b5">
      ${available
        ? "Subject to final confirmation."
        : "You can request to join the waiting list."}
    </small>
  `;

  const button = $(
    "#bookingForm button[type='submit']"
  );

  if (button) {
    button.textContent = available
      ? "💬 Request Rental via Messenger"
      : "💬 Join Waiting List via Messenger";
  }
}

function createBookingMessage(
  game,
  name,
  slot,
  period
) {
  const available =
    slot === "Trophy"
      ? game.trophy
      : game.nonTrophy;

  const price = getSelectedPrice(
    game,
    period
  );

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
    `Estimated Price: ${
      price === null
        ? "To be confirmed"
        : peso(price)
    }`,
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
    alert(
      "Please complete your rental details."
    );
    return;
  }

  const message = createBookingMessage(
    game,
    name,
    slot,
    period
  );

  let copied = false;

  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(
        message
      );
      copied = true;
    }
  } catch (error) {
    console.warn(
      "Clipboard permission unavailable.",
      error
    );
  }

  if (!copied) {
    const field =
      document.createElement("textarea");

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
  $("#search")?.addEventListener(
    "input",
    event => {
      state.search =
        event.target.value.trim();

      renderGames();
    }
  );

  $("#filters")?.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest("[data-filter]");

      if (!button) return;

      state.filter =
        button.dataset.filter;

      $$("#filters .chip").forEach(
        chip => {
          chip.classList.toggle(
            "active",
            chip === button
          );
        }
      );

      renderGames();
    }
  );

  document.addEventListener(
    "click",
    event => {
      const favorite =
        event.target.closest(
          "[data-favorite]"
        );

      if (favorite) {
        toggleFavorite(
          favorite.dataset.favorite
        );
        return;
      }

      const details =
        event.target.closest(
          "[data-details]"
        );

      if (details) {
        openDetails(
          details.dataset.details
        );
        return;
      }

      const heroDot =
        event.target.closest(
          "[data-hero]"
        );

      if (heroDot) {
        state.heroIndex = Number(
          heroDot.dataset.hero
        );

        renderHero();
        return;
      }

      if (
        event.target.closest(
          "[data-close]"
        )
      ) {
        closeDetails();
      }
    }
  );

  $("#heroDetails")?.addEventListener(
    "click",
    () => {
      const game =
        FEATURED[state.heroIndex];

      if (game) {
        openDetails(game.id);
      }
    }
  );

  $("#prevHero")?.addEventListener(
    "click",
    () => changeHero(-1)
  );

  $("#nextHero")?.addEventListener(
    "click",
    () => changeHero(1)
  );

  $("#closeModal")?.addEventListener(
    "click",
    closeDetails
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        closeDetails();
      }
    }
  );

  const menuToggle =
    $("#menuToggle");

  const nav = $("#nav");

  menuToggle?.addEventListener(
    "click",
    () => {
      const opened =
        nav?.classList.toggle("open");

      menuToggle.setAttribute(
        "aria-expanded",
        String(Boolean(opened))
      );
    }
  );

  $$("#nav a").forEach(link => {
    link.addEventListener(
      "click",
      () => {
        nav?.classList.remove(
          "open"
        );

        menuToggle?.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    );
  });
}

function initRentPlay() {
  const year = $("#year");

  if (year) {
    year.textContent =
      new Date().getFullYear();
  }

  renderHero();
  renderTrending();
  renderGames();
  setupEvents();
  window.RENTPLAY_FIREBASE?.start?.();

  console.log(
    "RENTPLAY PH Cinematic Edition V2 loaded."
  );
}

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    initRentPlay
  );
} else {
  initRentPlay();
}
