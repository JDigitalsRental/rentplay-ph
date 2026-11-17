/* RENTPLAY PH — shared JDigitalsRental public catalog (read-only) */
"use strict";
window.RENTPLAY_FIREBASE = {
  enabled: true, mode: "live", projectId: "jdigitalrental",
  sharedCatalog: true, readOnly: true,
  collections: {games: "games", waitingList: "publicWaitingList"},
  start() {
    if (this.started) return;
    this.started = true;
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js")
      .then(async ({initializeApp, getApps}) => {
        const {getFirestore, collection, onSnapshot} = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js");
        const config = {
          apiKey: "AIzaSyDYxovJjUSbgiAPLbsNPpcUbrSCISnejqY",
          authDomain: "jdigitalrental.firebaseapp.com",
          projectId: "jdigitalrental",
          storageBucket: "jdigitalrental.firebasestorage.app",
          messagingSenderId: "611741872259",
          appId: "1:611741872259:web:01b3c2bec73d078999ebb6"
        };
        const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(config);
        const db = getFirestore(app);
        // Only public reads. Firestore security rules must separately enforce permissions.
        onSnapshot(collection(db, "games"), snapshot => {
          window.dispatchEvent(new CustomEvent("rentplay:games", {detail: snapshot.docs}));
        }, error => {console.error("RENTPLAY catalog read failed:", error); window.dispatchEvent(new Event("rentplay:error"));});
        onSnapshot(collection(db, "publicWaitingList"), snapshot => {
          const counts = {};
          snapshot.forEach(doc => {
            const d = doc.data();
            const name = String(d.gameName || d.gameId || "Unknown Game");
            const type = String(d.accountType || "").toLowerCase().replace(/[\s-]/g, "");
            if (!counts[name]) counts[name] = {trophy: 0, nonTrophy: 0};
            counts[name][type.includes("non") ? "nonTrophy" : "trophy"]++;
          });
          window.dispatchEvent(new CustomEvent("rentplay:waiting", {detail: counts}));
        }, error => console.warn("RENTPLAY public waiting counts unavailable:", error));
      }).catch(error => {console.error("RENTPLAY Firebase failed:", error); window.dispatchEvent(new Event("rentplay:error"));});
  }
};
