/**
 * MediaPipe 직접 사용 모듈
 * camera-analyzer.js에서 직접 호출하여 MediaPipe 분석을 수행
 */

console.log('[MEDIAPIPE-DIRECT] 🚀 MediaPipe 직접 모듈 로드 시작');

// MediaPipe 라이브러리 로드 상태 확인
console.log('[MEDIAPIPE-DIRECT] 📦 MediaPipe 라이브러리 상태:', {
  FaceMesh: typeof FaceMesh,
  Camera: typeof Camera,
  ControlUtils: typeof ControlUtils,
  DrawingUtils: typeof DrawingUtils
});

// 전역 변수
let faceMesh = null;
let isProcessing = false;
let isInitialized = false;
let expressionAnalyzer = null; // 표정 분석기 추가
let lastExpressionAnalysis = 0; // 마지막 표정 분석 시간
let expressionAnalysisInterval = 3000; // 표정 분석 간격 (3초로 단축)
let expressionConfidenceThreshold = 0.6; // 표정 분석 신뢰도 임계값 (60%로 완화)
let stableExpressionCount = 0; // 안정적인 표정 카운트
let currentStableExpression = null; // 현재 안정적인 표정
let expressionStabilityThreshold = 1; // 안정성 판단을 위한 연속 프레임 수 (1회로 완화)

/**
 * MediaPipe 초기화
 */
async function initializeMediaPipe() {
    console.log('[MEDIAPIPE-DIRECT] 🔧 MediaPipe 초기화 시작...');
    
    // MediaPipe 라이브러리 상태 상세 확인
    console.log('[MEDIAPIPE-DIRECT] 📦 MediaPipe 라이브러리 상세 상태:', {
        FaceMesh: typeof FaceMesh,
        Camera: typeof Camera,
        ControlUtils: typeof ControlUtils,
        DrawingUtils: typeof DrawingUtils,
        window: typeof window,
        document: typeof document
    });
    
    // MediaPipe 라이브러리 확인
    if (typeof FaceMesh === 'undefined') {
        console.error('[MEDIAPIPE-DIRECT] ❌ FaceMesh 라이브러리가 로드되지 않음');
        console.error('[MEDIAPIPE-DIRECT] 📋 CDN 로드 상태 확인 필요');
        throw new Error('MediaPipe FaceMesh 라이브러리가 로드되지 않았습니다');
    }
    
    try {
        // FaceMesh 객체 생성
        console.log('[MEDIAPIPE-DIRECT] 📦 FaceMesh 객체 생성...');
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                console.log('[MEDIAPIPE-DIRECT] 📁 파일 요청:', file);
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        // 초기화
        console.log('[MEDIAPIPE-DIRECT] 🔄 FaceMesh 초기화...');
        await faceMesh.initialize();
        
        // 옵션 설정
        console.log('[MEDIAPIPE-DIRECT] ⚙️ FaceMesh 옵션 설정...');
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.3, // 더 낮은 감지 임계값으로 안정성 향상
            minTrackingConfidence: 0.3,  // 더 낮은 추적 임계값으로 안정성 향상
        });
        
        isInitialized = true;
        console.log('[MEDIAPIPE-DIRECT] ✅ MediaPipe 초기화 완료');
        return true;
        
    } catch (error) {
        console.error('[MEDIAPIPE-DIRECT] ❌ MediaPipe 초기화 실패:', error);
        throw error;
    }
}

/**
 * 표정 분석기 초기화
 */
