/**
 * MediaPipe 관리 시스템 (메인 스레드 방식)
 * 워커 없이 메인 스레드에서 직접 MediaPipe 처리
 */

// --- WebSocket 관련 전역 변수 ---
let ws = null;
let wsReady = false;
let lmBatch = [];
let reconnectAttempts = 0;

// --- MediaPipe 관련 변수 ---
let faceMesh = null;
let isProcessing = false;

/**
 * 메인 스레드에서 직접 MediaPipe 사용
 */
async function setupLandmarkWorker(videoEl, onLandmarkFrame, hzProvider) {
    console.log('[MEDIAPIPE] 🚀 메인 스레드에서 직접 MediaPipe 초기화 시작');
    console.log('[MEDIAPIPE] 📊 입력 파라미터:', {
        videoEl: !!videoEl,
        videoWidth: videoEl?.videoWidth,
        videoHeight: videoEl?.videoHeight,
        readyState: videoEl?.readyState,
        onLandmarkFrame: typeof onLandmarkFrame,
        hzProvider: typeof hzProvider
    });
    
    // MediaPipe가 로드되었는지 확인
    if (typeof FaceMesh === 'undefined') {
        console.error('[MEDIAPIPE] ❌ FaceMesh가 로드되지 않았습니다');
        console.error('[MEDIAPIPE] 🔍 MediaPipe 라이브러리 상태:', {
            FaceMesh: typeof FaceMesh,
            Camera: typeof Camera,
            DrawingUtils: typeof DrawingUtils,
            ControlUtils: typeof ControlUtils
        });
        throw new Error('MediaPipe FaceMesh 라이브러리가 로드되지 않았습니다');
    }
    
    console.log('[MEDIAPIPE] ✅ FaceMesh 라이브러리 확인됨');

    try {
        console.log('[MEDIAPIPE] 🔧 FaceMesh 객체 생성 시작...');
        // 메인 스레드에서 직접 FaceMesh 생성
        faceMesh = new FaceMesh({
            locateFile: (file) => {
                console.log('[MEDIAPIPE] 📁 파일 요청:', file);
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        console.log('[MEDIAPIPE] ✅ FaceMesh 객체 생성 완료');
        
        // FaceMesh 초기화 완료 대기
        console.log('[MEDIAPIPE] 🔄 FaceMesh 초기화 시작...');
        await faceMesh.initialize();
        console.log('[MEDIAPIPE] ✅ FaceMesh 초기화 완료');
        
        // 옵션 설정
        console.log('[MEDIAPIPE] ⚙️ FaceMesh 옵션 설정...');
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });
        console.log('[MEDIAPIPE] ✅ FaceMesh 옵션 설정 완료');
        
        // 결과 처리 핸들러
        console.log('[MEDIAPIPE] 🎯 결과 처리 핸들러 설정 완료');
        faceMesh.onResults((results) => {
            if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
                console.log('[MEDIAPIPE] 👤 얼굴이 감지되지 않음');
                return;
            }
            
            const lm = results.multiFaceLandmarks[0];
            console.log('[MEDIAPIPE] 🎯 얼굴 랜드마크 감지:', {
                얼굴개수: results.multiFaceLandmarks.length,
                랜드마크개수: lm.length,
                첫번째랜드마크: lm[0] ? `x:${lm[0].x.toFixed(3)}, y:${lm[0].y.toFixed(3)}, z:${lm[0].z.toFixed(3)}` : '없음',
                마지막랜드마크: lm[lm.length-1] ? `x:${lm[lm.length-1].x.toFixed(3)}, y:${lm[lm.length-1].y.toFixed(3)}, z:${lm[lm.length-1].z.toFixed(3)}` : '없음',
                timestamp: new Date().toISOString()
            });
            
            // 분석 함수들 (worker-landmarks.js의 함수들 사용)
            console.log('[MEDIAPIPE] 🔍 분석 함수 호출 시작...');
            // 함수가 정의되지 않았을 경우를 대비한 안전한 호출
            let smileIntensity = 0;
            let earResult = { ear: 0.22, blinkStatus: 'open' };
            let neckAnalysis = { postureScore: 60, forwardHeadRatio: 0.05 };
            let gazeAnalysis = { stabilityScore: 60, isFocused: true };
            let shoulderAnalysis = { shoulderPostureScore: 60, shoulderTilt: 0 };
            
            try {
                console.log('[MEDIAPIPE] 📊 분석 함수 상태:', {
                    calculateSmileIntensity: typeof calculateSmileIntensity,
                    calculateEAR: typeof calculateEAR,
                    calculateNeckAngle: typeof calculateNeckAngle,
                    analyzeGazeStability: typeof analyzeGazeStability,
                    analyzeShoulderPosture: typeof analyzeShoulderPosture
                });
                
                if (typeof calculateSmileIntensity === 'function') {
                    smileIntensity = calculateSmileIntensity(lm);
                    console.log('[MEDIAPIPE] 😊 미소 강도 계산 완료:', smileIntensity);
                }
                if (typeof calculateEAR === 'function') {
                    earResult = calculateEAR(lm);
                    console.log('[MEDIAPIPE] 👁️ EAR 계산 완료:', earResult);
                }
                if (typeof calculateNeckAngle === 'function') {
                    neckAnalysis = calculateNeckAngle(lm);
                    console.log('[MEDIAPIPE] 🦒 목 각도 계산 완료:', neckAnalysis);
                }
                if (typeof analyzeGazeStability === 'function') {
                    gazeAnalysis = analyzeGazeStability(lm);
                    console.log('[MEDIAPIPE] 👀 시선 안정성 분석 완료:', gazeAnalysis);
                }
                if (typeof analyzeShoulderPosture === 'function') {
                    shoulderAnalysis = analyzeShoulderPosture(lm);
                    console.log('[MEDIAPIPE] 💪 어깨 자세 분석 완료:', shoulderAnalysis);
                }
                
                console.log('[MEDIAPIPE] ✅ 모든 분석 함수 호출 완료');
            } catch (error) {
                console.error('[MEDIAPIPE] ❌ 분석 함수 호출 오류:', error);
                console.error('[MEDIAPIPE] 🔍 오류 상세 정보:', {
                    errorName: error.name,
                    errorMessage: error.message,
                    errorStack: error.stack?.split('\n').slice(0, 3).join('\n')
                });
            }
            
            const ear = earResult.ear; // EAR 값만 추출
            
            // 메트릭스 객체 생성
            const metrics = {
                smileIntensity,
                ear,
                earResult, // EAR 상세 결과 추가
                neckAnalysis,
                gazeAnalysis,
                shoulderAnalysis,
                timestamp: Date.now(),
                _isWorkerMode: false
            };
            
            console.log('[MEDIAPIPE] 📊 분석 완료:', {
                랜드마크개수: lm.length,
                smile: smileIntensity,
                ear: ear.toFixed(3),
                neck: neckAnalysis.postureScore,
                gaze: gazeAnalysis.stabilityScore,
                shoulder: shoulderAnalysis.shoulderPostureScore,
                timestamp: new Date().toISOString()
            });
            
            // UI 업데이트 호출
            console.log('[MEDIAPIPE] 🖥️ UI 업데이트 호출...');
            if (typeof updateCameraMetrics === 'function') {
                console.log('[MEDIAPIPE] ✅ updateCameraMetrics 함수 호출');
                updateCameraMetrics(metrics);
            } else {
                console.warn('[MEDIAPIPE] ⚠️ updateCameraMetrics 함수가 정의되지 않음');
            }
            
            // 랜드마크 프레임 콜백 호출
            if (onLandmarkFrame) {
                console.log('[MEDIAPIPE] 📡 랜드마크 프레임 콜백 호출...');
                const q = quantize(lm);
                onLandmarkFrame(q.buffer, ear);
                console.log('[MEDIAPIPE] ✅ 랜드마크 프레임 콜백 완료');
            } else {
                console.warn('[MEDIAPIPE] ⚠️ onLandmarkFrame 콜백이 정의되지 않음');
            }
            
            // WebSocket 배치에 직접 추가
            if (!window.lmBatch) {
                window.lmBatch = [];
                console.log('[MEDIAPIPE] window.lmBatch 초기화됨');
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
                ear,
                smileIntensity,
                neckScore: neckAnalysis.postureScore,
                shoulderScore: shoulderAnalysis.shoulderPostureScore,
                gazeScore: gazeAnalysis.stabilityScore
            });
            
            // 로컬 lmBatch도 동기화
            lmBatch = window.lmBatch;
            
            console.log('[MEDIAPIPE] 배치에 추가됨:', {
                배치크기: window.lmBatch.length,
                랜드마크개수: lm.length,
                예상랜드마크: 468,
                정상여부: lm.length === 468 ? '✅ 정상' : '⚠️ 이상',
                첫번째랜드마크: lm.length > 0 ? lm[0] : '없음',
                마지막랜드마크: lm.length > 0 ? lm[lm.length - 1] : '없음',
                base64길이: base64.length
            });
        });
        
        // 비디오 프레임 처리 루프
        console.log('[MEDIAPIPE] 🔄 프레임 처리 루프 설정...');
        const processFrame = async () => {
            // FaceMesh가 초기화되지 않았으면 대기
            if (!faceMesh) {
                console.log('[MEDIAPIPE] ⏳ FaceMesh 초기화 대기 중...');
                setTimeout(processFrame, 100);
                return;
            }
            
            if (!isProcessing && videoEl && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
                isProcessing = true;
                try {
                    console.log('[MEDIAPIPE] 📹 프레임 전송 시작...');
                    await faceMesh.send({image: videoEl});
                    console.log('[MEDIAPIPE] ✅ 프레임 전송 완료');
                } catch (error) {
                    console.error('[MEDIAPIPE] ❌ 프레임 처리 오류:', error);
                    console.error('[MEDIAPIPE] 🔍 프레임 오류 상세:', {
                        errorName: error.name,
                        errorMessage: error.message,
                        videoEl: !!videoEl,
                        videoWidth: videoEl?.videoWidth,
                        videoHeight: videoEl?.videoHeight
                    });
                }
                isProcessing = false;
            } else {
                // 프레임 처리 대기 상태 로깅 (디버깅용)
                if (window.__FRAME_DEBUG_COUNT__ === undefined) {
                    window.__FRAME_DEBUG_COUNT__ = 0;
                }
                window.__FRAME_DEBUG_COUNT__++;
                
                // 5초마다 한 번씩 프레임 처리 상태 출력 (더 자주)
                if (window.__FRAME_DEBUG_COUNT__ % 15 === 0) {
                    console.log('[MEDIAPIPE] ⏳ 프레임 처리 대기 상태:', {
                        isProcessing,
                        videoEl: !!videoEl,
                        videoWidth: videoEl?.videoWidth,
                        videoHeight: videoEl?.videoHeight,
                        readyState: videoEl?.readyState,
                        faceMeshInitialized: !!faceMesh,
                        debugCount: window.__FRAME_DEBUG_COUNT__
                    });
                }
            }
            
            // 다음 프레임 예약 (3 FPS로 조절 - 과부하 방지)
            setTimeout(processFrame, 333);
        };
        
        // 비디오가 준비되면 프레임 처리 시작
        console.log('[MEDIAPIPE] 📹 비디오 상태 확인:', {
            readyState: videoEl.readyState,
            videoWidth: videoEl.videoWidth,
            videoHeight: videoEl.videoHeight,
            src: videoEl.src,
            paused: videoEl.paused,
            ended: videoEl.ended,
            currentTime: videoEl.currentTime
        });
        
        // MediaPipe 초기화 완료 후 프레임 처리 시작
        const startFrameProcessing = () => {
            if (videoEl.readyState >= 2) {
                console.log('[MEDIAPIPE] ✅ 비디오 준비됨, 프레임 처리 시작');
                processFrame();
            } else {
                console.log('[MEDIAPIPE] ⏳ 비디오 로드 대기 중... (readyState:', videoEl.readyState, ')');
                videoEl.addEventListener('loadeddata', () => {
                    console.log('[MEDIAPIPE] ✅ 비디오 로드 완료, 프레임 처리 시작');
                    processFrame();
                });
                
                // 추가 이벤트 리스너
                videoEl.addEventListener('canplay', () => {
                    console.log('[MEDIAPIPE] ✅ 비디오 재생 가능, 프레임 처리 시작');
                    processFrame();
                });
            }
        };
        
        // FaceMesh 초기화 완료 후 프레임 처리 시작
        if (faceMesh) {
            console.log('[MEDIAPIPE] ✅ FaceMesh 이미 초기화됨, 프레임 처리 시작');
            startFrameProcessing();
        } else {
            // FaceMesh 초기화 대기
            console.log('[MEDIAPIPE] ⏳ FaceMesh 초기화 대기 중...');
            const checkFaceMeshReady = () => {
                if (faceMesh) {
                    console.log('[MEDIAPIPE] ✅ FaceMesh 초기화 완료, 프레임 처리 시작');
                    startFrameProcessing();
                } else {
                    console.log('[MEDIAPIPE] ⏳ FaceMesh 초기화 대기 중... (faceMesh:', !!faceMesh, ')');
                    setTimeout(checkFaceMeshReady, 100);
                }
            };
            checkFaceMeshReady();
        }
        
        console.log('[MEDIAPIPE] 🎉 메인 스레드 MediaPipe 초기화 완료');
        
    } catch (error) {
        console.error('[MEDIAPIPE] ❌ 초기화 실패:', error);
        console.error('[MEDIAPIPE] 🔍 초기화 실패 상세:', {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack?.split('\n').slice(0, 5).join('\n')
        });
        throw error;
    }
}

