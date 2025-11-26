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
// bestScore'u localStorage'dan oku (yoksa 0)
let bestScore = Number(localStorage.getItem("bestScore")) || 0;

let lives = 5;
let correctAnswers = 0;
let streak = 0;
let streakThreshold = 3;
let questionsAnswered = 0;

let gameOver = false;
let hasGameStarted = false;

// Game over modal referansları
let gameOverModal;
let gameOverMessageEl;
let gameOverScoreValueEl;
let gameOverBestScoreValueEl;
let newGameBtn;

// Loading overlay
let loadingOverlay;

// Audio
let bgAudio;
let sfxCorrect;
let sfxWrong;
let sfxClick;


/* ============================================================
   MAP
============================================================ */

function initMap() {
  if (map) return; // aynı div'e ikinci kez map kurma

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
  // Önce varsa eski intervali temizle
  if (timerInterval) clearInterval(timerInterval);

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
  } finally {
    hideLoadingOverlay();
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
  if (currentIndex < 0 || currentIndex >= seriesData.length) return;

  const s = seriesData[currentIndex];

  // Metin / poster
  document.getElementById("series-title").textContent = "Guess the filming city!";
  document.getElementById("series-subtitle").textContent =
    s.title + " – " + s.country;

  document.getElementById("series-poster").src = s.poster;
  document.getElementById("series-poster").alt = s.title;

  // Ülkeye göre zoom seviyesi (sadece city koordinatına odaklan)
  let zoomLevel = 5;

  if (s.country === "USA" || s.country === "Canada") zoomLevel = 4;
  if (s.country === "Turkey") zoomLevel = 6;
  if (["France", "Spain", "Italy", "Germany", "UK", "Ireland"].includes(s.country)) {
    zoomLevel = 6;
  }
  if (["Norway", "Sweden", "Finland", "Denmark"].includes(s.country)) {
    zoomLevel = 5;
  }

  // Koordinat varsa haritayı şehrin kendisine yaklaştır
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

function showLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.remove("hidden");
  }
}

function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden");
  }
}

function playClick() {
  if (sfxClick) {
    sfxClick.currentTime = 0;
    sfxClick.play().catch(() => {});
  }
}

function playCorrect() {
  if (sfxCorrect) {
    sfxCorrect.currentTime = 0;
    sfxCorrect.play().catch(() => {});
  }
}

function playWrong() {
  if (sfxWrong) {
    sfxWrong.currentTime = 0;
    sfxWrong.play().catch(() => {});
  }
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
    // Burada CAN GİDECEK ve PUAN YOK
    return { label: "Far, but not too bad.", points: 0, isCorrect: false };
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
  playCorrect();

  correctAnswers++;
  streak++;
  score += scoreInfo.points;

  // Streak bonus
  if (streak > 0 && streak % streakThreshold === 0) {
    score += 50;
  }

  // best score güncelle
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
    // Bu case artık yok ama güvenlik için bırakalım
    score += scoreInfo.points;
    setLastResult(
      `🟠 ${scoreInfo.label} Correct city: ${s.city}. You were ~${Math.round(
        dist
      )} km away. (+${scoreInfo.points} pts)`
    );
  } else {
    // Can gider + yanlış sesi
    playWrong();
    lives--;
    streak = 0;
    setLastResult(
      `❌ ${scoreInfo.label} Correct city: ${s.city}. You were ~${Math.round(
        dist
      )} km away.`
    );
  }

  // best score güncelle
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

  // Modal varsa göster
  if (gameOverModal) {
    gameOverMessageEl.textContent = message;
    gameOverScoreValueEl.textContent = score;
    gameOverBestScoreValueEl.textContent = bestScore;
    gameOverModal.classList.remove("hidden");
  }
}


/* ============================================================
   START GAME / NEW GAME
============================================================ */

