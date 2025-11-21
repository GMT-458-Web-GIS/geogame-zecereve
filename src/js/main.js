/* ============================================================
   GLOBAL STATE
============================================================ */

let map;
let timeLeft = 60;
let timerInterval = null;
let gameStartedAt = null;

let userMarker = null;
let lastGuess = null;

let seriesData = [];
let currentIndex = 0;

let score = 0;
let bestScore = 0;
let lives = 5;
let correctAnswers = 0;
let streak = 0;
let streakThreshold = 3;
let questionsAnswered = 0;

let gameOver = false;


/* ============================================================
   MAP
============================================================ */

function initMap() {
  map = L.map("map").setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  map.on("click", function (e) {
    placeMarker(e.latlng);
  });
}

function placeMarker(latlng) {
  if (userMarker) {
    map.removeLayer(userMarker);
  }
  userMarker = L.marker(latlng).addTo(map);
  lastGuess = latlng;
}


/* ============================================================
   TIMER
============================================================ */

function startTimer() {
  timerInterval = setInterval(() => {
    if (gameOver) return;

    timeLeft--;
    updateTopBar();

    if (timeLeft <= 0) {
      endGame("Time is over!");
    }
  }, 1000);
}


/* ============================================================
   JSON'DAN DİZİLERİ YÜKLE
============================================================ */

async function loadSeries() {
  try {
    console.log("Trying to load data/series.json");
    const res = await fetch("data/series.json");

    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }

    seriesData = await res.json();
    console.log("Loaded", seriesData.length, "series");

    normalizePosters();

    // Dizileri karıştıralım ki oyun her seferinde farklı olsun
    seriesData.sort(() => Math.random() - 0.5);

    currentIndex = 0;
    showCurrentSeries();
    updateTopBar();
    updateStatsPanel();
  } catch (err) {
    console.error("JSON load error:", err);
    setLastResult("Data load error");
  }
}


/* ============================================================
   POSTER PATH NORMALIZATION (güvenlik için)
============================================================ */

function normalizePosters() {
  seriesData = seriesData.map((s) => {
    if (!s.poster) return s;
    const fileName = s.poster.split("/").pop(); // "breaking-bad.jpg"
    return {
      ...s,
      poster: "img/series/" + fileName, // index.html'den bakınca doğru yol
    };
  });
}


/* ============================================================
   ŞU ANKİ DİZİYİ EKRANA BAS + ÜLKEYE ZOOM
============================================================ */

function showCurrentSeries() {
  if (!seriesData.length) return;
  const s = seriesData[currentIndex];

  // Metin / poster
  document.getElementById("series-title").textContent = "Guess the filming city!";
  document.getElementById("series-subtitle").textContent =
    s.title + " – " + s.country;

  document.getElementById("series-poster").src = s.poster;
  document.getElementById("series-poster").alt = s.title;

  // Ülkeye göre zoom seviyesi
  let zoomLevel = 5;

  if (s.country === "USA" || s.country === "Canada") zoomLevel = 4;
  if (s.country === "Turkey") zoomLevel = 6;
  if (["France", "Spain", "Italy", "Germany", "UK", "Ireland"].includes(s.country)) {
    zoomLevel = 6;
  }
  if (["Norway", "Sweden", "Finland", "Denmark"].includes(s.country)) {
    zoomLevel = 5;
  }

  // Koordinat varsa haritayı o ülkeye/şehre yaklaştır
  if (s.coordinates && s.coordinates.length === 2) {
    const [lat, lon] = s.coordinates;
    if (!isNaN(lat) && !isNaN(lon)) {
      map.setView([lat, lon], zoomLevel);
    }
  }

  console.log("Showing:", s.title, "Poster:", s.poster, "Zoom:", zoomLevel);
}


/* ============================================================
   UI YARDIMCI FONKSİYONLARI
============================================================ */

function updateTopBar() {
  const qText = seriesData.length
    ? `${currentIndex + 1}/${seriesData.length}`
    : "0/0";
  document.getElementById("question-counter").textContent = qText;

  document.getElementById("timer").textContent = timeLeft;
  document.getElementById("lives").textContent = "❤ ".repeat(lives);
}

function updateStatsPanel() {
  document.getElementById("current-score").textContent = score;
  document.getElementById("best-score").textContent = bestScore;
  document.getElementById("correct-answers").textContent = correctAnswers;

  const accuracy =
    questionsAnswered > 0
      ? Math.round((correctAnswers / questionsAnswered) * 100)
      : 0;
  document.getElementById("accuracy").textContent = accuracy + "%";

  document.getElementById("current-streak").textContent = streak;

  let avgTime = 0;
  if (questionsAnswered > 0 && gameStartedAt) {
    const totalTimeUsed = (Date.now() - gameStartedAt) / 1000;
    avgTime = (totalTimeUsed / questionsAnswered).toFixed(1);
  }
  document.getElementById("avg-time").textContent = avgTime + " s";
}

