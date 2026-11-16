
/*
 * RENTPLAY PH
 * Firebase Configuration
 * Version 1.0
 *
 * CINEMATIC EDITION
 *
 * Current Mode: DEMO
 *
 * Future Features:
 * - Shared JDigitalsRental Game Catalog
 * - Live Trophy / Non-Trophy Availability
 * - Live Rental Prices
 * - Waiting List Synchronization
 * - Upcoming Games
 *
 * IMPORTANT:
 * This file does not connect to Firebase yet.
 * Existing JDigitalsRental data remains unchanged.
 */

"use strict";

window.RENTPLAY_FIREBASE = {
  enabled: false,

  mode: "demo",

  projectId: null,

  sharedCatalog: false,

  readOnly: true,

  collections: {
    games: "games",
    waitingList: "waitingList"
  }
};

console.log(
  "RENTPLAY PH Firebase: Demo Mode"
);