function startGame() {
  if (hasGameStarted) return;
  hasGameStarted = true;

  const introOverlay = document.getElementById("intro-overlay");
  if (introOverlay) {
    introOverlay.classList.add("hidden");
  }

  // Fade-in sınıfları
  const layout = document.querySelector(".layout");
  const seriesCard = document.querySelector(".series-card");
  if (layout) layout.classList.add("fade-in");
  if (seriesCard) seriesCard.classList.add("fade-in");

  gameStartedAt = Date.now();
  timeLeft = 60;
  score = 0;
  lives = 5;
  correctAnswers = 0;
  streak = 0;
  questionsAnswered = 0;
  gameOver = false;

  updateTopBar();
  updateStatsPanel();
  setLastResult("Click on the map to make your first guess!");

  initMap();
  showLoadingOverlay();
  loadSeries();
  startTimer();

  if (bgAudio) {
    bgAudio.play().catch(() => {});
  }
}

function newGame() {
  // intro tekrar gösterilmesin, sadece modal kapanıp oyun resetlensin
  gameOver = false;
  currentIndex = 0;
  score = 0;
  lives = 5;
  correctAnswers = 0;
  streak = 0;
  questionsAnswered = 0;
  timeLeft = 60;
  gameStartedAt = Date.now();

  if (userMarker) {
    map.removeLayer(userMarker);
    userMarker = null;
  }

  if (seriesData.length) {
    seriesData.sort(() => Math.random() - 0.5);
    currentIndex = 0;
    showCurrentSeries();
  }

  updateTopBar();
  updateStatsPanel();
  setLastResult("New game started. Make your best guesses!");

  document.getElementById("btn-submit").disabled = false;
  document.getElementById("btn-next").disabled = false;
  document.getElementById("btn-skip").disabled = false;

  if (gameOverModal) {
    gameOverModal.classList.add("hidden");
  }

  startTimer();
}


/* ============================================================
   INIT APP
============================================================ */

function initApp() {
  console.log("App initializing...");

  // DOM referansları
  loadingOverlay = document.getElementById("loading-overlay");

  gameOverModal = document.getElementById("gameOverModal");
  gameOverMessageEl = document.getElementById("gameOverMessage");
  gameOverScoreValueEl = document.getElementById("gameOverScoreValue");
  gameOverBestScoreValueEl = document.getElementById("gameOverBestScoreValue");
  newGameBtn = document.getElementById("newGameBtn");

  bgAudio = document.getElementById("bg-audio");
  sfxCorrect = document.getElementById("sfx-correct");
  sfxWrong = document.getElementById("sfx-wrong");
  sfxClick = document.getElementById("sfx-click");

  const muteBtn = document.getElementById("mute-btn");
  const startGameBtn = document.getElementById("start-game-btn");

  const submitBtn = document.getElementById("btn-submit");
  const nextBtn = document.getElementById("btn-next");
  const skipBtn = document.getElementById("btn-skip");

  // Start butonu
  if (startGameBtn) {
    startGameBtn.addEventListener("click", () => {
      playClick();
      startGame();
    });
  }

  // New Game (intro yok, direkt restart)
  if (newGameBtn) {
    newGameBtn.addEventListener("click", () => {
      playClick();
      newGame();
    });
  }

  // Mute tuşu
  if (muteBtn && bgAudio) {
    muteBtn.addEventListener("click", () => {
      if (bgAudio.muted) {
        bgAudio.muted = false;
        muteBtn.textContent = "🔊";
      } else {
        bgAudio.muted = true;
        muteBtn.textContent = "🔇";
      }
    });
  }

  // Oyun butonları (click sfx ile)
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      playClick();
      submitGuess();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      playClick();
      nextQuestion();
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      playClick();
      skipQuestion();
    });
  }

  // Başlangıçta sadece intro açık, oyun başlamıyor
  updateTopBar();
  updateStatsPanel();
}

window.addEventListener("DOMContentLoaded", initApp);
