/**
 * MediaPipe 관리 시스템 (메인 스레드 방식) - 수정된 버전
 * 워커 없이 메인 스레드에서 직접 MediaPipe 처리
 */

// --- WebSocket 관련 전역 변수 ---
let ws = null;
let wsReady = false;
let lmBatch = [];
let reconnectAttempts = 0;
let wsConnectRetries = 0;
const MAX_WS_RETRIES = 5;

// --- MediaPipe 관련 변수 ---
let faceMesh = null;
let isProcessing = false;
let mediaPipeInitialized = false;

// --- 분석 함수들 (worker-landmarks.js에서 복사) ---
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
    try {
        // 입꼬리 랜드마크 (61: 왼쪽, 291: 오른쪽)
        const leftCorner = lm[61];
        const rightCorner = lm[291];
        
        if (!leftCorner || !rightCorner) return 0;
        
        // 입꼬리 거리 계산
        const distance = Math.sqrt(
            Math.pow(rightCorner.x - leftCorner.x, 2) + 
            Math.pow(rightCorner.y - leftCorner.y, 2)
        );
        
        // 정규화된 거리를 미소 강도로 변환 (0-1 범위)
        const smileIntensity = Math.min(1.0, distance * 3);
        return smileIntensity;
    } catch (error) {
        console.warn('[ANALYSIS] 미소 강도 계산 실패:', error);
        return 0;
    }
}

function calculateEAR(lm) {
    try {
        // 왼쪽 눈 랜드마크
        const leftEye = [lm[33], lm[7], lm[163], lm[144], lm[145], lm[153]];
        // 오른쪽 눈 랜드마크
        const rightEye = [lm[362], lm[382], lm[381], lm[380], lm[374], lm[373]];
        
        function getEAR(eye) {
            if (eye.some(p => !p)) return 0.22;
            
            // EAR 계산 공식
            const A = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
            const B = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
            const C = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
            
            return (A + B) / (2.0 * C);
        }
        
        const leftEAR = getEAR(leftEye);
        const rightEAR = getEAR(rightEye);
        const ear = (leftEAR + rightEAR) / 2;
        
        // 깜빡임 상태 판단
        let blinkStatus = 'open';
        if (ear < 0.19) blinkStatus = 'blinking';
        if (ear < 0.17) blinkStatus = 'closed';
        
        return {
            ear: ear,
            leftEAR: leftEAR,
            rightEAR: rightEAR,
            blinkStatus: blinkStatus,
            thresholds: { blinkEar: 0.19, blinkClosed: 0.17 }
        };
    } catch (error) {
        console.warn('[ANALYSIS] EAR 계산 실패:', error);
        return { ear: 0.22, leftEAR: 0.22, rightEAR: 0.22, blinkStatus: 'open' };
    }
}

function calculateNeckAngle(lm) {
    try {
        // 코 끝 (1)과 귀 (234: 왼쪽, 454: 오른쪽)
        const nose = lm[1];
        const leftEar = lm[234];
        const rightEar = lm[454];
        
        if (!nose || !leftEar || !rightEar) {
            return { neckAngle: 12, forwardHead: 0.02, forwardHeadRatio: 0.05, postureScore: 60 };
        }
        
        // 귀 중심점 계산
        const earCenterX = (leftEar.x + rightEar.x) / 2;
        const earCenterY = (leftEar.y + rightEar.y) / 2;
        
        // 목 각도 계산 (수직에서의 편차)
        const neckAngle = Math.abs(earCenterY - nose.y) * 100;
        
        // 고개 숙임 정도 (화면 중심에서의 거리)
        const forwardHead = Math.abs(earCenterX - 0.5);
        const forwardHeadRatio = forwardHead / 0.5;
        
        // 자세 점수 계산
        const postureScore = Math.max(0, 100 - (neckAngle * 2) - (forwardHeadRatio * 100));
        
        return {
            neckAngle: neckAngle,
            forwardHead: forwardHead,
            forwardHeadRatio: forwardHeadRatio,
            postureScore: postureScore
        };
    } catch (error) {
        console.warn('[ANALYSIS] 목 각도 계산 실패:', error);
        return { neckAngle: 12, forwardHead: 0.02, forwardHeadRatio: 0.05, postureScore: 60 };
    }
}

