/**
 * MetricsUtils - Shared landmark-based metrics calculations
 * Can be used from main thread (window) and web worker (self)
 */
(function (root) {
  const MetricsUtils = {
    calculateEyeSmile(lm) {
      const leftEyeOuter = lm[33];
      const leftEyeInner = lm[133];
      const rightEyeOuter = lm[362];
      const rightEyeInner = lm[263];
      const leftEyeWidth = Math.abs(leftEyeOuter.x - leftEyeInner.x);
      const rightEyeWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);
      const baseEyeWidth = 0.08;
      const eyeSmileRatio = Math.min(1, (leftEyeWidth + rightEyeWidth) / (2 * baseEyeWidth));
      return Math.round(eyeSmileRatio * 40);
    },

    calculateSmileIntensity(lm) {
      const leftCorner = lm[61];
      const rightCorner = lm[291];
      const leftCornerY = leftCorner.y;
      const rightCornerY = rightCorner.y;
      const smileWidth = Math.abs(rightCorner.x - leftCorner.x);
      const baseY = 0.5;
      const cornerRaise = baseY - Math.min(leftCornerY, rightCornerY);
      const widthScore = Math.min(100, Math.max(0, (smileWidth - 0.12) / 0.08 * 100));
      const raiseScore = Math.min(100, Math.max(0, cornerRaise / 0.1 * 100));
      const smileScore = widthScore * 0.7 + raiseScore * 0.3;
      const eyeSmileBonus = MetricsUtils.calculateEyeSmile(lm);
      return Math.min(100, Math.max(0, Math.round(smileScore + eyeSmileBonus)));
    },

    calculateEAR(lm, options = {}) {
      const leftEye = [lm[33], lm[7], lm[163], lm[144], lm[145], lm[153]];
      const rightEye = [lm[362], lm[382], lm[381], lm[380], lm[374], lm[373]];
      function eyeAspectRatio(eye) {
        const A = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
        const B = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
        const C = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
        return (A + B) / (2.0 * C);
      }
      const leftEAR = eyeAspectRatio(leftEye);
      const rightEAR = eyeAspectRatio(rightEye);
      const avgEAR = (leftEAR + rightEAR) / 2.0;
      const blinkEarThreshold = options.blinkEarThreshold ?? 0.19;
      const blinkClosedThreshold = options.blinkClosedThreshold ?? 0.22;
      let blinkStatus = 'open';
      if (avgEAR < blinkClosedThreshold) blinkStatus = 'closed';
      else if (avgEAR < blinkEarThreshold) blinkStatus = 'blinking';
      return { ear: avgEAR, leftEAR, rightEAR, blinkStatus, thresholds: { blinkEar: blinkEarThreshold, blinkClosed: blinkClosedThreshold } };
    },

    calculateNeckAngle(lm) {
      const noseTip = lm[1];
      const leftEar = lm[234];
      const rightEar = lm[454];
      const earCenter = { x: (leftEar.x + rightEar.x) / 2, y: (leftEar.y + rightEar.y) / 2 };
      const neckAngle = Math.atan2(noseTip.y - earCenter.y, noseTip.x - earCenter.x) * (180 / Math.PI);
      const forwardHead = Math.abs(earCenter.x - 0.5);
      const neckVector = { x: noseTip.x - earCenter.x, y: noseTip.y - earCenter.y };
      const forwardHeadRatio = forwardHead / Math.sqrt(neckVector.x * neckVector.x + neckVector.y * neckVector.y);
      return { neckAngle: Math.abs(neckAngle), forwardHead, forwardHeadRatio };
    },

    calculatePostureScore(neckAngle, forwardHead, options = {}) {
      const neckAngleBaseline = options.neckAngleBaseline ?? 12.0;
      const chinForwardBaseline = options.chinForwardBaseline ?? 0.02;
      const angleScore = Math.max(0, 100 - (Math.abs(neckAngle - neckAngleBaseline) * (options.neckAnglePenaltyFactor ?? 2)));
      const forwardScore = Math.max(0, 100 - (Math.abs(forwardHead - chinForwardBaseline) * (options.forwardPenaltyFactor ?? 1000)));
      const baseScore = options.baseScore ?? 60;
      const calculatedScore = Math.round((angleScore + forwardScore) / 2);
      return Math.max(baseScore, calculatedScore);
    },

    analyzeGazeStability(lm, options = {}) {
      const leftPupil = lm[468];
      const rightPupil = lm[473];
      const gazeCenter = {
        x: leftPupil && rightPupil ? (leftPupil.x + rightPupil.x) / 2 : lm[1].x,
        y: leftPupil && rightPupil ? (leftPupil.y + rightPupil.y) / 2 : lm[1].y
      };
      const screenCenter = { x: options.centerX ?? 0.5, y: options.centerY ?? 0.53 };
      const bandCenterHalf = options.bandCenterHalf ?? 0.08;
      const bandMidHalf = options.bandMidHalf ?? 0.18;
      const distanceFromCenter = Math.sqrt(Math.pow(gazeCenter.x - screenCenter.x, 2) + Math.pow(gazeCenter.y - screenCenter.y, 2));
      let jumpScore;
      if (options.generous) {
        // more generous scoring
        if (distanceFromCenter > bandMidHalf) jumpScore = 30;
        else if (distanceFromCenter > bandCenterHalf) jumpScore = 70;
        else if (distanceFromCenter > bandCenterHalf * 0.5) jumpScore = 90;
        else jumpScore = 100;
      } else {
        if (distanceFromCenter > bandMidHalf) jumpScore = 0;
        else if (distanceFromCenter > bandCenterHalf) jumpScore = 50;
        else if (distanceFromCenter > bandCenterHalf * 0.5) jumpScore = 80;
        else jumpScore = 100;
      }
      const stabilityScore = jumpScore;
      let gazeDirection = 'center';
      if (distanceFromCenter > bandMidHalf) gazeDirection = 'outer';
      else if (distanceFromCenter > bandCenterHalf) gazeDirection = 'mid';
      const isFocused = distanceFromCenter <= bandCenterHalf;
      const jumpDistance = distanceFromCenter;
      const velocity = options.defaultVelocity ?? 0.02;
      return {
        stabilityScore,
        distanceFromCenter,
        centerFixationScore: jumpScore,
        gazeDirection,
        isFocused,
        jumpDistance,
        velocity,
        calibrationUsed: { centerH: screenCenter.x, centerV: screenCenter.y, bandCenterHalf, bandMidHalf }
      };
    },

    analyzeShoulderPosture(lm, options = {}) {
      const leftSide = lm[234];
      const rightSide = lm[454];
      const leftShoulder = { x: leftSide.x, y: leftSide.y + 0.1 };
      const rightShoulder = { x: rightSide.x, y: rightSide.y + 0.1 };
      const shoulderHeightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      const shoulderSlope = (rightShoulder.y - leftShoulder.y) / Math.abs(rightShoulder.x - leftShoulder.x);
      const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
      const shoulderWidthBaseline = options.shoulderWidthBaseline ?? 0.28;
      const widthRatio = shoulderWidth / shoulderWidthBaseline;
      const shoulderRotation = Math.atan(shoulderSlope) * (180 / Math.PI);
      const heightBalanceScore = Math.max(0, 100 - (shoulderHeightDiff * (options.heightPenaltyFactor ?? 500)));
      const slopeScore = Math.max(0, 100 - (Math.abs(shoulderSlope) * (options.slopePenaltyFactor ?? 200)));
      const widthScore = Math.min(100, Math.max(0, (widthRatio - (options.widthRatioMin ?? 0.8)) / (options.widthRatioSpan ?? 0.3) * 100));
      const rotationScore = Math.max(0, 100 - (Math.abs(shoulderRotation) * (options.rotationPenaltyFactor ?? 1)));
      const calculatedScore = Math.round((heightBalanceScore + slopeScore + widthScore + rotationScore) / 4);
      const baseScore = options.baseScore ?? 50;
      const shoulderPostureScore = Math.max(baseScore, calculatedScore);
      let postureStatus = 'excellent';
      if (shoulderPostureScore < 60) postureStatus = 'poor';
      else if (shoulderPostureScore < 80) postureStatus = 'fair';
      else if (shoulderPostureScore < 90) postureStatus = 'good';
      return {
        shoulderPostureScore,
        shoulderTilt: shoulderRotation,
        postureStatus,
        details: {
          heightBalance: Math.round(heightBalanceScore),
          slope: Math.round(slopeScore),
          width: Math.round(widthScore),
          rotation: Math.round(rotationScore)
        },
        measurements: {
          heightDiff: shoulderHeightDiff,
          slope: shoulderSlope,
          widthRatio: widthRatio,
          rotation: shoulderRotation,
          baselineWidth: shoulderWidthBaseline
        },
        note: '어깨 위치는 얼굴 측면 랜드마크로 추정됨'
      };
    }
  };

  // expose
  if (typeof root !== 'undefined') {
    root.MetricsUtils = MetricsUtils;
  }
})(typeof self !== 'undefined' ? self : window);
