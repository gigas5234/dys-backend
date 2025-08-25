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
  const eyeSmileBonus = calculateEyeSmile(lm);
  
  return Math.min(100, Math.max(0, Math.round(smileScore + eyeSmileBonus)));
}

function calculateEyeSmile(lm) {
  const leftEyeOuter = lm[33];
  const leftEyeInner = lm[133];
  const rightEyeOuter = lm[362];
  const rightEyeInner = lm[263];
  
  const leftEyeWidth = Math.abs(leftEyeOuter.x - leftEyeInner.x);
  const rightEyeWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);
  
  const baseEyeWidth = 0.08;
  const eyeSmileRatio = Math.min(1, (leftEyeWidth + rightEyeWidth) / (2 * baseEyeWidth));
  
  return Math.round(eyeSmileRatio * 40);
}

function calculateEAR(lm) {
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
  
  // 기본 임계값 사용 (워커에서는 캘리브레이션 접근 불가)
  const blinkEarThreshold = 0.19;
  const blinkClosedThreshold = 0.22;
  
  let blinkStatus = 'open';
  if (avgEAR < blinkClosedThreshold) {
    blinkStatus = 'closed';
  } else if (avgEAR < blinkEarThreshold) {
    blinkStatus = 'blinking';
  }
  
  return {
    ear: avgEAR,
    leftEAR,
    rightEAR,
    blinkStatus,
    thresholds: {
      blinkEar: blinkEarThreshold,
      blinkClosed: blinkClosedThreshold
    }
  };
}

function calculateNeckAngle(lm) {
  const noseTip = lm[1];
  const leftEar = lm[234];
  const rightEar = lm[454];
  
  const earCenter = {
    x: (leftEar.x + rightEar.x) / 2,
    y: (leftEar.y + rightEar.y) / 2
  };
  
  // 코와 귀 중심점을 이용한 목 각도 계산
  const neckAngle = Math.atan2(noseTip.y - earCenter.y, noseTip.x - earCenter.x) * (180 / Math.PI);
  
  // 앞으로 내밀기 계산 (귀 중심점의 x 위치로 판단)
  const forwardHead = Math.abs(earCenter.x - 0.5); // 화면 중앙에서의 거리
  
  // forwardHeadRatio 계산 (UI에서 참조하는 필드)
  const neckVector = {
    x: noseTip.x - earCenter.x,
    y: noseTip.y - earCenter.y
  };
  const forwardHeadRatio = forwardHead / Math.sqrt(neckVector.x * neckVector.x + neckVector.y * neckVector.y);
  
  return {
    neckAngle: Math.abs(neckAngle),
    forwardHead: forwardHead,
    forwardHeadRatio: forwardHeadRatio, // UI에서 참조하는 필드 추가
    postureScore: calculatePostureScore(Math.abs(neckAngle), forwardHead)
  };
}

function calculatePostureScore(neckAngle, forwardHead) {
  // 기본 기준값 사용 (워커에서는 캘리브레이션 접근 불가)
  const neckAngleBaseline = 12.0;
  const chinForwardBaseline = 0.02;
  
  // 기준값 대비 점수 계산
  const angleScore = Math.max(0, 100 - (Math.abs(neckAngle - neckAngleBaseline) * 3));
  const forwardScore = Math.max(0, 100 - (Math.abs(forwardHead - chinForwardBaseline) * 2000));
  
  return Math.round((angleScore + forwardScore) / 2);
}