function analyzeGazeStability(lm) {
    try {
        // 동공 랜드마크 (468: 왼쪽, 473: 오른쪽)
        const leftPupil = lm[468];
        const rightPupil = lm[473];
        
        // 동공이 없으면 코 끝 사용
        const gazePoint = leftPupil || rightPupil || lm[1];
        
        if (!gazePoint) {
            return { stabilityScore: 60, distanceFromCenter: 0, isFocused: true };
        }
        
        // 화면 중심에서의 거리
        const centerX = 0.5;
        const centerY = 0.53;
        const distanceFromCenter = Math.sqrt(
            Math.pow(gazePoint.x - centerX, 2) + 
            Math.pow(gazePoint.y - centerY, 2)
        );
        
        // 안정성 점수 (거리가 가까울수록 높은 점수)
        const stabilityScore = Math.max(0, 100 - (distanceFromCenter * 200));
        const isFocused = distanceFromCenter < 0.1;
        
        return {
            stabilityScore: stabilityScore,
            distanceFromCenter: distanceFromCenter,
            isFocused: isFocused
        };
    } catch (error) {
        console.warn('[ANALYSIS] 시선 안정성 분석 실패:', error);
        return { stabilityScore: 60, distanceFromCenter: 0, isFocused: true };
    }
}

function analyzeShoulderPosture(lm) {
    try {
        // 얼굴 측면 랜드마크 (234: 왼쪽, 454: 오른쪽)
        const leftSide = lm[234];
        const rightSide = lm[454];
        
        if (!leftSide || !rightSide) {
            return { shoulderPostureScore: 60, shoulderTilt: 0 };
        }
        
        // 어깨 기울기 계산 (Y축 차이)
        const shoulderTilt = Math.abs(leftSide.y - rightSide.y);
        
        // 어깨 자세 점수
        const shoulderPostureScore = Math.max(0, 100 - (shoulderTilt * 100));
        
        return {
            shoulderPostureScore: shoulderPostureScore,
            shoulderTilt: shoulderTilt
        };
    } catch (error) {
        console.warn('[ANALYSIS] 어깨 자세 분석 실패:', error);
        return { shoulderPostureScore: 60, shoulderTilt: 0 };
    }
}

/**
 * 메인 스레드에서 직접 MediaPipe 사용
 */
