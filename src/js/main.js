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
// read best score from localStorage (or 0)
let bestScore = Number(localStorage.getItem("bestScore")) || 0;

let lives = 5;
let correctAnswers = 0;
let streak = 0;
let streakThreshold = 3;
let questionsAnswered = 0;

let gameOver = false;

// UI references
let gameOverModal;
let gameOverMessageEl;
let gameOverScoreValueEl;
let gameOverBestScoreValueEl;
let newGameBtn;

let loadingOverlay;
let introOverlay;
let startGameBtn;

let bgAudio;
let muteBtn;


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
   LOAD SERIES FROM JSON
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

    // shuffle so each game is different
    seriesData.sort(() => Math.random() - 0.5);

    currentIndex = 0;
    showCurrentSeries();
    updateTopBar();
    updateStatsPanel();
  } catch (err) {
    console.error("JSON load error:", err);
    setLastResult("Data load error");
  } finally {
    hideLoadingOverlay();
  }
}


/* ============================================================
   POSTER PATH NORMALIZATION
============================================================ */

function normalizePosters() {
  seriesData = seriesData.map((s) => {
    if (!s.poster) return s;
    const fileName = s.poster.split("/").pop();
    return {
      ...s,
      poster: "img/series/" + fileName,
    };
  });
}


/* ============================================================
   SHOW CURRENT SERIES
============================================================ */

function showCurrentSeries() {
  if (!seriesData.length) return;
  if (currentIndex < 0 || currentIndex >= seriesData.length) return;

  const s = seriesData[currentIndex];

  document.getElementById("series-title").textContent =
    "Guess the filming city!";
  document.getElementById("series-subtitle").textContent =
    s.title + " – " + s.country;

  document.getElementById("series-poster").src = s.poster;
  document.getElementById("series-poster").alt = s.title;

  let zoomLevel = 5;
  if (s.country === "USA" || s.country === "Canada") zoomLevel = 4;
  if (s.country === "Turkey") zoomLevel = 6;
  if (["France", "Spain", "Italy", "Germany", "UK", "Ireland"].includes(s.country)) {
    zoomLevel = 6;
  }
  if (["Norway", "Sweden", "Finland", "Denmark"].includes(s.country)) {
    zoomLevel = 5;
  }

  if (s.coordinates && s.coordinates.length === 2) {
    const [lat, lon] = s.coordinates;
    if (!isNaN(lat) && !isNaN(lon)) {
      map.setView([lat, lon], zoomLevel);
    }
  }

  console.log("Showing:", s.title, "Poster:", s.poster, "Zoom:", zoomLevel);
}


/* ============================================================
   UI HELPERS
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

function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden");
  }
}


/* ============================================================
   HAVERSINE DISTANCE
============================================================ */

function getDistance(lat1, lon1, lat2, lon2) {
  function toRad(v) {
    return (v * Math.PI) / 180;
  }

  const R = 6371;
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
   SCORE LABELS
============================================================ */

function getScoreForDistance(distKm) {
  // close guesses → points, far guesses → lose life, no points
  if (distKm <= 50) {
    return { label: "Perfect guess!", points: 150, isCorrect: true, loseLife: false };
  } else if (distKm <= 150) {
    return { label: "Very close!", points: 120, isCorrect: true, loseLife: false };
  } else if (distKm <= 400) {
    return { label: "Close guess!", points: 80, isCorrect: true, loseLife: false };
  } else if (distKm <= 1500) {
    return { label: "Far, but not too bad.", points: 0, isCorrect: false, loseLife: true };
  } else {
    return { label: "Way too far.", points: 0, isCorrect: false, loseLife: true };
  }
}


/* ============================================================
   SUBMIT GUESS
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
   CORRECT / WRONG / SKIP / NEXT
============================================================ */

function handleCorrectGuess(dist, scoreInfo) {
  correctAnswers++;
  streak++;
  score += scoreInfo.points;

  if (streak > 0 && streak % streakThreshold === 0) {
    score += 50;
  }

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("bestScore", bestScore);
  }

  setLastResult(
    `✅ ${scoreInfo.label} (~${Math.round(dist)} km from target, +${scoreInfo.points} pts)`
  );

  nextQuestion();
}

