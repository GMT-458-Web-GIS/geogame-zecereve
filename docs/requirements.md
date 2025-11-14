# Requirements – Series City Hunt

## 1. Game Objective
Series City Hunt is a Web-GIS based geography game where the player tries to
identify the filming city of popular TV series on a world map within a limited
time. The goal is to achieve the highest score using accuracy, time management
and spatial reasoning.

## 2. Functional Requirements
### 2.1 Input and Data
- A JSON file containing:
  - Series name
  - Poster image
  - Filming city
  - City coordinates (lat/lon)
  - Country

### 2.2 Map Interaction
- The map must be built with **Leaflet.js**.
- When a round starts, the map automatically zooms to the series' country.
- Player must be able to:
  - Click on the map to submit a city guess.
  - See country boundaries and city labels.

### 2.3 Game Logic
- Total 10 questions per game.
- Global 60-second countdown timer.
- 5 lives system:
  - Wrong guess → –1 life.
  - Lives = 0 → Game Over.
- Skip button:
  - Does not decrease lives.
  - Does not affect accuracy.
  - Ends current question.

### 2.4 Scoring
- Correct guess: +100 points
- Wrong guess: –20 points
- Streak bonus: Every 3 consecutive correct → +50 points
- Final score factors:
  - Accuracy (%)
  - Total time
  - Streak performance

### 2.5 UI Elements
- Top bar:
  - Question counter
  - Timer
  - Lives
- Left panel:
  - Interactive map
- Right panel:
  - Scoreboard (current score, best score, accuracy, correct answers, streak, avg. time)
- Bottom panel:
  - Series image
  - Guess / Next / Skip buttons

## 3. Non-Functional Requirements
- Works on desktop browsers (Chrome recommended).
- Lightweight UI, minimal load time.
- Clear and readable light-pink–white color palette.
- All components responsive up to 1280px width.