async function setupLandmarkWorker(videoEl, onLandmarkFrame, hzProvider) {
    console.log('[MEDIAPIPE] 🚀 메인 스레드에서 직접 MediaPipe 초기화 시작');
    
    // MediaPipe 라이브러리 로딩 대기
    await waitForMediaPipeLibraries();
    
    try {
        console.log('[MEDIAPIPE] 🔧 FaceMesh 객체 생성 시작...');
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                console.log('[MEDIAPIPE] 📁 파일 요청:', file);
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        console.log('[MEDIAPIPE] ✅ FaceMesh 객체 생성 완료');
        
        // FaceMesh 초기화
        console.log('[MEDIAPIPE] 🔄 FaceMesh 초기화 시작...');
        await faceMesh.initialize();
        console.log('[MEDIAPIPE] ✅ FaceMesh 초기화 완료');
        
        // 옵션 설정
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });
        console.log('[MEDIAPIPE] ✅ FaceMesh 옵션 설정 완료');
        
        // 결과 처리 핸들러
        faceMesh.onResults((results) => {
            if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                console.log('[MEDIAPIPE] 👤 얼굴이 감지되지 않음');
                return;
            }
            
            const lm = results.multiFaceLandmarks[0];
            console.log('[MEDIAPIPE] 🎯 얼굴 랜드마크 감지:', {
                랜드마크개수: lm.length,
                timestamp: new Date().toISOString()
            });
            
            // 분석 실행
            const smileIntensity = calculateSmileIntensity(lm);
            const earResult = calculateEAR(lm);
            const neckAnalysis = calculateNeckAngle(lm);
            const gazeAnalysis = analyzeGazeStability(lm);
            const shoulderAnalysis = analyzeShoulderPosture(lm);
            
            // 메트릭스 객체 생성
            const metrics = {
                smileIntensity,
                ear: earResult.ear,
                earResult,
                neckAnalysis,
                gazeAnalysis,
                shoulderAnalysis,
                timestamp: Date.now(),
                _isWorkerMode: false
            };
            
            // UI 업데이트
            if (typeof updateCameraMetrics === 'function') {
                updateCameraMetrics(metrics);
            }
            
            // 랜드마크 프레임 콜백
            if (onLandmarkFrame) {
                const q = quantize(lm);
                onLandmarkFrame(q.buffer, earResult.ear);
            }
            
            // WebSocket 배치에 추가
            addToWebSocketBatch(lm, metrics);
        });
        
        // 프레임 처리 루프 시작
        startFrameProcessing(videoEl);
        
        mediaPipeInitialized = true;
        console.log('[MEDIAPIPE] 🎉 MediaPipe 초기화 완료');
        
    } catch (error) {
        console.error('[MEDIAPIPE] ❌ 초기화 실패:', error);
        throw error;
    }
}

/**
 * MediaPipe 라이브러리 로딩 대기
 */
function waitForMediaPipeLibraries(maxWaitTime = 15000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        function checkLibraries() {
            if (typeof FaceMesh !== 'undefined') {
                console.log('[MEDIAPIPE] ✅ MediaPipe 라이브러리 로드 완료');
                resolve(true);
                return;
            }
            
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime > maxWaitTime) {
                reject(new Error('MediaPipe 라이브러리 로딩 타임아웃'));
                return;
            }
            
            console.warn(`[MEDIAPIPE] ⏳ MediaPipe 라이브러리 로딩 대기 중... (${elapsedTime}ms)`);
            setTimeout(checkLibraries, 500);
        }
        
        checkLibraries();
    });
}

/**
 * 프레임 처리 루프
 */
function startFrameProcessing(videoEl) {
    const processFrame = async () => {
        if (!isProcessing && videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
            isProcessing = true;
            try {
                await faceMesh.send({image: videoEl});
            } catch (error) {
                console.error('[MEDIAPIPE] ❌ 프레임 처리 오류:', error);
            }
            isProcessing = false;
        }
        
        setTimeout(processFrame, 500); // 2 FPS
    };
    
    processFrame();
}

/**
 * WebSocket 배치에 데이터 추가
 */
function addToWebSocketBatch(lm, metrics) {
    if (!window.lmBatch) {
        window.lmBatch = [];
    }
    
    const now = Date.now();
    const q = quantize(lm);
    
    // Float32Array를 base64로 변환
    const b = new Uint8Array(q.buffer);
    let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    const base64 = btoa(s);
    
    window.lmBatch.push({
        t: now,
        model: "facemesh-468",
        mode: "full",
        lm: base64,
        ear: metrics.ear,
        smileIntensity: metrics.smileIntensity,
        neckScore: metrics.neckAnalysis.postureScore,
        shoulderScore: metrics.shoulderAnalysis.shoulderPostureScore,
        gazeScore: metrics.gazeAnalysis.stabilityScore
    });
    
    // 배치 크기 제한
    if (window.lmBatch.length > 50) {
        window.lmBatch = window.lmBatch.slice(-30);
    }
}

/**
 * WebSocket 연결 설정 (개선된 버전)
 */