function setLastResult(text) {
  document.getElementById("last-result").textContent = text;
}


/* ============================================================
   MESAFE HESABI (Haversine)
============================================================ */

function getDistance(lat1, lon1, lat2, lon2) {
  function toRad(v) {
    return (v * Math.PI) / 180;
  }

  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}


/* ============================================================
   MESAFEYE GÖRE PUAN / LABEL
============================================================ */

function getScoreForDistance(distKm) {
  // Yakınlığa göre label + puan
  if (distKm <= 50) {
    return { label: "Perfect guess!", points: 150, isCorrect: true };
  } else if (distKm <= 150) {
    return { label: "Very close!", points: 120, isCorrect: true };
  } else if (distKm <= 400) {
    return { label: "Close guess!", points: 80, isCorrect: true };
  } else if (distKm <= 1500) {
    return { label: "Far, but not too bad.", points: 40, isCorrect: false };
  } else {
    return { label: "Way too far.", points: 0, isCorrect: false };
  }
}


/* ============================================================
   TAHMİN GÖNDER (SUBMIT GUESS)
============================================================ */

function submitGuess() {
  if (gameOver) return;

  if (!lastGuess) {
    setLastResult("❗ First click on the map to make a guess.");
    return;
  }

  const s = seriesData[currentIndex];
  const [cityLat, cityLon] = s.coordinates;

  if (
    typeof cityLat !== "number" ||
    typeof cityLon !== "number" ||
    isNaN(cityLat) ||
    isNaN(cityLon)
  ) {
    setLastResult("No coordinates for this city, skipping.");
    nextQuestion();
    return;
  }

  const dist = getDistance(
    lastGuess.lat,
    lastGuess.lng,
    cityLat,
    cityLon
  );

  questionsAnswered++;

  const scoreInfo = getScoreForDistance(dist);

  if (scoreInfo.isCorrect && scoreInfo.points > 0) {
    handleCorrectGuess(dist, scoreInfo);
  } else {
    handleWrongGuess(dist, scoreInfo);
  }

  updateStatsPanel();
}


/* ============================================================
   DOĞRU / YANLIŞ / SKIP / NEXT
============================================================ */

function handleCorrectGuess(dist, scoreInfo) {
  correctAnswers++;
  streak++;
  score += scoreInfo.points;

  // Streak bonus
  if (streak > 0 && streak % streakThreshold === 0) {
    score += 50;
  }

  if (score > bestScore) {
    bestScore = score;
  }

  setLastResult(
    `✅ ${scoreInfo.label} (~${Math.round(dist)} km from target, +${scoreInfo.points} pts)`
  );

  nextQuestion();
}

function handleWrongGuess(dist, scoreInfo) {
  const s = seriesData[currentIndex];

  // Uzak ama 1500 km'den azsa az da olsa puan ver
  if (scoreInfo.points > 0) {
    score += scoreInfo.points;
    setLastResult(
      `🟠 ${scoreInfo.label} Correct city: ${s.city}. You were ~${Math.round(
        dist
      )} km away. (+${scoreInfo.points} pts)`
    );
  } else {
    lives--;
    streak = 0;
    setLastResult(
      `❌ Wrong. Correct city: ${s.city}. You were ~${Math.round(
        dist
      )} km away.`
    );
  }

  if (score > bestScore) {
    bestScore = score;
  }

  if (lives <= 0) {
    updateTopBar();
    endGame("No lives left!");
    return;
  }

  updateTopBar();
  nextQuestion();
}

function skipQuestion() {
  if (gameOver) return;

  streak = 0;
  setLastResult("⏭ Skipped.");
  nextQuestion();
}

function nextQuestion() {
  if (gameOver) return;

  currentIndex++;
  lastGuess = null;

  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = null;
  }

  if (currentIndex >= seriesData.length) {
    endGame("No more series!");
    return;
  }

  showCurrentSeries();
  updateTopBar();
}


/* ============================================================
   END GAME
============================================================ */

function endGame(message = "Game Over") {
  if (gameOver) return;
  gameOver = true;

  clearInterval(timerInterval);
  setLastResult("🏁 " + message);

  document.getElementById("btn-submit").disabled = true;
  document.getElementById("btn-next").disabled = true;
  document.getElementById("btn-skip").disabled = true;
}


/* ============================================================
   INIT GAME
============================================================ */

function initGame() {
  console.log("Game initializing...");
  gameStartedAt = Date.now();

  initMap();
  startTimer();
  loadSeries();

  // Buton eventleri
  document
    .getElementById("btn-submit")
    .addEventListener("click", submitGuess);

  document
    .getElementById("btn-next")
    .addEventListener("click", nextQuestion);

  document
    .getElementById("btn-skip")
    .addEventListener("click", skipQuestion);
}

window.addEventListener("DOMContentLoaded", initGame);
