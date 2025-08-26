/* global self */
console.log('[WORKER] MediaPipe 실제 분석 워커 시작');

let faceMesh;
let ready = false;

// MediaPipe 라이브러리를 직접 로드하지 않고, 메인 스레드에서 처리된 결과만 받기
console.log('[WORKER] 메인 스레드 기반 분석 모드');

function quantize(lm, decimals = 3) {
  const f = Math.pow(10, decimals);
  const arr = new Float32Array(lm.length * 3);
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i];
    arr[i * 3 + 0] = Math.round(p.x * f) / f;
    arr[i * 3 + 1] = Math.round(p.y * f) / f;
    arr[i * 3 + 2] = Math.round((p.z || 0) * f) / f;
  }
  return arr;
}

function calculateSmileIntensity(lm) {
  return (self.MetricsUtils && self.MetricsUtils.calculateSmileIntensity)
    ? self.MetricsUtils.calculateSmileIntensity(lm)
    : 0;
}

function calculateEyeSmile(lm) {
  return (self.MetricsUtils && self.MetricsUtils.calculateEyeSmile)
    ? self.MetricsUtils.calculateEyeSmile(lm)
    : 0;
}

function calculateEAR(lm) {
  return (self.MetricsUtils && self.MetricsUtils.calculateEAR)
    ? self.MetricsUtils.calculateEAR(lm)
    : { ear: 0.22, leftEAR: 0.22, rightEAR: 0.22, blinkStatus: 'open', thresholds: { blinkEar: 0.19, blinkClosed: 0.22 } };
}

function calculateNeckAngle(lm) {
  const r = (self.MetricsUtils && self.MetricsUtils.calculateNeckAngle)
    ? self.MetricsUtils.calculateNeckAngle(lm)
    : { neckAngle: 12, forwardHead: 0.02, forwardHeadRatio: 0.05 };
  return {
    neckAngle: r.neckAngle,
    forwardHead: r.forwardHead,
    forwardHeadRatio: r.forwardHeadRatio,
    postureScore: calculatePostureScore(r.neckAngle, r.forwardHead)
  };
}

function calculatePostureScore(neckAngle, forwardHead) {
  return (self.MetricsUtils && self.MetricsUtils.calculatePostureScore)
    ? self.MetricsUtils.calculatePostureScore(neckAngle, forwardHead, { baseScore: 60, neckAnglePenaltyFactor: 2, forwardPenaltyFactor: 1000 })
    : 60;
}

function analyzeGazeStability(lm) {
  return (self.MetricsUtils && self.MetricsUtils.analyzeGazeStability)
    ? self.MetricsUtils.analyzeGazeStability(lm, { generous: false })
    : { stabilityScore: 0, distanceFromCenter: 0, centerFixationScore: 0, gazeDirection: 'center', isFocused: false, jumpDistance: 0, velocity: 0.02 };
}

function analyzeShoulderPosture(lm) {
  return (self.MetricsUtils && self.MetricsUtils.analyzeShoulderPosture)
    ? self.MetricsUtils.analyzeShoulderPosture(lm, { baseScore: 50, heightPenaltyFactor: 500, slopePenaltyFactor: 200, widthRatioMin: 0.8, widthRatioSpan: 0.3, rotationPenaltyFactor: 1 })
    : { shoulderPostureScore: 50, shoulderTilt: 0, postureStatus: 'excellent' };
}

/**
 * 기본값 유틸리티 함수 (워커에서는 캘리브레이션 접근 불가)
 */
function getDefaultValue(key, defaultValue) {
  // 워커에서는 window 객체 접근 불가하므로 기본값만 반환
  return defaultValue;
}

/**
 * 랜드마크 데이터를 사용한 실제 측정 분석 (워커용)
 * @param {Object} landmarks - MediaPipe 랜드마크 데이터
 * @returns {Object} 분석 결과
 */
function analyzeWithCalibration(landmarks) {
  // EAR 계산
  const earResult = calculateEAR(landmarks);
  
  // 시선 안정성 분석
  const gazeResult = analyzeGazeStability(landmarks);
  
  // 목 자세 분석
  const neckResult = calculateNeckAngle(landmarks);
  
  // 어깨 자세 분석
  const shoulderResult = analyzeShoulderPosture(landmarks);
  
  // 미소 강도 계산
  const smileIntensity = calculateSmileIntensity(landmarks);
  
  return {
    // 기본 측정값
    ear: earResult.ear,
    leftEAR: earResult.leftEAR,
    rightEAR: earResult.rightEAR,
    blinkStatus: earResult.blinkStatus,
    
    // 시선 분석
    gazeStability: gazeResult.stabilityScore,
    distanceFromCenter: gazeResult.distanceFromCenter,
    centerFixationScore: gazeResult.centerFixationScore,
    
    // 자세 분석
    neckAngle: neckResult.neckAngle,
    forwardHead: neckResult.forwardHead,
    postureScore: neckResult.postureScore,
    shoulderPostureScore: shoulderResult.shoulderPostureScore,
    
    // 표정 분석
    smileIntensity: smileIntensity,
    
    // 통합 점수
    scores: {
      gaze: gazeResult.stabilityScore,
      concentration: (function () {
        let score = gazeResult.stabilityScore;
        if (gazeResult.isFocused) score = Math.min(100, score + 10);
        if (gazeResult.gazeDirection === 'center') score = Math.min(100, score + 5);
        else if (gazeResult.gazeDirection === 'outer') score = Math.max(0, score - 10);
        return Math.round(score);
      })(),
      blink: (function () {
        const s = earResult.blinkStatus;
        if (s === 'closed') return 0;
        if (s === 'blinking') return 60;
        if (s === 'open') return 100;
        return null;
      })(),
      posture: neckResult.postureScore
    },

    // 워커 정보
    worker: {
      type: 'worker',
      source: 'worker-landmarks',
      note: '워커에서는 기본값 사용'
    },
    
    // 종합 점수
    overallScore: Math.round(
      (gazeResult.stabilityScore + 
       neckResult.postureScore + 
       shoulderResult.shoulderPostureScore) / 3
    ),
    
    // 측정 시간
    timestamp: new Date().toISOString()
  };
}

function isCalibrationAvailable() {
  // 워커에서는 캘리브레이션 접근 불가
  return false;
}

function logCalibrationUsage() {
  console.log('[CALIBRATION] 워커에서는 캘리브레이션 접근 불가 - 기본값 사용');
}

async function init() {
  console.log('[WORKER] 메인 스레드 기반 분석 초기화');
  
  // 캘리브레이션 사용 상태 로깅
  logCalibrationUsage();
  
  ready = true;
  console.log('[WORKER] 초기화 완료 - MediaPipe 없이 동작');
}