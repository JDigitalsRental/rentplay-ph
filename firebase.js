/* RENTPLAY PH — shared JDigitalsRental catalog + two-way waiting-list submissions */
"use strict";
window.RENTPLAY_FIREBASE = {
  enabled: true, mode: "live", projectId: "jdigitalrental",
  sharedCatalog: true, readOnly: false,
  collections: {games: "games", waitingList: "publicWaitingList"},
  start() {
    if (this.started) return;
    this.started = true;
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js")
      .then(async ({initializeApp, getApps}) => {
        const {getFirestore, collection, onSnapshot, doc, writeBatch, serverTimestamp} = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js");
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
        this.joinWaitingList = async ({gameId, gameName, customerName, accountType, rentalPeriod, rentalPlan, price}) => {
          if (!gameId || !gameName || !customerName || !["Trophy", "Non-Trophy"].includes(accountType)) throw new Error("Invalid request");
          const reservation = doc(collection(db, "waitingList"));
          const id = reservation.id;
          const data = {gameId, gameName, customerName, accountType, rentalPeriod, rentalPlan, status: "waiting", createdAt: serverTimestamp()};
          if (typeof price === "number" && Number.isFinite(price) && price >= 0) data.price = price;
          const batch = writeBatch(db);
          batch.set(reservation, data);
          batch.set(doc(db, "publicWaitingList", id), {gameId, gameName, accountType});
          await batch.commit();
          return id;
        };
        onSnapshot(collection(db, "games"), snapshot => {
          window.dispatchEvent(new CustomEvent("rentplay:games", {detail: snapshot.docs}));
        }, error => {console.error("RENTPLAY catalog read failed:", error); window.dispatchEvent(new Event("rentplay:error"));});
        onSnapshot(collection(db, "publicWaitingList"), snapshot => {
          const counts = {};
          snapshot.forEach(item => {
            const d = item.data();
            const type = String(d.accountType || "").toLowerCase().replace(/[\s-]/g, "");
            const slot = type === "nontrophy" ? "nonTrophy" : "trophy";
            for (const key of [d.gameId, d.gameName]) {
              if (!key) continue;
              if (!counts[key]) counts[key] = {trophy: 0, nonTrophy: 0};
              counts[key][slot]++;
            }
          });
          window.dispatchEvent(new CustomEvent("rentplay:waiting", {detail: counts}));
        }, error => console.warn("RENTPLAY public waiting counts unavailable:", error));
      }).catch(error => {console.error("RENTPLAY Firebase failed:", error); window.dispatchEvent(new Event("rentplay:error"));});
  },
  async joinWaitingList() {throw new Error("Firebase is still loading. Please try again.");}
};