// MediaPipe 분석 함수들 (worker-landmarks.js와 중복 제거)
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

// 중복 함수들 제거 - worker-landmarks.js의 함수들 사용
// calculateSmileIntensity, calculateEAR, calculateNeckAngle, analyzeGazeStability, analyzeShoulderPosture 등은
// worker-landmarks.js에서 정의된 함수들을 사용

/**
 * WebSocket 연결 설정
 */
async function connectWS(token) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('[WEBSOCKET] 이미 연결됨');
        return;
    }
    
    const sessionId = `sess_${Date.now()}`;
    const wsUrl = `${window.wsEndpoints?.landmarks}?sid=${sessionId}`;
    
    console.log('[WEBSOCKET] 연결 시도:', wsUrl);
    
    try {
        ws = new WebSocket(wsUrl);

            ws.onopen = () => { 
            console.log('[WEBSOCKET] 연결 성공');
        wsReady = true; 
            reconnectAttempts = 0;
            
            // 배치 전송 시작
            startBatchSending();
            console.log('[WEBSOCKET] 배치 전송 시작됨');
        };
        
        ws.onmessage = (event) => {
            console.log('[WEBSOCKET] 메시지 수신:', event.data);
        };
        
        ws.onclose = (event) => {
            console.log('[WEBSOCKET] 연결 종료:', event.code, event.reason);
        wsReady = false; 
            
            // 재연결 시도 (최대 5회)
            if (reconnectAttempts < 5) {
                reconnectAttempts++;
                setTimeout(() => {
                    console.log(`[WEBSOCKET] 재연결 시도 ${reconnectAttempts}/5`);
                    connectWS(token);
                }, 2000 * reconnectAttempts);
            }
    };
    
    ws.onerror = (error) => {
            console.error('[WEBSOCKET] 연결 오류:', error);
        };
        
    } catch (error) {
        console.error('[WEBSOCKET] WebSocket 생성 실패:', error);
    }
}

