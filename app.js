/* RENTPLAY PH — image attribute quoting fix V4 (shared Firebase catalog)

 * Replace the entire app.js in the firebase-integration branch.

 * No changes to firebase.js, index.html, styles.css, or JDigitalsRental.

 */

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

  facebookPage: "https://www.facebook.com/share/1Ev2GHidNP/",

  // Rental prices are defined in RENTPLAY_PRICES / RENTPLAY_UNLI_SWAP,

  currency: "PHP"

};

// Populated from the shared public Firestore catalog; never use demo availability.

let GAMES = [];

let FEATURED = [];

let catalogReady = false;

let catalogError = false;

let latestWaitingCounts = {};
let UPCOMING_GAMES = [];

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

// Resolve Firestore cover paths against the JDigitalsRental website,

// NOT the RENTPLAY PH preview/GitHub Pages URL.

// Firestore remains the source of truth: image changes sync automatically.

const JDIGITALS_IMAGE_BASE = "https://jdigitalsrental.github.io/JDigitalsRental/";

function resolveSharedGameImage(value) {

  const raw = String(value || "").trim();

  if (!raw || /^(?:javascript|blob|file):/i.test(raw)) return "";
  // Admin uploads are compressed JPEG data URLs saved directly in Firestore.
  // Only allow base64-encoded raster images; never arbitrary data: payloads.
  if (/^data:/i.test(raw)) {
    return /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[a-z0-9+/]+={0,2}$/i.test(raw) ? raw : "";
  }

  try {

    // Keep full HTTPS URLs (including Firebase Storage URLs) untouched.

    if (/^https:\/\//i.test(raw)) return raw;

    // Protocol-relative links, HTTP links, and unrecognized schemes are not used.

    if (/^(?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(raw)) return "";

    // A path starting /JDigitalsRental/ is already rooted at the GitHub Pages repo.

    if (/^\/JDigitalsRental\//i.test(raw)) {

      return new URL(raw, "https://jdigitalsrental.github.io").href;

    }

    // Relative paths such as assets/cover.jpg and /assets/cover.jpg.

    const cleanPath = raw.replace(/^\.\//, "").replace(/^\/+/, "");

    const url = new URL(cleanPath, JDIGITALS_IMAGE_BASE);

    // Do not allow a relative path to escape the expected image host.

    return url.origin === "https://jdigitalsrental.github.io" && url.pathname.startsWith("/JDigitalsRental/") ? url.href : "";

  } catch (error) {

    console.warn("RENTPLAY image path could not be resolved:", raw, error);

    return "";

  }

}

function liveGame(doc) {

  const data = doc.data();

  const title = String(data.name || data.title || "Untitled Game");

  const priceConfig = RENTPLAY_PRICES[doc.id] || RENTPLAY_PRICES[normalizedTitle(title)] || {};

  const genre = String(data.genre || data.type || "Other");

  const image = resolveSharedGameImage(data.image);

  return {

    id: doc.id, title, genre,

    description: String(data.description || data.meta || "PS5 digital game rental"),

    image,

    colors: ["#23446c", "#111525", "#8a3548"],

    trophy: !slotRented(data, "trophy"),

    nonTrophy: !slotRented(data, "nonTrophy"),

    slotPrices: priceConfig,

    featured: data.featured !== false,

    waiting: { trophy: 0, nonTrophy: 0 },
    requests: 0

  };

}

function onLiveGames(docs) {

  UPCOMING_GAMES = docs.filter(d => String(d.data().status || "").toLowerCase() === "upcoming").map(d => ({
    ...liveGame(d),
    availableDate: d.data().availableDate || "",
    status: "upcoming"
  }));
  GAMES = docs.filter(d => String(d.data().status || "").toLowerCase() !== "upcoming").map(liveGame);

  catalogReady = true;

  catalogError = false;

  applyWaitingCounts();

}

function applyWaitingCounts() {

  for (const game of GAMES) {

    const count = latestWaitingCounts[game.title] || latestWaitingCounts[game.id] || {};

    game.waiting = { trophy: Number(count.trophy) || 0, nonTrophy: Number(count.nonTrophy) || 0 };
    game.requests = game.waiting.trophy + game.waiting.nonTrophy;

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

  renderHero(); renderTrending(); renderGames(); renderRentplayUpcoming();

  if (state.currentGame) {

    const updated = GAMES.find(g => g.id === state.currentGame.id);

    if (updated) {

      state.currentGame = updated;

      // Update visible summary without resetting user-entered booking fields.

      if (document.querySelector("#rentalSummary")) {
          updateRentalSummary();
          const slots = document.querySelectorAll("#modalBody .slot-row .slot b");
          if (slots[0]) slots[0].textContent = "🏆 Trophy · " + (updated.waiting?.trophy ?? 0) + " waiting";
          if (slots[1]) slots[1].textContent = "🎮 Non-Trophy · " + (updated.waiting?.nonTrophy ?? 0) + " waiting";
        }

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

      .replace(/"/g, "%22")

      .replace(/\(/g, "%28")

      .replace(/\)/g, "%29")

      .replace(/'/g, "%27");

    return `linear-gradient(

      0deg,

      rgba(0,0,0,.35),

      transparent

    ),url('${safeURL}')`;

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

// Render a real image element instead of embedding a URL in CSS text.

// This avoids inline-style parsing problems and allows a visible fallback.

function coverImage(game, eager = false) {

  if (!game.image || !/^(?:https:\/\/|data:image\/(?:jpeg|jpg|png|webp|gif);base64,)/i.test(game.image)) return "";

  return `<img src="${escapeHTML(game.image)}" alt="${escapeHTML(game.title)} cover"

    loading="${eager ? "eager" : "lazy"}" decoding="async"

    style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block"

    onerror="this.style.display='none';this.parentElement.querySelector('.rentplay-cover-fallback')?.style.setProperty('display','flex')">`;

}

function coverFallback(game) {

  return `<div class="rentplay-cover-fallback" style="position:absolute;inset:0;display:${game.image ? 'none' : 'flex'};align-items:end;padding:15px;background:linear-gradient(135deg,#23446c,#111525 60%,#8a3548);color:white;font-weight:900;font-size:clamp(15px,2vw,24px);line-height:1.1;text-shadow:0 3px 12px #000">

    ${escapeHTML(game.title)}

  </div>`;

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

function startingPrice(game) {
  const values = [game.slotPrices?.trophy?.week, game.slotPrices?.nonTrophy?.week]
    .filter(v => typeof v === "number" && Number.isFinite(v) && v >= 0);
  return values.length ? Math.min(...values) : null;
}

function gameCard(game) {

  const available = isAvailable(game);

  return `

    <article class="game-card">

      <div

        class="game-image"

        style="position:relative;overflow:hidden"

      >

        <span class="genre">${escapeHTML(game.genre)}</span>

        ${favoriteButton(game)}

        ${coverFallback(game)}

        ${coverImage(game)}

      </div>

      <div class="game-content">

        <h3>${escapeHTML(game.title)}</h3>

        <span class="status ${available ? "available" : "rented"}">

          ${available

            ? "● Available Now"

            : "● Currently Rented"}

        </span>

        <div class="prices">

          <span class="rp-starting">From ${startingPrice(game) === null ? "Ask for price" : peso(startingPrice(game))} / week</span>
          <span class="rp-wait-count">🏆 ${game.waiting?.trophy ?? 0} waiting · 🎮 ${game.waiting?.nonTrophy ?? 0} waiting</span>

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

    art.style.backgroundImage = "none";

    art.style.backgroundColor = "#15121b";

    art.innerHTML = `${coverFallback(game)}${coverImage(game, true)}`;

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

      ${coverFallback(game)}

      ${coverImage(game, true)}

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

        ${slotMarkup("🏆 Trophy · " + (game.waiting?.trophy ?? 0) + " waiting", game.trophy)}

        ${slotMarkup("🎮 Non-Trophy · " + (game.waiting?.nonTrophy ?? 0) + " waiting", game.nonTrophy)}

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

    period,

    slot

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

function closeBookingConfirmation() {
  const overlay = document.getElementById("rentplayConfirmation");
  if (!overlay) return;
  overlay.remove();
  document.removeEventListener("keydown", rentplayConfirmationEscape);
  if (!document.querySelector("#modal:not([hidden])")) document.body.style.overflow = "";
}

function rentplayConfirmationEscape(event) {
  if (event.key === "Escape") closeBookingConfirmation();
}

function showBookingConfirmation({ game, name, slot, period, price, available, message, copied }) {
  closeBookingConfirmation();
  const overlay = document.createElement("div");
  overlay.id = "rentplayConfirmation";
  overlay.className = "rp-confirm-overlay";
  overlay.innerHTML = `
    <section class="rp-confirm-card" role="dialog" aria-modal="true" aria-labelledby="rpConfirmTitle" aria-describedby="rpConfirmNotice">
      <button type="button" class="rp-confirm-close" aria-label="Close confirmation">×</button>
      <div class="rp-confirm-icon" aria-hidden="true">${copied ? "✓" : "✉"}</div>
      <div class="rp-confirm-kicker">RENTPLAY PH · NEXT STEP</div>
      <h2 id="rpConfirmTitle">${copied ? "Inquiry Ready!" : "Your Inquiry Is Ready"}</h2>
      <p class="rp-confirm-intro">${copied ? "Your rental details have been copied. Paste them into a message to our official Facebook Page." : "Copy your rental details below, then send them to our official Facebook Page."}</p>
      <div class="rp-confirm-details">
        <div class="rp-confirm-game">${escapeHTML(game.title)}</div>
        <div><span>Customer</span><strong>${escapeHTML(name)}</strong></div>
        <div><span>Account</span><strong>${escapeHTML(slot)}</strong></div>
        <div><span>Period</span><strong>${escapeHTML(period)}</strong></div>
        <div><span>Request</span><strong>${available ? "Rental Inquiry" : "Waiting List"}</strong></div>
        <div class="rp-confirm-price"><span>Estimated Price</span><strong>${price === null ? "To be confirmed" : peso(price)}</strong></div>
      </div>
      <div class="rp-confirm-notice" id="rpConfirmNotice"><strong>⚠ Important — Booking Not Yet Confirmed</strong><p>You must message our official Facebook Page and send your rental inquiry to request confirmation. Availability, final price, and payment instructions will be confirmed by our team. Joining the waiting list does not reserve a slot.</p></div>
      <button type="button" class="rp-confirm-copy">${copied ? "✓ Details Copied · Copy Again" : "Copy Rental Message"}</button>
      <a class="rp-confirm-facebook" href="${escapeHTML(CONFIG.facebookPage)}" target="_blank" rel="noopener noreferrer">💬 Open Official Facebook Page ↗</a>
      <p class="rp-confirm-foot">After opening Facebook, paste your rental details into Messenger and send them. No booking is created by this website alone.</p>
    </section>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  const copyButton = overlay.querySelector(".rp-confirm-copy");
  copyButton.addEventListener("click", async () => {
    const ok = await copyRentplayInquiry(message);
    copyButton.textContent = ok ? "✓ Copied! Paste into Messenger" : "Select and copy the message below";
    if (!ok) {
      let area = overlay.querySelector(".rp-confirm-manual");
      if (!area) {
        area = document.createElement("textarea");
        area.className = "rp-confirm-manual";
        area.readOnly = true;
        area.value = message;
        copyButton.after(area);
      }
      area.focus(); area.select();
    }
  });
  overlay.querySelector(".rp-confirm-close").addEventListener("click", closeBookingConfirmation);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeBookingConfirmation(); });
  overlay.querySelector(".rp-confirm-facebook").addEventListener("click", () => {
    // A normal user-initiated link avoids browser popup blockers.
  });
  document.addEventListener("keydown", rentplayConfirmationEscape);
  overlay.querySelector(".rp-confirm-close").focus();
}

async function copyRentplayInquiry(message) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(message);
      return true;
    }
  } catch (error) { console.warn("Clipboard permission unavailable:", error); }
  const field = document.createElement("textarea");
  field.value = message;
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0;z-index:-1";
  document.body.appendChild(field);
  field.focus(); field.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
  field.remove();
  return copied;
}

async function submitBooking(event) {
  event.preventDefault();
  const game = state.currentGame;
  if (!game) return;
  const form = document.querySelector("#bookingForm");
  if (form && !form.reportValidity()) return;
  const name = document.querySelector("#renterName")?.value.trim();
  const slot = document.querySelector("#rentalSlot")?.value;
  const period = document.querySelector("#rentalPeriod")?.value;
  if (!name || !slot || !period) return;
  const available = slot === "Trophy" ? game.trophy : game.nonTrophy;
  const price = getSelectedPrice(game, period, slot);
  const message = createBookingMessage(game, name, slot, period);
  const button = form?.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.textContent = available ? "Preparing inquiry…" : "Saving waiting-list request…"; }
  try {
    if (!available) {
      const key = "rpWait:" + game.id + ":" + slot + ":" + name.toLowerCase().replace(/\s+/g, " ");
      if (localStorage.getItem(key)) {
        const proceed = window.confirm("This browser already submitted a waiting-list request for this game and account type. Open Messenger instead of submitting again?");
        if (!proceed) return;
      } else {
        await window.RENTPLAY_FIREBASE.joinWaitingList({
          gameId: game.id, gameName: game.title, customerName: name,
          accountType: slot, rentalPeriod: period,
          rentalPlan: period === "UNLI SWAP" ? "Monthly UNLI SWAP" : period === "1 Month" ? "Monthly Single Game (No Swap)" : "Regular Weekly Rental",
          price
        });
        try { localStorage.setItem(key, "submitted"); } catch (_) {}
      }
    }
    const copied = await copyRentplayInquiry(message);
    showBookingConfirmation({ game, name, slot, period, price, available, message, copied });
  } catch (error) {
    console.error("RENTPLAY waiting list failed", error);
    window.alert("Waiting-list request was NOT saved. Please try again or message our Facebook Page. " + (error?.code === "permission-denied" ? "Check Firestore rules." : ""));
  } finally {
    if (button) button.disabled = false;
    updateRentalSummary();
  }
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

/* SHARED PRICING: JDigitalsRental games collection is the only price source.
   Historical rentplayPrices values are intentionally ignored. */
(() => {
  const previousLiveGame=liveGame;
  const validPrice=(v)=>{
    if(v===null||v===undefined||v==="")return null;
    const n=typeof v==="number"?v:Number(String(v).replace(/[₱,\\s]/g,""));
    return Number.isFinite(n)&&n>=0?n:null;
  };
  liveGame=function(doc) {
    const game=previousLiveGame(doc);
    const p=doc.data()||{};
    const unli=validPrice(p.monthlyTrophy ?? p.monthlyNonTrophy ?? 850);
    game.slotPrices={
      trophy:{
        week:validPrice(p.weeklyTrophy ?? p.weekly),
        twoWeeks:validPrice(p.twoWeeksTrophy),
        month:validPrice(p.singleMonthlyTrophy),
        unliSwap:unli
      },
      nonTrophy:{
        week:validPrice(p.weeklyNonTrophy),
        twoWeeks:validPrice(p.twoWeeksNonTrophy),
        month:validPrice(p.singleMonthlyNonTrophy),
        unliSwap:unli
      }
    };
    return game;
  };
})();

/* RENTPLAY PH — upcoming games from shared Firestore catalog */
function renderRentplayUpcoming() {
  let section = document.getElementById("upcoming");
  if (!section) {
    section = document.createElement("section");
    section.id = "upcoming";
    section.className = "section wrap";
    section.innerHTML = `<div class="section-heading"><div><span class="kicker">NEXT TO ARRIVE</span><h2>📅 Upcoming Games</h2><p>New adventures coming soon. Dates are subject to change.</p></div><span id="upcomingCount" class="count"></span></div><div id="upcomingGrid" class="game-grid"></div>`;
    const plans = document.getElementById("plans");
    if (plans) plans.before(section);
    else document.querySelector("main")?.appendChild(section);
    const nav = document.getElementById("nav");
    if (nav && !nav.querySelector('a[href="#upcoming"]')) {
      const link = document.createElement("a");
      link.href = "#upcoming";
      link.textContent = "Upcoming";
      nav.querySelector('a[href="#plans"]')?.before(link);
    }
  }
  const grid = document.getElementById("upcomingGrid");
  if (!grid) return;
  const list = [...UPCOMING_GAMES].sort((a,b) => {
    const da = Date.parse(a.availableDate), db = Date.parse(b.availableDate);
    return (Number.isFinite(da)?da:Infinity)-(Number.isFinite(db)?db:Infinity);
  });
  document.getElementById("upcomingCount").textContent = `${list.length} upcoming`;
  grid.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = catalogReady ? "No upcoming games at the moment. 🎮" : "Loading upcoming games…";
    grid.appendChild(empty);
    return;
  }
  for (const game of list) {
    const card = document.createElement("article");
    card.style.cssText = "background:#171a23;border:1px solid #353846;border-radius:15px;overflow:hidden;display:flex;flex-direction:column";
    const cover = document.createElement("img");
    cover.src = game.image || "";
    cover.alt = game.title;
    cover.loading = "lazy";
    cover.style.cssText = "width:100%;aspect-ratio:3/4;object-fit:cover;background:#222635";
    const body = document.createElement("div");
    body.style.cssText = "padding:14px;display:flex;flex-direction:column;gap:9px;flex:1";
    const tag = document.createElement("small");
    tag.textContent = "🟡 COMING SOON";
    tag.style.cssText = "color:#f6ca72;font-weight:800;letter-spacing:.08em";
    const title = document.createElement("h3");
    title.textContent = game.title;
    title.style.margin = "0";
    const date = document.createElement("p");
    const rawDate = game.availableDate;
    const parsed = rawDate?.toDate?.() || (rawDate ? new Date(rawDate) : null);
    const formatted = parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString("en-PH",{month:"long",day:"numeric",year:"numeric",timeZone:"Asia/Manila"}) : (rawDate && typeof rawDate === "string" ? rawDate : "Date TBA");
    date.textContent = "📅 Available for rent: " + formatted;
    date.style.cssText = "font-size:13px;color:#c4c8d2;margin:0";
    const action = document.createElement("button");
    action.type = "button";
    action.textContent = "📝 Join Waiting List ↗";
    action.style.cssText = "display:block;width:100%;margin-top:auto;text-align:center;padding:11px;border:0;border-radius:8px;background:#d92738;color:white;font-weight:700;cursor:pointer";
    action.addEventListener("click", () => openRentplayUpcomingForm(game, formatted));
    body.append(tag,title,date,action);
    card.append(cover,body);
    grid.appendChild(card);
  }
}


/* Upcoming Game interest form — submits to the existing private waitingList and publicWaitingList batch. */
function openRentplayUpcomingForm(game, availableDateLabel) {
  document.getElementById("rpUpcomingFormOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "rpUpcomingFormOverlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:30000;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto";
  const panel = document.createElement("div");
  panel.style.cssText = "width:100%;max-width:460px;max-height:90vh;overflow-y:auto;background:#171a23;color:#fff;border:1px solid #444856;border-radius:17px;padding:22px;box-shadow:0 24px 80px #000";
  const top = document.createElement("div");
  top.style.cssText = "display:flex;justify-content:space-between;gap:12px;align-items:start";
  const title = document.createElement("h2");
  title.textContent = "📅 Upcoming Game Waiting List";
  title.style.cssText = "font-size:21px;margin:0 0 12px";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Close waiting list form");
  close.style.cssText = "background:transparent;border:0;color:#fff;font-size:23px;cursor:pointer";
  top.append(title,close);
  const gameTitle = document.createElement("p");
  gameTitle.style.cssText = "font-weight:800;margin:5px 0";
  gameTitle.textContent = game.title;
  const date = document.createElement("p");
  date.style.cssText = "color:#b9becb;font-size:13px;margin:0 0 15px";
  date.textContent = "📅 Available for rent: " + availableDateLabel;
  const form = document.createElement("form");
  form.style.cssText = "display:grid;gap:13px";
  function field(labelText, control) {
    const label = document.createElement("label");
    label.style.cssText = "display:grid;gap:6px;font-size:13px;font-weight:700";
    label.append(document.createTextNode(labelText), control);
    control.style.cssText = "width:100%;padding:12px;background:#0b0d14;color:#fff;border:1px solid #505463;border-radius:9px;font:inherit";
    control.required = true;
    return label;
  }
  const name = document.createElement("input");
  name.type = "text";
  name.maxLength = 100;
  name.placeholder = "Enter your name";
  name.autocomplete = "name";
  const slot = document.createElement("select");
  for (const v of ["Trophy", "Non-Trophy"]) slot.add(new Option(v,v));
  const period = document.createElement("select");
  for (const v of ["1 Week", "2 Weeks", "1 Month", "UNLI SWAP"]) period.add(new Option(v,v));
  const priceBox = document.createElement("div");
  priceBox.style.cssText = "padding:13px;background:#101f1a;border:1px solid #365a48;border-radius:10px;display:grid;gap:5px";
  const priceCaption = document.createElement("small");
  priceCaption.textContent = "ESTIMATED RENTAL PRICE";
  priceCaption.style.cssText = "font-size:11px;letter-spacing:.07em;color:#b9c9bf;font-weight:700";
  const priceAmount = document.createElement("strong");
  priceAmount.style.cssText = "font-size:23px;color:#7cf3ad";
  const priceDetail = document.createElement("small");
  priceDetail.style.cssText = "color:#b9c9bf;line-height:1.5";
  priceBox.append(priceCaption,priceAmount,priceDetail);
  const selectedUpcomingPrice = () => getSelectedPrice(game,period.value,slot.value);
  const updateUpcomingPrice = () => {
    const amount = selectedUpcomingPrice();
    priceAmount.textContent = amount === null ? "Price TBA" : "₱" + amount.toLocaleString("en-PH");
    priceDetail.textContent = amount === null
      ? "No price has been set for this game and plan yet. Please confirm with our team."
      : slot.value + " · " + period.value + " · Subject to final confirmation";
  };
  slot.addEventListener("change",updateUpcomingPrice);
  period.addEventListener("change",updateUpcomingPrice);
  updateUpcomingPrice();
  const note = document.createElement("p");
  note.textContent = "This is a waiting-list request, not a confirmed rental. Our team will contact you to confirm availability and pricing.";
  note.style.cssText = "color:#b9becb;font-size:12px;line-height:1.6;margin:0";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "📝 Submit Waiting List Request";
  submit.style.cssText = "background:#d92738;color:white;border:0;border-radius:9px;padding:13px;font-weight:800;cursor:pointer";
  const feedback = document.createElement("p");
  feedback.setAttribute("role","status");
  feedback.style.cssText = "font-size:13px;line-height:1.5;margin:0";
  form.append(field("Your Name",name),field("Account Type",slot),field("Preferred Rental Period",period),priceBox,note,submit,feedback);
  panel.append(top,gameTitle,date,form);
  overlay.append(panel);
  document.body.append(overlay);
  const dismiss = () => overlay.remove();
  close.addEventListener("click",dismiss);
  overlay.addEventListener("click",e=>{if(e.target===overlay)dismiss();});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    if (!form.reportValidity() || !name.value.trim()) return;
    submit.disabled = true;
    submit.textContent = "Saving request…";
    feedback.textContent = "";
    try {
      await window.RENTPLAY_FIREBASE.joinWaitingList({
        gameId: String(game.id),
        gameName: String(game.title),
        customerName: name.value.trim(),
        accountType: slot.value,
        rentalPeriod: period.value,
        rentalPlan: period.value === "UNLI SWAP" ? "Monthly UNLI SWAP" : period.value === "1 Month" ? "Monthly Single Game (No Swap)" : "Regular Weekly Rental",
        ...(selectedUpcomingPrice() !== null ? {price: selectedUpcomingPrice()} : {})
      });
      form.replaceChildren();
      const success = document.createElement("p");
      success.style.cssText = "color:#70f5b1;line-height:1.7;font-weight:700";
      success.textContent = "✅ Successfully added to the waiting list! Your request is saved under RENTPLAY PH. This is not yet a confirmed rental.";
      const done = document.createElement("button");
      done.type = "button";
      done.textContent = "Done";
      done.style.cssText = "background:#d92738;color:white;border:0;border-radius:9px;padding:12px 24px;cursor:pointer";
      done.addEventListener("click",dismiss);
      form.append(success,done);
    } catch (err) {
      console.error("Upcoming waiting-list submission failed",err);
      feedback.style.color = "#ff9eaa";
      feedback.textContent = "Request was NOT saved. Please try again. " + (err?.code === "permission-denied" ? "Firebase permission denied; check the published Firestore rules." : "Check your connection.");
      submit.disabled = false;
      submit.textContent = "📝 Submit Waiting List Request";
    }
  });
  name.focus();
}