function analyzeGazeStability(lm) {
  // MediaPipe FaceMesh의 실제 눈동자 랜드마크 인덱스 사용
  // 왼쪽 눈동자: 468, 오른쪽 눈동자: 473
  const leftPupil = lm[468];
  const rightPupil = lm[473];
  
  // 눈동자가 없으면 코 끝(1)을 대체로 사용
  const gazeCenter = {
    x: leftPupil && rightPupil ? (leftPupil.x + rightPupil.x) / 2 : lm[1].x,
    y: leftPupil && rightPupil ? (leftPupil.y + rightPupil.y) / 2 : lm[1].y
  };
  
  // 기본 시선 중앙 (캘리브레이션 없을 때)
  const screenCenter = { x: 0.5, y: 0.53 };
  const bandCenterHalf = 0.08;
  const bandMidHalf = 0.18;
  
  const distanceFromCenter = Math.sqrt(
    Math.pow(gazeCenter.x - screenCenter.x, 2) + 
    Math.pow(gazeCenter.y - screenCenter.y, 2)
  );
  
  // 실제 시선 안정성 점수 계산 (velocity는 제거 - 실제 계산 불가)
  let jumpScore = 100;
  if (distanceFromCenter > bandMidHalf) jumpScore = 0;
  else if (distanceFromCenter > bandCenterHalf) jumpScore = 50;
  else if (distanceFromCenter > bandCenterHalf * 0.5) jumpScore = 80;
  else jumpScore = 100;
  
  const stabilityScore = jumpScore; // velocity 점수 제거
  
  // 시선 방향 및 집중 상태 판단 (UI에서 참조하는 필드들)
  let gazeDirection = 'center';
  if (distanceFromCenter > bandMidHalf) gazeDirection = 'outer';
  else if (distanceFromCenter > bandCenterHalf) gazeDirection = 'mid';
  
  const isFocused = distanceFromCenter <= bandCenterHalf;
  const jumpDistance = distanceFromCenter;
  const velocity = 0.02; // 기본값 (실제 계산 불가)
  
  return {
    stabilityScore,
    distanceFromCenter,
    centerFixationScore: jumpScore,
    gazeDirection: gazeDirection, // UI에서 참조하는 필드 추가
    isFocused: isFocused, // UI에서 참조하는 필드 추가
    jumpDistance: jumpDistance, // UI에서 참조하는 필드 추가
    velocity: velocity, // UI에서 참조하는 필드 추가
    calibrationUsed: {
      centerH: screenCenter.x,
      centerV: screenCenter.y,
      bandCenterHalf,
      bandMidHalf
    }
  };
}

function analyzeShoulderPosture(lm) {
  // MediaPipe FaceMesh는 어깨 랜드마크를 제공하지 않음
  // 대신 얼굴의 측면 랜드마크를 사용하여 어깨 위치 추정
  // 왼쪽 측면: 234 (왼쪽 귀), 오른쪽 측면: 454 (오른쪽 귀)
  const leftSide = lm[234];
  const rightSide = lm[454];
  
  // 어깨 위치 추정 (귀보다 약간 아래)
  const leftShoulder = { x: leftSide.x, y: leftSide.y + 0.1 };
  const rightShoulder = { x: rightSide.x, y: rightSide.y + 0.1 };
  
  const shoulderHeightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
  const shoulderSlope = (rightShoulder.y - leftShoulder.y) / Math.abs(rightShoulder.x - leftShoulder.x);
  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
  
  // 기본 어깨 너비 기준값
  const shoulderWidthBaseline = 0.28;
  const widthRatio = shoulderWidth / shoulderWidthBaseline;
  
  const shoulderRotation = Math.atan(shoulderSlope) * (180 / Math.PI);
  
  // 기준값 대비 점수 계산
  const heightBalanceScore = Math.max(0, 100 - (shoulderHeightDiff * 1000));
  const slopeScore = Math.max(0, 100 - (Math.abs(shoulderSlope) * 500));
  const widthScore = Math.min(100, Math.max(0, (widthRatio - 0.9) / 0.2 * 100));
  const rotationScore = Math.max(0, 100 - (Math.abs(shoulderRotation) * 2));
  
  const shoulderPostureScore = Math.round((heightBalanceScore + slopeScore + widthScore + rotationScore) / 4);
  
  let postureStatus = 'excellent';
  if (shoulderPostureScore < 60) postureStatus = 'poor';
  else if (shoulderPostureScore < 80) postureStatus = 'fair';
  else if (shoulderPostureScore < 90) postureStatus = 'good';
  
  return {
    shoulderPostureScore,
    shoulderTilt: shoulderRotation, // UI에서 참조하는 필드 추가
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
    note: "어깨 위치는 얼굴 측면 랜드마크로 추정됨"
  };
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