/**
 * 배치 전송 시작
 */
function startBatchSending() {
    setInterval(() => {
        if (wsReady && window.lmBatch) {
            if (window.lmBatch.length > 0) {
                try {
                    const batchData = window.lmBatch.splice(0, 10); // 최대 10개씩 전송
                                    ws.send(JSON.stringify({
                    type: 'landmarks_batch',
                    frames: batchData,
                    fps: 3,
                    ts: Date.now()
                }));
                    console.log('[WEBSOCKET] 배치 전송:', {
                        전송프레임수: batchData.length,
                        첫번째프레임랜드마크: batchData[0]?.lm ? '있음' : '없음',
                        마지막프레임랜드마크: batchData[batchData.length-1]?.lm ? '있음' : '없음'
                    });
                } catch (error) {
                    console.error('[WEBSOCKET] 배치 전송 실패:', error);
                }
            } else {
                // 0개 프레임 로그는 제거하고 디버깅 정보만 표시
                if (window.__DEBUG_LANDMARK_COUNT__ === undefined) {
                    window.__DEBUG_LANDMARK_COUNT__ = 0;
                }
                window.__DEBUG_LANDMARK_COUNT__++;
                
                // 30초마다 한 번씩만 디버깅 정보 출력 (로그 과부하 방지)
                if (window.__DEBUG_LANDMARK_COUNT__ % 60 === 0) {
                    console.log('[DEBUG] 랜드마크 배치 상태:', {
                        lmBatchLength: window.lmBatch?.length || 0,
                        wsReady,
                        faceMeshInitialized: !!faceMesh,
                        isProcessing,
                        videoEl: !!videoEl,
                        videoWidth: videoEl?.videoWidth,
                        videoHeight: videoEl?.videoHeight,
                        readyState: videoEl?.readyState
                    });
                }
            }
        }
    }, 1000); // 1초마다 배치 전송 (과부하 방지)
}

/**
 * 워커 정리 (호환성 유지)
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
}

// 전역 스코프에 노출
window.setupLandmarkWorker = setupLandmarkWorker;
window.connectWS = connectWS;
window.cleanupWorker = cleanupWorker;
window.lmBatch = lmBatch; // 즉시 초기화

console.log('[WORKER-MANAGER] 🎉 메인 스레드 MediaPipe 관리자 로드 완료');
console.log('[WORKER-MANAGER] 📊 전역 함수 노출 상태:', {
    setupLandmarkWorker: typeof window.setupLandmarkWorker,
    connectWS: typeof window.connectWS,
    cleanupWorker: typeof window.cleanupWorker,
    lmBatch: !!window.lmBatch
});