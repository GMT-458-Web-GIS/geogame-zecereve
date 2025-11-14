# Design – Series City Hunt

## 1. Visual Theme
Series City Hunt uses a soft pastel pink and white UI theme designed to be minimal,
clean and modern. Rounded cards and subtle drop-shadows emphasize readability and
component separation.

Fonts:
- Primary: **Poppins**
- Secondary: Montserrat (optional)

Color Palette:
- #FDE8F3 (background)
- #F8C7E9 (UI cards)
- #FF8ACF (highlights)
- #F2A7D5 (buttons)
- White (#FFFFFF) for map container

## 2. Layout

### 2.1 Top Bar
Contains:
- Game title
- Question indicator
- Countdown timer (60 seconds)
- Lives (heart icons)

### 2.2 Left Area – Map
- Large Leaflet map container
- Blue marker appears when the user clicks
- Click-to-guess interaction

### 2.3 Right Sidebar – Game Stats
- Current Score
- Best Score
- Accuracy
- Correct Answers
- Current Streak
- Average Time

### 2.4 Bottom Section – Series Card
- Small rectangular poster of the series
- Series name + season text
- Buttons:
  - Submit Guess
  - Next Question
  - Skip

## 3. Interaction Flow (Flowchart)
See `./sketches/game-flow.png`

## 4. UI Drafts
All initial layout sketches and exported Canva designs are inside:

`./sketches/layout.png`