async function connectWS(token) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('[WEBSOCKET] 이미 연결됨');
        return;
    }
    
    // WebSocket 엔드포인트 확인
    if (!window.wsEndpoints || !window.wsEndpoints.landmarks) {
        console.error('[WEBSOCKET] ❌ WebSocket 엔드포인트가 설정되지 않음');
        await initializeWebSocketEndpoints();
    }
    
    const sessionId = `sess_${Date.now()}`;
    const wsUrl = `${window.wsEndpoints.landmarks}?sid=${sessionId}`;
    
    console.log('[WEBSOCKET] 연결 시도:', wsUrl);
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('[WEBSOCKET] ✅ 연결 성공');
            wsReady = true;
            reconnectAttempts = 0;
            startBatchSending();
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[WEBSOCKET] 📨 메시지 수신:', data);
            } catch (e) {
                console.log('[WEBSOCKET] 📨 메시지 수신 (텍스트):', event.data);
            }
        };
        
        ws.onclose = (event) => {
            console.log('[WEBSOCKET] 🔌 연결 종료:', event.code, event.reason);
            wsReady = false;
            
            // 재연결 시도
            if (reconnectAttempts < MAX_WS_RETRIES) {
                reconnectAttempts++;
                setTimeout(() => {
                    console.log(`[WEBSOCKET] 🔄 재연결 시도 ${reconnectAttempts}/${MAX_WS_RETRIES}`);
                    connectWS(token);
                }, 2000 * reconnectAttempts);
            }
        };
        
        ws.onerror = (error) => {
            console.error('[WEBSOCKET] ❌ 연결 오류:', error);
        };
        
    } catch (error) {
        console.error('[WEBSOCKET] ❌ WebSocket 생성 실패:', error);
    }
}

/**
 * WebSocket 엔드포인트 초기화
 */
async function initializeWebSocketEndpoints() {
    try {
        // 서버에서 WebSocket 설정 가져오기
        const response = await fetch(`${window.serverUrl}/api/websocket/config`);
        if (response.ok) {
            const config = await response.json();
            window.wsEndpoints = {
                landmarks: `${config.protocol || 'wss'}://${config.host}:${config.port}/ws/landmarks`
            };
        } else {
            throw new Error('WebSocket config fetch failed');
        }
    } catch (error) {
        console.warn('[WEBSOCKET] ⚠️ 서버 설정 로드 실패, fallback 사용');
        
        // Fallback 설정
        const isGKE = location.hostname.includes('vercel.app') || location.hostname.includes('dys-phi');
        const wsHost = isGKE ? '34.64.136.237' : location.hostname;
        const wsProtocol = isGKE ? 'wss' : 'ws';
        
        window.wsEndpoints = {
            landmarks: `${wsProtocol}://${wsHost}:8001/ws/landmarks`
        };
    }
}

/**
 * 배치 전송 시작
 */
function startBatchSending() {
    setInterval(() => {
        if (wsReady && window.lmBatch && window.lmBatch.length > 0) {
            try {
                const batchData = window.lmBatch.splice(0, 10);
                ws.send(JSON.stringify({
                    type: 'landmarks_batch',
                    frames: batchData,
                    fps: 2,
                    ts: Date.now()
                }));
                console.log('[WEBSOCKET] 📤 배치 전송:', batchData.length, '프레임');
            } catch (error) {
                console.error('[WEBSOCKET] ❌ 배치 전송 실패:', error);
            }
        }
    }, 1000);
}

/**
 * 워커 정리
 */
function cleanupWorker() {
    console.log('[CLEANUP] MediaPipe 정리');
    if (faceMesh) {
        faceMesh = null;
    }
    if (ws) {
        ws.close();
        ws = null;
        wsReady = false;
    }
    lmBatch = [];
    if (window.lmBatch) {
        window.lmBatch = [];
    }
    mediaPipeInitialized = false;
}

// 전역 스코프에 노출
window.setupLandmarkWorker = setupLandmarkWorker;
window.connectWS = connectWS;
window.cleanupWorker = cleanupWorker;
window.lmBatch = lmBatch;

console.log('[WORKER-MANAGER-FIXED] 🎉 개선된 MediaPipe 관리자 로드 완료');
