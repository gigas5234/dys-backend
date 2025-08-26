# Metrics and Landmark Rationale

This document explains how each metric is computed from MediaPipe FaceMesh landmarks and why specific landmarks/thresholds are chosen. These rules are centralized so both main thread (mediapipe-direct.js) and worker (worker-landmarks.js) produce consistent results.

## Shared Module
- File: `src/dys_studio/js/metrics/metrics-utils.js`
- Exposed as `MetricsUtils` in both window and worker contexts.

## Landmarks and Metrics

### 1) Smile Intensity
- Landmarks:
  - Mouth corners: 61 (left), 291 (right)
  - Eyes for eye-smile bonus: 33, 133 (left), 362, 263 (right)
- Logic:
  - Width score from mouth corner distance (thresholds tuned for normalized coords)
  - Corner raise score from vertical raise vs baseY (0.5)
  - Eye-smile bonus from eye width ratio

### 2) EAR / Blink
- Landmarks:
  - Left eye: 33, 7, 163, 144, 145, 153
  - Right eye: 362, 382, 381, 380, 374, 373
- Logic:
  - Standard Eye Aspect Ratio formula
  - Thresholds: blinkEar ~0.19, closed ~0.22 (empirical defaults)

### 3) Neck Angle / Forward Head
- Landmarks:
  - Nose tip: 1
  - Ears: 234 (left), 454 (right)
- Logic:
  - Neck angle from vector (nose to ear-center)
  - Forward head from ear-center horizontal distance from screen center (0.5)
- Posture Score:
  - Angle and forward penalties combined with tunable factors

### 4) Gaze Stability
- Landmarks:
  - Pupils: 468 (left), 473 (right). If missing, fallback to 1 (nose tip)
- Logic:
  - Distance from calibrated center bands (center=0.5,0.53; bands 0.08/0.18)
  - Stability derived from band membership (generous/non-generous modes)

### 5) Shoulder Posture (Estimated)
- Landmarks:
  - Face sides: 234 (left), 454 (right)
  - Shoulders estimated slightly below sides (y + 0.1)
- Logic:
  - Height balance, slope, width, rotation combined into score with tunable factors

## Priorities and Flow
- Expression: server PyTorch > mediapipe-direct > worker
- Visual scores should be displayed as-is in UI; avoid re-computation in HTML.

## Notes
- All thresholds are defaults; tune via options in `MetricsUtils` callers.
- Keep computation only in mediapipe-direct or worker; UI should only render.