function handleWrongGuess(dist, scoreInfo) {
  const s = seriesData[currentIndex];

  if (scoreInfo.points > 0) {
    // şu an hiç kullanılmıyor ama dursun
    score += scoreInfo.points;
  }

  if (scoreInfo.loseLife) {
    lives--;
    streak = 0;
  }

  setLastResult(
    `❌ ${scoreInfo.label} Correct city: ${s.city}. You were ~${Math.round(
      dist
    )} km away.`
  );

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("bestScore", bestScore);
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

  if (gameOverModal) {
    gameOverMessageEl.textContent = message;
    gameOverScoreValueEl.textContent = score;
    gameOverBestScoreValueEl.textContent = bestScore;
    gameOverModal.classList.remove("hidden");
  }
}


/* ============================================================
   START / RESET GAME
============================================================ */

function resetGameState() {
  timeLeft = 60;
  score = 0;
  lives = 5;
  correctAnswers = 0;
  streak = 0;
  questionsAnswered = 0;
  currentIndex = 0;
  lastGuess = null;
  gameOver = false;

  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = null;
  }

  setLastResult("Click on the map to guess!");
  updateStatsPanel();
  updateTopBar();

  document.getElementById("btn-submit").disabled = false;
  document.getElementById("btn-next").disabled = false;
  document.getElementById("btn-skip").disabled = false;
}

function startGame() {
  // introyu sadece ilk seferde gösteriyoruz
  if (introOverlay && !introOverlay.classList.contains("hidden")) {
    introOverlay.classList.add("hidden");
  }

  resetGameState();

  gameStartedAt = Date.now();
  clearInterval(timerInterval);
  startTimer();

  if (!map) {
    initMap();
  }

  if (loadingOverlay) {
    loadingOverlay.classList.remove("hidden");
  }

  loadSeries();
}


/* ============================================================
   INIT (only once, page load)
============================================================ */

function init() {
  console.log("App init...");

  loadingOverlay = document.getElementById("loading-overlay");
  introOverlay = document.getElementById("intro-overlay");
  startGameBtn = document.getElementById("btn-start-game");

  gameOverModal = document.getElementById("gameOverModal");
  gameOverMessageEl = document.getElementById("gameOverMessage");
  gameOverScoreValueEl = document.getElementById("gameOverScoreValue");
  gameOverBestScoreValueEl = document.getElementById("gameOverBestScoreValue");
  newGameBtn = document.getElementById("newGameBtn");

  bgAudio = document.getElementById("bg-audio");
  muteBtn = document.getElementById("mute-btn");

  // Background audio: start only after first interaction
  if (bgAudio) {
    bgAudio.volume = 0.4;

    const enableAudioOnInteraction = () => {
      document.body.removeEventListener("click", enableAudioOnInteraction);
      document.body.removeEventListener("keydown", enableAudioOnInteraction);
      bgAudio.play().catch(() => {});
    };

    document.body.addEventListener("click", enableAudioOnInteraction);
    document.body.addEventListener("keydown", enableAudioOnInteraction);
  }

  if (muteBtn && bgAudio) {
    muteBtn.addEventListener("click", () => {
      bgAudio.muted = !bgAudio.muted;
      muteBtn.textContent = bgAudio.muted ? "🔇" : "🔊";
    });
  }

  // Buttons
  document
    .getElementById("btn-submit")
    .addEventListener("click", submitGuess);

  document
    .getElementById("btn-next")
    .addEventListener("click", nextQuestion);

  document
    .getElementById("btn-skip")
    .addEventListener("click", skipQuestion);

  if (startGameBtn) {
    startGameBtn.addEventListener("click", startGame);
  }

  if (newGameBtn) {
    newGameBtn.addEventListener("click", () => {
      if (gameOverModal) {
        gameOverModal.classList.add("hidden");
      }
      startGame(); // intro tekrar gelmiyor
    });
  }

  // Intro overlay zaten açık geliyor; map & timer henüz başlamıyor.
  updateStatsPanel();
  updateTopBar();
}

window.addEventListener("DOMContentLoaded", init);