async function initializeExpressionAnalyzer() {
    console.log('[MEDIAPIPE-DIRECT] 🎭 표정 분석기 초기화 시작...');
    
    try {
        // 서버에 표정 분석기 초기화 요청
        const response = await fetch(`${window.serverUrl || 'https://dys-phi.vercel.app/api/gke'}/api/expression/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('[MEDIAPIPE-DIRECT] 🎭 표정 분석기 응답:', result);
            
            if (result.success) {
                expressionAnalyzer = true;
                console.log('[MEDIAPIPE-DIRECT] ✅ 표정 분석기 초기화 완료');
                return true;
            } else {
                console.warn('[MEDIAPIPE-DIRECT] ⚠️ 표정 분석기 초기화 실패:', result.error);
                console.warn('[MEDIAPIPE-DIRECT] 🔍 상세 정보:', result.details);
                
                // 상세 에러 로그
                if (result.details) {
                    console.warn('[MEDIAPIPE-DIRECT] 📋 에러 상세:', result.details);
                }
                
                return false;
            }
        } else {
            const errorText = await response.text();
            console.warn('[MEDIAPIPE-DIRECT] ⚠️ 표정 분석기 초기화 요청 실패:', response.status, errorText);
            return false;
        }
    } catch (error) {
        console.error('[MEDIAPIPE-DIRECT] ❌ 표정 분석기 초기화 오류:', error);
        console.error('[MEDIAPIPE-DIRECT] 🔍 에러 스택:', error.stack);
        return false;
    }
}

/**
 * 비디오 요소에 MediaPipe 연결
 */
async function connectMediaPipeToVideo(videoEl, onResults) {
    console.log('[MEDIAPIPE-DIRECT] 🎥 비디오에 MediaPipe 연결 시작...');
    
    if (!isInitialized) {
        console.log('[MEDIAPIPE-DIRECT] ⏳ MediaPipe 초기화 대기...');
        await initializeMediaPipe();
    }
    
    // 표정 분석기 초기화 시도
    await initializeExpressionAnalyzer();
    
    // 결과 처리 핸들러 설정
    console.log('[MEDIAPIPE-DIRECT] 🎯 결과 처리 핸들러 설정...');
    faceMesh.onResults(async (results) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            console.log('[MEDIAPIPE-DIRECT] 👤 얼굴이 감지되지 않음');
            
            // 얼굴이 감지되지 않을 때는 표정 분석 초기화
            stableExpressionCount = 0;
            currentStableExpression = null;
            
            // 얼굴이 감지되지 않을 때도 기본 결과 전달
            const defaultResult = {
                smileIntensity: 0,
                ear: 0.22,
                earResult: { ear: 0.22, blinkStatus: 'open' },
                // 초기 로딩/무얼굴 상태에서는 점수 미표시
                neckAnalysis: { postureScore: null, forwardHeadRatio: 0.05 },
                gazeAnalysis: { stabilityScore: null, isFocused: false },
                shoulderAnalysis: { shoulderPostureScore: null, shoulderTilt: 0 },
                timestamp: Date.now(),
                _isWorkerMode: false,
                _source: 'mediapipe-direct',
                _noFaceDetected: true
            };
            
            if (onResults) {
                onResults(defaultResult);
            }
            return;
        }
        
        const lm = results.multiFaceLandmarks[0];
        console.log('[MEDIAPIPE-DIRECT] 🎯 얼굴 랜드마크 감지:', {
            얼굴개수: results.multiFaceLandmarks.length,
            랜드마크개수: lm.length,
            timestamp: new Date().toISOString()
        });
        
        // 기본 분석 결과 생성
        const analysisResult = analyzeLandmarks(lm);
        
        // 카메라 분석기에 프레임 시간 업데이트
        if (window.analyzerClient && window.analyzerClient._updateFrameTime) {
            window.analyzerClient._updateFrameTime();
        }
        
        // 표정 분석 추가 (MediaPipe와 통합)
        if (expressionAnalyzer && videoEl) {
            try {
                const shouldAnalyzeExpression = shouldAnalyzeExpressionNow();
                if (shouldAnalyzeExpression) {
                    const expressionResult = await analyzeExpressionFromVideo(videoEl);
                    if (expressionResult.success) {
                        // MediaPipe의 기본 표정 분석과 비교
                        const mediaPipeSmile = analysisResult.smileIntensity || 0;
                        const pytorchExpression = expressionResult.expression;
                        const pytorchConfidence = expressionResult.confidence;
                        
                        // MediaPipe와 PyTorch 결과 통합
                        const integratedResult = integrateExpressionResults(
                            mediaPipeSmile, 
                            pytorchExpression, 
                            pytorchConfidence,
                            expressionResult
                        );
                        
                        analysisResult.expressionAnalysis = integratedResult;
                        console.log('[MEDIAPIPE-DIRECT] 🎭 통합 표정 분석 완료:', integratedResult);
                    }
                }
            } catch (error) {
                console.warn('[MEDIAPIPE-DIRECT] ⚠️ 표정 분석 실패:', error);
            }
        }
        
        // 콜백 호출
        if (onResults) {
            onResults(analysisResult);
        }
    });
    
    // 프레임 처리 루프 시작
    console.log('[MEDIAPIPE-DIRECT] 🔄 프레임 처리 루프 시작...');
    startFrameProcessing(videoEl);
    
    console.log('[MEDIAPIPE-DIRECT] ✅ MediaPipe 비디오 연결 완료');
}

/**
 * 표정 분석 시점 결정
 */
function shouldAnalyzeExpressionNow() {
    const now = Date.now();
    
    // 시간 간격 체크
    if (now - lastExpressionAnalysis < expressionAnalysisInterval) {
        return false;
    }
    
    // MediaPipe 얼굴 감지 상태 체크
    // (이미 얼굴이 감지된 상태에서만 호출됨)
    
    lastExpressionAnalysis = now;
    return true;
}

/**
 * MediaPipe와 PyTorch 표정 결과 통합
 */
function integrateExpressionResults(mediaPipeSmile, pytorchExpression, pytorchConfidence, expressionResult) {
    console.log('[MEDIAPIPE-DIRECT] 🔄 표정 결과 통합 시작:', {
        mediaPipeSmile,
        pytorchExpression,
        pytorchConfidence
    });
    
    // MediaPipe 웃음 강도와 PyTorch 결과 비교
    let finalExpression = pytorchExpression;
    let finalConfidence = pytorchConfidence;
    let integrationNote = '';
    
    // 웃음 표정 특별 처리
    if (pytorchExpression === 'happy' && mediaPipeSmile > 0.6) {
        // MediaPipe와 PyTorch가 모두 웃음을 감지한 경우
        finalConfidence = Math.min(1.0, pytorchConfidence + 0.1);
        integrationNote = 'MediaPipe 웃음 강도와 일치하여 신뢰도 증가';
    } else if (pytorchExpression === 'happy' && mediaPipeSmile < 0.3) {
        // PyTorch는 웃음이지만 MediaPipe는 낮은 웃음 강도
        finalConfidence = Math.max(0.3, pytorchConfidence - 0.2);
        integrationNote = 'MediaPipe 웃음 강도와 불일치하여 신뢰도 감소';
    } else if (mediaPipeSmile > 0.7 && pytorchExpression !== 'happy') {
        // MediaPipe는 높은 웃음 강도지만 PyTorch는 다른 표정
        finalExpression = 'happy';
        finalConfidence = mediaPipeSmile * 0.8;
        integrationNote = 'MediaPipe 웃음 강도 기반으로 표정 수정';
    }
    
    // 중립 표정 특별 처리
    if (pytorchExpression === 'neutral' && mediaPipeSmile < 0.4) {
        finalConfidence = Math.min(1.0, pytorchConfidence + 0.05);
        integrationNote = 'MediaPipe 낮은 웃음 강도와 일치하여 중립 표정 신뢰도 증가';
    }
    
    // 결과 반환
    const integratedResult = {
        ...expressionResult,
        expression: finalExpression,
        confidence: finalConfidence,
        mediaPipeSmile: mediaPipeSmile,
        integrationNote: integrationNote,
        isIntegrated: true
    };
    
    console.log('[MEDIAPIPE-DIRECT] ✅ 통합 결과:', {
        finalExpression,
        finalConfidence,
        integrationNote
    });
    
    return integratedResult;
}

/**
 * 비디오에서 표정 분석
 */
async function analyzeExpressionFromVideo(videoEl) {
    try {
        // 캔버스 생성
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 고해상도 캔버스 설정 (최소 640x480 보장)
        const minWidth = Math.max(videoEl.videoWidth, 640);
        const minHeight = Math.max(videoEl.videoHeight, 480);
        
        canvas.width = minWidth;
        canvas.height = minHeight;
        
        // 고품질 렌더링 설정
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // 비디오 프레임을 캔버스에 그리기
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        
        // 고품질 JPEG로 변환 (품질 90%)
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        
        // 서버에 표정 분석 요청
        const response = await fetch(`${window.serverUrl || 'https://dys-phi.vercel.app/api/gke'}/api/expression/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_data: imageData
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            return result;
        } else {
            console.warn('[MEDIAPIPE-DIRECT] ⚠️ 표정 분석 요청 실패');
            return { success: false, error: 'Request failed' };
        }
    } catch (error) {
        console.error('[MEDIAPIPE-DIRECT] ❌ 표정 분석 오류:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 랜드마크 분석
 */
function analyzeLandmarks(lm) {
    console.log('[MEDIAPIPE-DIRECT] 🔍 랜드마크 분석 시작...');
    
    try {
        // 분석 함수들 호출
        const smileIntensity = calculateSmileIntensity(lm);
        const earResult = calculateEAR(lm);
        const neckAnalysis = calculateNeckAngle(lm);
        const gazeAnalysis = analyzeGazeStability(lm);
        const shoulderAnalysis = analyzeShoulderPosture(lm);
        
        // 파생 점수 계산 (공통 규칙으로 중앙화)
        const blinkScore = (function mapBlink(b) {
            if (!b || !b.blinkStatus) return null;
            if (b.blinkStatus === 'closed') return 0;
            if (b.blinkStatus === 'blinking') return 60;
            if (b.blinkStatus === 'open') return 100;
            return null;
        })(earResult);
        
        // 집중도 점수: 시선 안정성 + 보정(가벼운 규칙)
        const concentrationScore = (function computeConcentration(g) {
            if (!g) return null;
            // 안정성 점수 중심으로, 중앙 집중 가산
            let score = g.stabilityScore;
            if (g.isFocused) score = Math.min(100, score + 10);
            if (g.gazeDirection === 'center') score = Math.min(100, score + 5);
            else if (g.gazeDirection === 'outer') score = Math.max(0, score - 10);
            return Math.round(score);
        })(gazeAnalysis);
        
        const result = {
            smileIntensity,
            ear: earResult.ear,
            earResult,
            neckAnalysis,
            gazeAnalysis,
            shoulderAnalysis,
            scores: {
                gaze: gazeAnalysis?.stabilityScore ?? null,
                concentration: concentrationScore,
                blink: blinkScore,
                posture: neckAnalysis?.postureScore ?? null
            },
            timestamp: Date.now(),
            _isWorkerMode: false,
            _source: 'mediapipe-direct'
        };
        
        console.log('[MEDIAPIPE-DIRECT] 📊 분석 완료:', {
            smile: smileIntensity,
            ear: earResult.ear,
            neck: neckAnalysis.postureScore,
            gaze: gazeAnalysis.stabilityScore,
            shoulder: shoulderAnalysis.shoulderPostureScore
        });
        
        return result;
        
    } catch (error) {
        console.error('[MEDIAPIPE-DIRECT] ❌ 랜드마크 분석 오류:', error);
        return {
            smileIntensity: 0,
            ear: 0.22,
            earResult: { ear: 0.22, blinkStatus: 'open' },
            neckAnalysis: { postureScore: null, forwardHeadRatio: 0.05 },
            gazeAnalysis: { stabilityScore: null, isFocused: false },
            shoulderAnalysis: { shoulderPostureScore: null, shoulderTilt: 0 },
            timestamp: Date.now(),
            _isWorkerMode: false,
            _source: 'mediapipe-direct',
            _error: error.message
        };
    }
}

/**
 * 프레임 처리 루프
 */
function startFrameProcessing(videoEl) {
    console.log('[MEDIAPIPE-DIRECT] 🔄 프레임 처리 루프 설정...');
    
    const processFrame = async () => {
        if (!faceMesh || !isInitialized) {
            console.log('[MEDIAPIPE-DIRECT] ⏳ FaceMesh 초기화 대기...');
            setTimeout(processFrame, 500);
            return;
        }
        
        if (!isProcessing && videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
            isProcessing = true;
            try {
                console.log('[MEDIAPIPE-DIRECT] 📹 프레임 전송...');
                await faceMesh.send({image: videoEl});
                console.log('[MEDIAPIPE-DIRECT] ✅ 프레임 전송 완료');
            } catch (error) {
                console.error('[MEDIAPIPE-DIRECT] ❌ 프레임 처리 오류:', error);
            }
            isProcessing = false;
        } else {
            // 디버그 정보 (5초마다)
            if (window.__FRAME_DEBUG_COUNT__ === undefined) {
                window.__FRAME_DEBUG_COUNT__ = 0;
            }
            window.__FRAME_DEBUG_COUNT__++;
            
            if (window.__FRAME_DEBUG_COUNT__ % 15 === 0) {
                console.log('[MEDIAPIPE-DIRECT] ⏳ 프레임 처리 대기:', {
                    isProcessing,
                    videoEl: !!videoEl,
                    videoWidth: videoEl?.videoWidth,
                    videoHeight: videoEl?.videoHeight,
                    readyState: videoEl?.readyState,
                    faceMeshInitialized: isInitialized
                });
            }
        }
        
        // 2 FPS (500ms 간격) - 성능 개선을 위해 속도 조절
        setTimeout(processFrame, 500);
    };
    
    processFrame();
}

/**
 * 분석 함수들 (worker-landmarks.js에서 가져옴)
 */
function calculateSmileIntensity(lm) {
    return (window.MetricsUtils && window.MetricsUtils.calculateSmileIntensity)
        ? window.MetricsUtils.calculateSmileIntensity(lm)
        : 0;
}

function calculateEyeSmile(lm) {
    return (window.MetricsUtils && window.MetricsUtils.calculateEyeSmile)
        ? window.MetricsUtils.calculateEyeSmile(lm)
        : 0;
}

// 깜빡임 통계 관리
let blinkHistory = [];
let lastBlinkTime = 0;
let blinkCount = 0;

function calculateEAR(lm) {
    const r = (window.MetricsUtils && window.MetricsUtils.calculateEAR)
        ? window.MetricsUtils.calculateEAR(lm)
        : { ear: 0.22, leftEAR: 0.22, rightEAR: 0.22, blinkStatus: 'open', thresholds: { blinkEar: 0.19, blinkClosed: 0.22 } };
    const avgEAR = r.ear;
    const blinkStatus = r.blinkStatus;
    
    // 깜빡임 통계 업데이트
    const currentTime = Date.now();
    if (blinkStatus === 'blinking' && lastBlinkTime === 0) {
        // 깜빡임 시작
        lastBlinkTime = currentTime;
    } else if (blinkStatus === 'open' && lastBlinkTime > 0) {
        // 깜빡임 완료
        const blinkDuration = currentTime - lastBlinkTime;
        if (blinkDuration > 50 && blinkDuration < 500) { // 유효한 깜빡임 (50ms-500ms)
            blinkCount++;
            blinkHistory.push({
                time: currentTime,
                duration: blinkDuration,
                ear: avgEAR
            });
        }
        lastBlinkTime = 0;
    }
    
    // 1분 이전 데이터 제거
    blinkHistory = blinkHistory.filter(blink => currentTime - blink.time < 60000);
    
    // 분당 깜빡임 수 계산
    const oneMinuteAgo = currentTime - 60000;
    const recentBlinks = blinkHistory.filter(blink => blink.time > oneMinuteAgo);
    const blinkRatePerMinute = recentBlinks.length;
    
    // 평균 깜빡임 지속시간
    const avgBlinkDuration = recentBlinks.length > 0 
        ? recentBlinks.reduce((sum, blink) => sum + blink.duration, 0) / recentBlinks.length 
        : 0;
    
    return {
        ear: avgEAR,
        leftEAR: r.leftEAR,
        rightEAR: r.rightEAR,
        blinkStatus,
        blinkRatePerMinute,
        avgBlinkDuration,
        totalBlinkCount: blinkCount,
        thresholds: r.thresholds
    };
}

function calculateNeckAngle(lm) {
    const r = (window.MetricsUtils && window.MetricsUtils.calculateNeckAngle)
        ? window.MetricsUtils.calculateNeckAngle(lm)
        : { neckAngle: 12, forwardHead: 0.02, forwardHeadRatio: 0.05 };
    return {
        neckAngle: r.neckAngle,
        forwardHead: r.forwardHead,
        forwardHeadRatio: r.forwardHeadRatio,
        postureScore: calculatePostureScore(r.neckAngle, r.forwardHead)
    };
}

function calculatePostureScore(neckAngle, forwardHead) {
    return (window.MetricsUtils && window.MetricsUtils.calculatePostureScore)
        ? window.MetricsUtils.calculatePostureScore(neckAngle, forwardHead, { baseScore: 60, neckAnglePenaltyFactor: 2, forwardPenaltyFactor: 1000 })
        : 60;
}

function analyzeGazeStability(lm) {
    return (window.MetricsUtils && window.MetricsUtils.analyzeGazeStability)
        ? window.MetricsUtils.analyzeGazeStability(lm, { generous: true })
        : { stabilityScore: 0, distanceFromCenter: 0, centerFixationScore: 0, gazeDirection: 'center', isFocused: false, jumpDistance: 0, velocity: 0.02 };
}

function analyzeShoulderPosture(lm) {
    return (window.MetricsUtils && window.MetricsUtils.analyzeShoulderPosture)
        ? window.MetricsUtils.analyzeShoulderPosture(lm, { baseScore: 50, heightPenaltyFactor: 500, slopePenaltyFactor: 200, widthRatioMin: 0.8, widthRatioSpan: 0.3, rotationPenaltyFactor: 1 })
        : { shoulderPostureScore: 50, shoulderTilt: 0, postureStatus: 'excellent' };
}

/**
 * 정리 함수
 */
function cleanupMediaPipe() {
    console.log('[MEDIAPIPE-DIRECT] 🧹 MediaPipe 정리 시작...');
    if (faceMesh) {
        faceMesh = null;
    }
    isProcessing = false;
    isInitialized = false;
    console.log('[MEDIAPIPE-DIRECT] ✅ MediaPipe 정리 완료');
}

// 표정 분석 설정 조정 함수들
function updateExpressionAnalysisSettings(settings) {
    if (settings.interval) {
        expressionAnalysisInterval = settings.interval;
        console.log(`[MEDIAPIPE-DIRECT] ⚙️ 표정 분석 간격 업데이트: ${expressionAnalysisInterval}ms`);
    }
    
    if (settings.confidenceThreshold) {
        expressionConfidenceThreshold = settings.confidenceThreshold;
        console.log(`[MEDIAPIPE-DIRECT] ⚙️ 신뢰도 임계값 업데이트: ${(expressionConfidenceThreshold * 100).toFixed(1)}%`);
    }
    
    if (settings.stabilityThreshold) {
        expressionStabilityThreshold = settings.stabilityThreshold;
        console.log(`[MEDIAPIPE-DIRECT] ⚙️ 안정성 임계값 업데이트: ${expressionStabilityThreshold}회`);
    }
}

function getExpressionAnalysisSettings() {
    return {
        interval: expressionAnalysisInterval,
        confidenceThreshold: expressionConfidenceThreshold,
        stabilityThreshold: expressionStabilityThreshold,
        currentStableExpression: currentStableExpression,
        stableExpressionCount: stableExpressionCount
    };
}

function resetExpressionAnalysis() {
    stableExpressionCount = 0;
    currentStableExpression = null;
    lastExpressionAnalysis = 0;
    console.log('[MEDIAPIPE-DIRECT] 🔄 표정 분석 상태 초기화');
}

// 전역 스코프에 노출
window.MediaPipeDirect = {
    initializeMediaPipe,
    connectMediaPipeToVideo,
    analyzeLandmarks,
    cleanupMediaPipe,
    updateExpressionAnalysisSettings,
    getExpressionAnalysisSettings,
    resetExpressionAnalysis,
    isInitialized: () => isInitialized
};

console.log('[MEDIAPIPE-DIRECT] 🎉 MediaPipe 직접 모듈 로드 완료');
console.log('[MEDIAPIPE-DIRECT] 📊 전역 함수 노출:', {
    initializeMediaPipe: typeof window.MediaPipeDirect.initializeMediaPipe,
    connectMediaPipeToVideo: typeof window.MediaPipeDirect.connectMediaPipeToVideo,
    analyzeLandmarks: typeof window.MediaPipeDirect.analyzeLandmarks,
    cleanupMediaPipe: typeof window.MediaPipeDirect.cleanupMediaPipe
});
