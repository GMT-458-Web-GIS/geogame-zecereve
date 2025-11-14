# Analysis Report – Series City Hunt

## 1. Introduction
This report explains the technical and analytical decisions behind the design of
Series City Hunt, including data structure, mapping library selection, and design
prototype evaluation.

## 2. NYC Taxi Dataset Exploration
Although the dataset is not directly used in the game, it was explored to meet
assignment requirements. The dataset provides:
- Spatio-temporal data
- Dropoff/pickup locations
- Demand clustering behavior

Insights:
- The spatial distribution patterns inspired the idea of zoom-based gameplay.
- The concept of combining coordinates with time pressure guided the 60-second
  countdown mechanism.

## 3. Library Selection
### 3.1 Leaflet.js
Chosen because:
- Lightweight and ideal for 2D Web-GIS games
- Easy coordinate checks with `LatLngDistance`
- Simple country zoom control
- Works well with OpenStreetMap tiles
- Minimal performance cost

Alternatives considered:
- Mapbox GL JS (heavier, unnecessary)
- CesiumJS (3D, not needed)
- deck.gl (too complex for this assignment)

Conclusion:
**Leaflet is optimal for browser-based casual geo-games.**

## 4. Data Model
The dataset of ~100 series is stored as a JSON object:

```json
{
  "title": "La Casa de Papel",
  "poster": "lacasa.png",
  "city": "Madrid",
  "country": "Spain",
  "coordinates": [40.4168, -3.7038]
}
