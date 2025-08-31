/**
 * MediaPipe 분석 결과를 기존 UI에 연결하는 모듈
 * - 웹소켓을 통해 실시간 분석 결과 수신
 * - 기존 UI 컴포넌트들과 연동
 */

class MediaPipeAnalyzer {
    constructor() {
        this.ws = null;
        this.analysisWs = null;
        this.isConnected = false;
        this.isAnalysisConnected = false;
        
        // DOM이 로드된 후 URL 설정을 위해 지연 초기화
        this.initializeBaseUrl();
        
        // 분석 결과 저장
        this.currentAnalysis = {
            gaze_stability: 0,
            posture_stability: 0,
            blink_rate: 0,
            concentration: 0,
            initiative: 0
        };
        
        // UI 업데이트 콜백
        this.updateCallbacks = {
            gaze: null,
            posture: null,
            blinking: null,
            concentration: null,
            initiative: null
        };
        
        // 카메라 모니터링 관련
        this.lastCameraStatus = null;
        this.isMediaPipeReady = false;
        this.faceLandmarker = null;
        this.currentMediaPipeScores = {};
        this.lastServerRequest = 0;
        this.consecutiveFailures = 0;
        
        // 깜빡임 통계 관리
        this.blinkHistory = [];
        this.lastBlinkTime = 0;
        this.blinkCount = 0;
        
        // 카메라 권한 체크 및 스트림 모니터링
        this.checkCameraPermission();
        this.setupCameraMonitoring();
        
        // 점수별 업데이트 타이머
        this.updateTimers = {
            expression: 0,
            concentration: 0,
            gaze: 0,
            blinking: 0,
            posture: 0,
            initiative: 0
        };
        
        console.log("🎭 MediaPipe 분석기 초기화됨");
    }
    
    /**
     * 웹소켓 베이스 URL 초기화
     */
    initializeBaseUrl() {
        // ws-proxy 서비스를 통한 직접 연결 (우선 시도)
        const protocol = 'wss';  // ws-proxy는 HTTPS/WSS 지원
        
        // ws-proxy 서비스 엔드포인트 (실제 Cloud Run URL)
        const host = 'ws-proxy-44060495462.asia-northeast3.run.app';  // 실제 Cloud Run URL
        
        this.baseUrl = `${protocol}://${host}`;
        
        console.log("🔗 MediaPipe WebSocket URL:", this.baseUrl);
        console.log("🔗 ws-proxy 서비스 연결 시도");
        
        // ws-proxy가 실패하면 GKE 직접 연결로 폴백
        this.fallbackUrl = 'ws://34.64.136.237:8001/ws';
    }
    
    /**
     * 웹소켓 연결 설정 (임시 비활성화 - 하이브리드 방식 구현 중)
     */
    connect() {
        console.log("🚧 WebSocket 연결 비활성화됨 - 하이브리드 HTTP 방식으로 전환");
        this.isConnected = false;
        this.isAnalysisConnected = false;
        
        // 하이브리드 모드 초기화
        this.initializeHybridMode();
        
        // MediaPipe 초기화를 비동기로 실행
        this.initializeMediaPipe().then(success => {
            if (success) {
                console.log("✅ [MediaPipe] 초기화 성공 - 분석 시작");
            } else {
                console.log("❌ [MediaPipe] 초기화 실패 - 기본 모드로 동작");
            }
        });
        
        return; // WebSocket 비활성화
        
        try {
            // 랜드마크 데이터용 웹소켓 (ws-proxy를 통한 라우팅)
            const landmarksUrl = `${this.baseUrl}/ws/landmarks`;
            console.log("🔗 연결 시도:", landmarksUrl);
            this.ws = new WebSocket(landmarksUrl);
            
            this.ws.onopen = () => {
                console.log("🔗 MediaPipe 랜드마크 웹소켓 연결됨");
                this.isConnected = true;
            };
            
            this.ws.onmessage = (event) => {
                this.handleLandmarkMessage(JSON.parse(event.data));
            };
            
            this.ws.onclose = () => {
                console.log("🔌 MediaPipe 랜드마크 웹소켓 연결 종료");
                this.isConnected = false;
            };
            
            this.ws.onerror = (error) => {
                console.error("❌ MediaPipe 랜드마크 웹소켓 오류:", error);
                console.error("❌ 연결 시도 URL:", landmarksUrl);
            };
            
            // 분석 결과용 웹소켓 (ws-proxy를 통한 라우팅)
            const analysisUrl = `${this.baseUrl}/ws/analysis`;
            console.log("🔗 연결 시도:", analysisUrl);
            this.analysisWs = new WebSocket(analysisUrl);
            
            this.analysisWs.onopen = () => {
                console.log("🔗 MediaPipe 분석 웹소켓 연결됨");
                this.isAnalysisConnected = true;
                this.requestAnalysisSummary();
            };
            
            this.analysisWs.onmessage = (event) => {
                this.handleAnalysisMessage(JSON.parse(event.data));
            };
            
            this.analysisWs.onclose = () => {
                console.log("🔌 MediaPipe 분석 웹소켓 연결 종료");
                this.isAnalysisConnected = false;
            };
            
            this.analysisWs.onerror = (error) => {
                console.error("❌ MediaPipe 분석 웹소켓 오류:", error);
                console.error("❌ 연결 시도 URL:", analysisUrl);
            };
            
        } catch (error) {
            console.error("❌ MediaPipe 웹소켓 연결 실패:", error);
        }
    }
    
    /**
     * 카메라 권한 체크
     */
    async checkCameraPermission() {
        try {
            // 카메라 권한 상태 확인
            const permission = await navigator.permissions.query({ name: 'camera' });
            
            console.log("📹 [카메라] 권한 상태:", permission.state);
            
            if (permission.state === 'denied') {
                console.warn("⚠️ [카메라] 권한이 거부됨 - 사용자가 수동으로 허용해야 함");
                this.showCameraPermissionAlert();
            } else if (permission.state === 'prompt') {
                console.log("📹 [카메라] 권한 요청 대기 중");
            } else if (permission.state === 'granted') {
                console.log("✅ [카메라] 권한이 이미 허용됨");
            }
            
            // 권한 상태 변경 감지
            permission.onchange = () => {
                console.log("📹 [카메라] 권한 상태 변경:", permission.state);
                if (permission.state === 'granted') {
                    console.log("✅ [카메라] 권한이 허용됨 - 카메라 초기화 가능");
                } else if (permission.state === 'denied') {
                    console.warn("⚠️ [카메라] 권한이 거부됨");
                    this.showCameraPermissionAlert();
                }
            };
            
        } catch (error) {
            console.warn("⚠️ [카메라] 권한 상태 확인 실패:", error);
        }
    }
    
    /**
     * 카메라 권한 알림 표시
     */
    showCameraPermissionAlert() {
        // 기존 알림이 있으면 제거
        const existingAlert = document.getElementById('camera-permission-alert');
        if (existingAlert) {
            existingAlert.remove();
        }
        
        const alert = document.createElement('div');
        alert.id = 'camera-permission-alert';
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
        `;
        
        alert.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">📹</span>
                <div>
                    <strong>카메라 권한 필요</strong><br>
                    실시간 분석을 위해 카메라 접근을 허용해주세요.
                </div>
            </div>
            <button onclick="this.parentElement.remove()" style="
                position: absolute;
                top: 5px;
                right: 5px;
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
            ">×</button>
        `;
        
        document.body.appendChild(alert);
        
        // 10초 후 자동 제거
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 10000);
    }
    
    /**
     * 랜드마크 메시지 처리
     */
    handleLandmarkMessage(data) {
        if (data.ok && data.analysis_results) {
            // 분석 결과가 있으면 처리
            const results = data.analysis_results;
            if (results.length > 0) {
                // 최신 결과 사용
                const latestResult = results[results.length - 1];
                this.updateAnalysisResults(latestResult.scores);
            }
        }
    }
    
    /**
     * 분석 메시지 처리
     */
    handleAnalysisMessage(data) {
        if (data.ok && data.type === "analysis_summary") {
            this.updateAnalysisResults(data.summary);
        }
    }
    
    /**
     * 분석 결과 요약 요청
     */
    requestAnalysisSummary() {
        if (this.isAnalysisConnected) {
            this.analysisWs.send(JSON.stringify({
                type: "get_analysis_summary"
            }));
        }
    }
    
    /**
     * 분석 결과 업데이트
     */
    updateAnalysisResults(scores) {
        // 현재 분석 결과 업데이트
        this.currentAnalysis = {
            gaze_stability: scores.gaze_stability || 0,
            posture_stability: scores.posture_stability || 0,
            blink_rate: scores.blink_rate || 0,
            concentration: scores.concentration || 0,
            initiative: scores.initiative || 0
        };
        
        console.log("📊 MediaPipe 분석 결과 업데이트:", this.currentAnalysis);
        
        // UI 업데이트 콜백 실행
        this.updateUI();
        
        // 전역 변수에 저장 (기존 UI와 호환)
        window.currentMediaPipeData = this.currentAnalysis;
    }
    
    /**
     * UI 업데이트
     */
    updateUI() {
        // 시선 안정성 업데이트
        if (this.updateCallbacks.gaze) {
            this.updateCallbacks.gaze(this.currentAnalysis.gaze_stability);
        }
        
        // 자세 안정성 업데이트
        if (this.updateCallbacks.posture) {
            this.updateCallbacks.posture(this.currentAnalysis.posture_stability);
        }
        
        // 깜빡임 비율 업데이트
        if (this.updateCallbacks.blinking) {
            this.updateCallbacks.blinking(this.currentAnalysis.blink_rate);
        }
        
        // 집중도 업데이트
        if (this.updateCallbacks.concentration) {
            this.updateCallbacks.concentration(this.currentAnalysis.concentration);
        }
        
        // 주도권 업데이트
        if (this.updateCallbacks.initiative) {
            this.updateCallbacks.initiative(this.currentAnalysis.initiative);
        }
        
        // 기존 UI 컴포넌트들과 연동
        this.updateExistingUI();
    }
    
    /**
     * 기존 UI 컴포넌트들과 연동
     */
    updateExistingUI() {
        // 시선 점수 업데이트
        this.updateGazeScore();
        
        // 자세 점수 업데이트
        this.updatePostureScore();
        
        // 깜빡임 점수 업데이트
        this.updateBlinkingScore();
        
        // 집중도 점수 업데이트
        this.updateConcentrationScore();
        
        // 주도권 점수 업데이트
        this.updateInitiativeScore();
    }
    
    /**
     * 시선 점수 업데이트
     */
    updateGazeScore() {
        const score = Math.round(this.currentAnalysis.gaze_stability * 100);
        
        // 시선 점수 요소 찾기
        const gazeScoreElement = document.querySelector('.gaze-score, .gaze-value, [data-metric="gaze"]');
        if (gazeScoreElement) {
            gazeScoreElement.textContent = score;
        }
        
        // 시선 진행률 바 업데이트
        const gazeProgressBar = document.querySelector('.gaze-progress, .gaze-bar, [data-progress="gaze"]');
        if (gazeProgressBar) {
            gazeProgressBar.style.width = `${score}%`;
        }
        
        // 시선 팝업 데이터 업데이트
        if (window.currentGazeData) {
            window.currentGazeData = {
                ...window.currentGazeData,
                score: score,
                stability: this.currentAnalysis.gaze_stability
            };
        }
    }
    
    /**
     * 자세 점수 업데이트
     */
    updatePostureScore() {
        const score = Math.round(this.currentAnalysis.posture_stability * 100);
        
        // 자세 점수 요소 찾기
        const postureScoreElement = document.querySelector('.posture-score, .posture-value, [data-metric="posture"]');
        if (postureScoreElement) {
            postureScoreElement.textContent = score;
        }
        
        // 자세 진행률 바 업데이트
        const postureProgressBar = document.querySelector('.posture-progress, .posture-bar, [data-progress="posture"]');
        if (postureProgressBar) {
            postureProgressBar.style.width = `${score}%`;
        }
        
        // 자세 팝업 데이터 업데이트
        if (window.currentPostureData) {
            window.currentPostureData = {
                ...window.currentPostureData,
                score: score,
                stability: this.currentAnalysis.posture_stability
            };
        }
    }
    
    /**
     * 깜빡임 점수 업데이트
     */
    updateBlinkingScore() {
        const score = Math.round((1 - this.currentAnalysis.blink_rate) * 100); // 깜빡임이 적을수록 높은 점수
        
        // 깜빡임 점수 요소 찾기
        const blinkingScoreElement = document.querySelector('.blinking-score, .blinking-value, [data-metric="blinking"]');
        if (blinkingScoreElement) {
            blinkingScoreElement.textContent = score;
        }
        
        // 깜빡임 진행률 바 업데이트
        const blinkingProgressBar = document.querySelector('.blinking-progress, .blinking-bar, [data-progress="blinking"]');
        if (blinkingProgressBar) {
            blinkingProgressBar.style.width = `${score}%`;
        }
        
        // 깜빡임 팝업 데이터 업데이트
        if (window.currentBlinkingData) {
            window.currentBlinkingData = {
                ...window.currentBlinkingData,
                score: score,
                blinkRate: this.currentAnalysis.blink_rate
            };
        }
    }
    
    /**
     * 집중도 점수 업데이트
     */
    updateConcentrationScore() {
        const score = Math.round(this.currentAnalysis.concentration * 100);
        
        // 집중도 점수 요소 찾기
        const concentrationScoreElement = document.querySelector('.concentration-score, .concentration-value, [data-metric="concentration"]');
        if (concentrationScoreElement) {
            concentrationScoreElement.textContent = score;
        }
        
        // 집중도 진행률 바 업데이트
        const concentrationProgressBar = document.querySelector('.concentration-progress, .concentration-bar, [data-progress="concentration"]');
        if (concentrationProgressBar) {
            concentrationProgressBar.style.width = `${score}%`;
        }
        
        // 집중도 팝업 데이터 업데이트
        if (window.currentConcentrationData) {
            window.currentConcentrationData = {
                ...window.currentConcentrationData,
                score: score,
                concentration: this.currentAnalysis.concentration
            };
        }
    }
    
    /**
     * 주도권 점수 업데이트
     */
    updateInitiativeScore() {
        const score = Math.round(this.currentAnalysis.initiative * 100);
        
        // 주도권 점수 요소 찾기
        const initiativeScoreElement = document.querySelector('.initiative-score, .initiative-value, [data-metric="initiative"]');
        if (initiativeScoreElement) {
            initiativeScoreElement.textContent = score;
        }
        
        // 주도권 진행률 바 업데이트
        const initiativeProgressBar = document.querySelector('.initiative-progress, .initiative-bar, [data-progress="initiative"]');
        if (initiativeProgressBar) {
            initiativeProgressBar.style.width = `${score}%`;
        }
        
        // 주도권 팝업 데이터 업데이트
        if (window.currentInitiativeData) {
            window.currentInitiativeData = {
                ...window.currentInitiativeData,
                score: score,
                initiative: this.currentAnalysis.initiative
            };
        }
    }
    
    /**
     * 콜백 함수 등록
     */
    onUpdate(metric, callback) {
        if (this.updateCallbacks.hasOwnProperty(metric)) {
            this.updateCallbacks[metric] = callback;
        }
    }
    
    /**
     * 연결 해제
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        if (this.analysisWs) {
            this.analysisWs.close();
            this.analysisWs = null;
        }
        
        // 주기적 상태 체크 인터벌 정리
        if (this.videoStatusInterval) {
            clearInterval(this.videoStatusInterval);
            this.videoStatusInterval = null;
        }
        
        this.isConnected = false;
        this.isAnalysisConnected = false;
        
        console.log("🔌 MediaPipe 분석기 연결 해제됨");
    }
    
    /**
     * 하이브리드 모드 초기화
     */
    initializeHybridMode() {
        console.log("🔄 [MediaPipe] 하이브리드 모드 초기화 시작");
        
                    // 서버 분석 관련 변수들
            this.lastServerAnalysis = 0;
            this.serverAnalysisInterval = 5000; // 5초마다 (고화질 대응)
            this.currentMediaPipeScores = {};
            this.serverAnalysisResults = {};
            this.lastExpressionScore = 0;  // 마지막 서버 표정 점수 저장
        this.isServerAnalysisRunning = false;
        
        // 실시간 UI 업데이트 콜백들
        this.realtimeCallbacks = {
            expression: [],
            concentration: [],
            gaze: [],
            blinking: [],
            posture: [],
            initiative: []
        };
        
        // MediaPipe 초기화
        this.initializeMediaPipe();
        
        console.log("✅ [MediaPipe] 하이브리드 모드 초기화 완료");
    }
    
    /**
     * MediaPipe 초기화
     */
    async initializeMediaPipe() {
        try {
            console.log("🎯 [MediaPipe] 초기화 시작...");
            
            // ES6 모듈 import 방식으로 MediaPipe 로드
            const { FaceLandmarker, FilesetResolver } = await import("./vision.js");
            
            console.log("✅ [MediaPipe] ES6 모듈 로드 완료");
            
            // Vision 초기화
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            console.log("🔧 [MediaPipe] FaceLandmarker 생성 중...");
            
            // GPU 모드로 시도
            try {
                this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        delegate: 'GPU'
                    },
                    outputFaceBlendshapes: false,
                    outputFacialTransformationMatrixes: false,
                    runningMode: 'IMAGE',
                    numFaces: 1
                });
                
                this.isMediaPipeReady = true;
                console.log("✅ [MediaPipe] FaceLandmarker 초기화 완료 (GPU 모드)!");
                
                // 초기화 완료 후 비디오 분석 시작
                this.startVideoAnalysis();
                return true;
                
            } catch (gpuError) {
                console.warn("⚠️ [MediaPipe] GPU 모드 실패, CPU 모드로 재시도...", gpuError);
                
                // CPU 모드로 재시도
                this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        delegate: 'CPU'
                    },
                    outputFaceBlendshapes: false,
                    outputFacialTransformationMatrixes: false,
                    runningMode: 'IMAGE',
                    numFaces: 1
                });
                
                this.isMediaPipeReady = true;
                console.log("✅ [MediaPipe] FaceLandmarker 초기화 완료 (CPU 모드)!");
                
                // 초기화 완료 후 비디오 분석 시작
                this.startVideoAnalysis();
                return true;
            }
            
        } catch (error) {
            console.error("❌ [MediaPipe] 초기화 실패:", error);
            this.isMediaPipeReady = false;
            return false;
        }
    }
    
    /**
     * 카메라 분석 시작 (화면에 표시되지 않는 백그라운드 카메라)
     */
    async startVideoAnalysis() {
        try {
            console.log("📹 [MediaPipe] 백그라운드 카메라 분석 시작...");
            
            // 실제 카메라 스트림 가져오기 (화면에 표시하지 않음) - 유연한 고화질 설정
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280, min: 640 },
                    height: { ideal: 720, min: 480 },
                    frameRate: { ideal: 30, min: 15 },
                    facingMode: 'user',
                    aspectRatio: { ideal: 16/9 },
                    resizeMode: 'none'
                },
                audio: false 
            });
            
            console.log("✅ [MediaPipe] 카메라 스트림 획득 완료");
            
            // 숨겨진 비디오 요소 생성 (화면에 표시하지 않음)
            const hiddenVideo = document.createElement('video');
            hiddenVideo.style.display = 'none';
            hiddenVideo.style.position = 'absolute';
            hiddenVideo.style.left = '-9999px';
            hiddenVideo.style.width = '1px';
            hiddenVideo.style.height = '1px';
            hiddenVideo.autoplay = true;
            hiddenVideo.muted = true;
            hiddenVideo.playsInline = true;
            
            // 카메라 스트림을 숨겨진 비디오에 연결
            hiddenVideo.srcObject = stream;
            document.body.appendChild(hiddenVideo);
            
            // 비디오가 로드될 때까지 대기
            await new Promise((resolve) => {
                hiddenVideo.addEventListener('loadeddata', resolve, { once: true });
            });
            
            // 백그라운드 카메라 강제 재생
            try {
                await hiddenVideo.play();
                console.log("✅ [MediaPipe] 백그라운드 카메라 재생 시작");
            } catch (playError) {
                console.warn("⚠️ [MediaPipe] 백그라운드 카메라 자동 재생 실패, 사용자 상호작용 대기");
                
                // 사용자 상호작용 후 재생 시도
                const startPlayback = async () => {
                    try {
                        await hiddenVideo.play();
                        console.log("✅ [MediaPipe] 사용자 상호작용 후 백그라운드 카메라 재생 시작");
                        document.removeEventListener('click', startPlayback);
                        document.removeEventListener('keydown', startPlayback);
                    } catch (err) {
                        console.error("❌ [MediaPipe] 백그라운드 카메라 재생 실패:", err);
                    }
                };
                
                document.addEventListener('click', startPlayback, { once: true });
                document.addEventListener('keydown', startPlayback, { once: true });
            }
            
            console.log("✅ [MediaPipe] 백그라운드 카메라 준비 완료, 분석 시작");
            
            // 실시간 분석 루프 시작 (숨겨진 카메라 비디오 사용)
            this.analysisLoop(hiddenVideo);
            
        } catch (error) {
            console.error("❌ [MediaPipe] 카메라 분석 시작 실패:", error);
            
            if (error.name === 'OverconstrainedError') {
                console.log("💡 [MediaPipe] 카메라 해상도 제약 오류. 더 낮은 해상도로 재시도합니다.");
                // 더 낮은 해상도로 재시도
                try {
                    const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
                        video: { 
                            width: { ideal: 640, min: 320 },
                            height: { ideal: 480, min: 240 },
                            frameRate: { ideal: 15, min: 10 },
                            facingMode: 'user'
                        },
                        audio: false 
                    });
                    
                    console.log("✅ [MediaPipe] 낮은 해상도 카메라 스트림 획득 완료");
                    
                    // 숨겨진 비디오 요소 생성
                    const hiddenVideo = document.createElement('video');
                    hiddenVideo.style.display = 'none';
                    hiddenVideo.style.position = 'absolute';
                    hiddenVideo.style.left = '-9999px';
                    hiddenVideo.style.width = '1px';
                    hiddenVideo.style.height = '1px';
                    hiddenVideo.autoplay = true;
                    hiddenVideo.muted = true;
                    hiddenVideo.playsInline = true;
                    
                    hiddenVideo.srcObject = fallbackStream;
                    document.body.appendChild(hiddenVideo);
                    
                    await new Promise((resolve) => {
                        hiddenVideo.addEventListener('loadeddata', resolve, { once: true });
                    });
                    
                    try {
                        await hiddenVideo.play();
                        console.log("✅ [MediaPipe] 낮은 해상도 백그라운드 카메라 재생 시작");
                    } catch (playError) {
                        console.warn("⚠️ [MediaPipe] 낮은 해상도 카메라 자동 재생 실패, 사용자 상호작용 대기");
                        
                        const startPlayback = async () => {
                            try {
                                await hiddenVideo.play();
                                console.log("✅ [MediaPipe] 사용자 상호작용 후 낮은 해상도 카메라 재생 시작");
                                document.removeEventListener('click', startPlayback);
                                document.removeEventListener('keydown', startPlayback);
                            } catch (err) {
                                console.error("❌ [MediaPipe] 낮은 해상도 카메라 재생 실패:", err);
                            }
                        };
                        
                        document.addEventListener('click', startPlayback, { once: true });
                        document.addEventListener('keydown', startPlayback, { once: true });
                    }
                    
                    console.log("✅ [MediaPipe] 낮은 해상도 백그라운드 카메라 준비 완료, 분석 시작");
                    this.analysisLoop(hiddenVideo);
                    return;
                    
                } catch (fallbackError) {
                    console.error("❌ [MediaPipe] 낮은 해상도 카메라도 실패:", fallbackError);
                }
            }
            
            if (error.name === 'NotAllowedError') {
                console.log("💡 [MediaPipe] 카메라 권한이 거부되었습니다. 브라우저에서 카메라 접근을 허용해주세요.");
            } else if (error.name === 'NotFoundError') {
                console.log("💡 [MediaPipe] 카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.");
            } else if (error.name === 'NotReadableError') {
                console.log("💡 [MediaPipe] 카메라가 다른 애플리케이션에서 사용 중입니다. 다른 앱을 종료해주세요.");
            } else {
                console.log("💡 [MediaPipe] 카메라 접근에 실패했습니다. 브라우저 설정을 확인해주세요.");
            }
        }
    }
    
    /**
     * 실시간 분석 루프 (백그라운드 카메라용)
     */
    async analysisLoop(video) {
        // MediaPipe 준비 상태 확인
        if (!this.isMediaPipeReady || !this.faceLandmarker) {
            console.warn("⚠️ [MediaPipe] 아직 준비되지 않음");
            setTimeout(() => this.analysisLoop(video), 1500);
            return;
        }
        
        // 백그라운드 카메라 상태 확인
        if (!video || video.readyState !== 4 || video.ended) {
            console.warn("⚠️ [MediaPipe] 백그라운드 카메라가 준비되지 않음, 1.5초 후 재시도");
            console.log("📹 [카메라] 상태:", {
                exists: !!video,
                readyState: video ? video.readyState : 'N/A',
                readyStateText: video ? this.getReadyStateText(video.readyState) : 'N/A',
                paused: video ? video.paused : 'N/A',
                ended: video ? video.ended : 'N/A',
                srcObject: video ? !!video.srcObject : 'N/A',
                streamActive: video?.srcObject?.active || false
            });
            setTimeout(() => this.analysisLoop(video), 1500);
            return;
        }
        
        // 카메라가 일시정지된 경우 재생 시도
        if (video && video.paused) {
            console.log("🔄 [MediaPipe] 백그라운드 카메라 재생 시도...");
            try {
                await video.play();
                console.log("✅ [MediaPipe] 백그라운드 카메라 재생 성공");
            } catch (playError) {
                console.warn("⚠️ [MediaPipe] 백그라운드 카메라 재생 실패:", playError);
                setTimeout(() => this.analysisLoop(video), 1500);
                return;
            }
        }
        
        try {
            // 현재 프레임 분석
            const startTimeMs = performance.now();
            const results = await this.faceLandmarker.detect(video, startTimeMs);
            
            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                // 얼굴이 감지된 경우
                const landmarks = results.faceLandmarks[0];
                
                // 실시간 점수 계산
                const scores = this.calculateRealtimeScores(landmarks);
                
                // 현재 점수 저장
                this.currentMediaPipeScores = scores;
                
                // UI 업데이트
                this.updateRealtimeUI(scores);
                
                // 분석 상태 업데이트 (실제 동작 내용 표시)
                this.updateAnalysisStatus(scores);
                
                // 팝업 데이터 업데이트
                this.updateAllPopupData(scores);
                
                // 서버 AI 모델 분석 스케줄링 (3초 주기)
                console.log("🔄 [디버그] 서버 분석 스케줄링 시도...");
                this.scheduleServerAnalysis(video, scores);
                
                console.log("👤 [MediaPipe] 얼굴 감지됨, 점수:", scores);
                
                // 연속 실패 카운터 리셋
                this.consecutiveFailures = 0;
            } else {
                // 얼굴이 감지되지 않은 경우
                this.consecutiveFailures++;
                console.log(`❌ [MediaPipe] 얼굴이 감지되지 않음 (${this.consecutiveFailures}회 연속)`);
                
                // 연속 실패가 많으면 UI 클리어 (더 관대한 임계값)
                if (this.consecutiveFailures >= 15) {
                    this.clearRealtimeUI();
                    this.resetAnalysisStatus();
                }
            }
            
        } catch (error) {
            console.error("❌ [MediaPipe] 분석 중 오류:", error);
            this.consecutiveFailures++;
            
                    // 오류 발생시 재시도 간격 조정 (더 긴 간격으로 안정성 향상)
        const retryDelay = this.consecutiveFailures >= 15 ? 10000 : 5000;
        setTimeout(() => this.analysisLoop(video), retryDelay);
            return;
        }
        
        // 다음 프레임 분석 (2fps로 성능 최적화)
        if (this.isMediaPipeReady) {
            setTimeout(() => this.analysisLoop(video), 500); // 500ms 간격 (2fps)
        }
    }
    
    /**
     * MediaPipe 실시간 점수 계산
     */
    calculateRealtimeScores(landmarks) {
        // 8가지 감정 분석은 서버 MLflow 모델에서 처리하므로 MediaPipe에서는 기본값만 설정
        const expressionProbabilities = {
            happy: 0.125, sad: 0.125, angry: 0.125, surprised: 0.125,
            fearful: 0.125, disgusted: 0.125, neutral: 0.125, contempt: 0.125
        };
        
        // 시선 데이터 계산
        const gazeData = this.calculateGazeData(landmarks);
        
        const scores = {
            expression: 0,  // MediaPipe 표정 점수 비활성화 (서버 MLflow 모델만 사용)
            concentration: this.calculateConcentrationScore(landmarks),
            gaze: this.calculateGazeScore(landmarks),
            blinking: this.calculateBlinkingScore(landmarks).score,
            posture: this.calculatePostureScore(landmarks),
            initiative: this.calculateInitiativeScore(landmarks),
            expressionProbabilities: expressionProbabilities,  // 8가지 표정 확률
            gazeDirection: gazeData.gazeDirection,  // 시선 방향 데이터
            eyeCenter: gazeData.eyeCenter  // 눈동자 중심 데이터
        };
        
        this.currentMediaPipeScores = scores;
        return scores;
    }
    
    /**
     * 실시간 UI 업데이트 (가중 평균 점수 우선 표시)
     */
    updateRealtimeUI(scores) {
        try {
                    // 표정은 서버 결과가 있을 때만 업데이트, 없으면 이전 값 유지
        const displayScores = {
            expression: window.currentExpressionData?.weightedScore > 0 ? window.currentExpressionData.weightedScore : (this.lastExpressionScore || 0),
            concentration: (window.currentConcentrationData?.weightedScore > 0) ? window.currentConcentrationData.weightedScore : scores.concentration,
            gaze: (window.currentGazeData?.weightedScore > 0) ? window.currentGazeData.weightedScore : scores.gaze,
            blinking: (window.currentBlinkingData?.weightedScore > 0) ? window.currentBlinkingData.weightedScore : scores.blinking,
            posture: (window.currentPostureData?.weightedScore > 0) ? window.currentPostureData.weightedScore : scores.posture,
            initiative: (window.currentInitiativeData?.weightedScore > 0) ? window.currentInitiativeData.weightedScore : scores.initiative
        };
        
        // 서버 결과가 있으면 마지막 표정 점수 저장
        if (window.currentExpressionData?.weightedScore > 0) {
            this.lastExpressionScore = window.currentExpressionData.weightedScore;
        }
            
            // 표정 점수 업데이트
            this.updateExpressionScore(displayScores.expression);
            this.updateConcentrationScore(displayScores.concentration);
            this.updateGazeScore(displayScores.gaze);
            this.updateBlinkingScore(displayScores.blinking);
            this.updatePostureScore(displayScores.posture);
            
            console.log("📊 실시간 점수 업데이트:", {
                mediapipe: scores,
                display: displayScores,
                hasServerAnalysis: !!this.serverAnalysisResults
            });
        } catch (error) {
            console.warn("⚠️ UI 업데이트 실패:", error);
        }
    }
    
    /**
     * 표정 점수 UI 업데이트
     */
    updateExpressionScore(score) {
        // 여러 가능한 ID 시도
        const possibleIds = ['expression-score', 'expressionScore', 'expression_score', 'score-expression'];
        const element = this.findElementByIds(possibleIds);
        
        if (element) {
            if (score > 0) {
                element.textContent = Math.round(score);
                element.style.color = this.getScoreColor(score);
            } else {
                element.textContent = "분석중";
                element.style.color = "#6b7280";  // 회색
            }
        } else {
            console.log("📊 [UI] 표정 점수:", score > 0 ? Math.round(score) : "분석 대기 중");
        }
    }
    
    /**
     * 집중도 점수 UI 업데이트
     */
    updateConcentrationScore(score) {
        const possibleIds = ['concentration-score', 'concentrationScore', 'concentration_score', 'score-concentration'];
        const element = this.findElementByIds(possibleIds);
        
        if (element) {
            element.textContent = Math.round(score);
            element.style.color = this.getScoreColor(score);
        } else {
            console.log("📊 [UI] 집중도 점수:", Math.round(score));
        }
    }
    
    /**
     * 시선 점수 UI 업데이트
     */
    updateGazeScore(score) {
        const possibleIds = ['gaze-score', 'gazeScore', 'gaze_score', 'score-gaze'];
        const element = this.findElementByIds(possibleIds);
        
        if (element) {
            element.textContent = Math.round(score);
            element.style.color = this.getScoreColor(score);
        } else {
            console.log("📊 [UI] 시선 점수:", Math.round(score));
        }
    }
    
    /**
     * 깜빡임 점수 UI 업데이트
     */
    updateBlinkingScore(score) {
        const possibleIds = ['blinking-score', 'blinkingScore', 'blinking_score', 'score-blinking'];
        const element = this.findElementByIds(possibleIds);
        
        if (element) {
            element.textContent = Math.round(score);
            element.style.color = this.getScoreColor(score);
        } else {
            console.log("📊 [UI] 깜빡임 점수:", Math.round(score));
        }
    }
    
    /**
     * 자세 점수 UI 업데이트
     */
    updatePostureScore(score) {
        const possibleIds = ['posture-score', 'postureScore', 'posture_score', 'score-posture'];
        const element = this.findElementByIds(possibleIds);
        
        if (element) {
            element.textContent = Math.round(score);
            element.style.color = this.getScoreColor(score);
        } else {
            console.log("📊 [UI] 자세 점수:", Math.round(score));
        }
    }
    
    /**
     * 점수에 따른 색상 반환
     */
    getScoreColor(score) {
        if (score >= 80) return '#4CAF50'; // 녹색 (좋음)
        if (score >= 60) return '#FF9800'; // 주황색 (보통)
        return '#F44336'; // 빨간색 (나쁨)
    }
    
    /**
     * 서버 분석 스케줄링 (3초 주기로 활성화)
     */
    async scheduleServerAnalysis(video, mediapipeScores) {
        // 서버 분석 활성화 (3초 주기)
        console.log("🔄 서버 분석 스케줄링 (3초 주기)");
        
        const now = Date.now();
        
        if (this.isServerAnalysisRunning || 
            (now - this.lastServerAnalysis) < this.serverAnalysisInterval) {
            console.log("⏰ [디버그] 서버 분석 대기 중:", {
                isRunning: this.isServerAnalysisRunning,
                timeSinceLast: now - this.lastServerAnalysis,
                interval: this.serverAnalysisInterval
            });
            return; // 아직 시간 안됨
        }
        
        this.lastServerAnalysis = now;
        this.isServerAnalysisRunning = true;
        
        console.log("🚀 [디버그] 서버 분석 시작:", {
            timestamp: now,
            mediapipeScores: mediapipeScores
        });
        
        try {
            await this.sendFrameToServer(video, mediapipeScores);
        } catch (error) {
            console.warn("⚠️ 서버 분석 실패, MediaPipe로만 계속 진행:", error);
        } finally {
            this.isServerAnalysisRunning = false;
            console.log("✅ [디버그] 서버 분석 완료");
        }
    }
    
    /**
     * 서버로 프레임 및 MediaPipe 점수 전송
     */
    async sendFrameToServer(video, mediapipeScores) {
        const startTime = performance.now();
        
        // 캔버스에 현재 프레임 캡처
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        // 이미지를 base64로 변환 - 고품질 설정
        const imageData = canvas.toDataURL('image/jpeg', 0.95);
        
        try {
            console.log("🧠 서버 표정 분석 요청...");
            // 서버 URL 설정 - window.serverUrl 우선 사용 (GKE 백엔드)
            let apiUrl;
            
            if (window.serverUrl) {
                // window.serverUrl에서 실제 서버 도메인 추출
                if (window.serverUrl.includes('/api/gke')) {
                    // '/api/gke' 부분을 제거하여 실제 서버 도메인 추출
                    apiUrl = window.serverUrl.replace('/api/gke', '').replace(/\/$/, '');
                } else {
                    apiUrl = window.serverUrl.replace(/\/$/, '');
                }
                console.log("🔍 [디버그] window.serverUrl 사용:", window.serverUrl, "→", apiUrl);
            } else {
                // fallback: window.location.origin 사용
                apiUrl = window.location.origin;
                
                // 개발 환경에서만 포트 8000 추가 (localhost인 경우)
                if (apiUrl.includes('localhost') && !apiUrl.includes(':8000')) {
                    const url = new URL(apiUrl);
                    url.port = '8000';
                    apiUrl = url.toString().replace(/\/$/, '');
                }
                console.log("🔍 [디버그] window.location.origin 사용:", apiUrl);
            }
            
            console.log("🔍 [디버그] window.serverUrl:", window.serverUrl);
            console.log("🔍 [디버그] window.location.origin:", window.location.origin);
            console.log("🔍 [디버그] 최종 apiUrl:", apiUrl);
            // GKE 프록시 경로 사용 여부 결정
            let finalApiUrl;
            if (window.serverUrl && window.serverUrl.includes('/api/gke')) {
                // Vercel → GKE 프록시를 사용하는 경우
                finalApiUrl = `${window.location.origin}/api/gke/api/expression/analyze`;
                console.log("🔍 [디버그] GKE 프록시 사용:", finalApiUrl);
            } else {
                // 직접 연결하는 경우  
                finalApiUrl = `${apiUrl}/api/expression/analyze`;
                console.log("🔍 [디버그] 직접 연결:", finalApiUrl);
            }
            
            console.log("🔍 [디버그] 최종 API URL:", finalApiUrl);
            console.log("🔍 [디버그] 브라우저 캐시 확인용 - 버전:", "v2024-12-26-2");
            console.log("🔍 [디버그] 요청 데이터 크기:", JSON.stringify({
                image: imageData.substring(0, 100) + "...",
                mediapipe_scores: mediapipeScores,
                timestamp: Date.now(),
                user_id: window.userId || 'anonymous'
            }).length, "bytes");
            
            const response = await fetch(finalApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: imageData,
                    mediapipe_scores: mediapipeScores,
                    timestamp: Date.now(),
                    user_id: window.userId || 'anonymous'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log("✅ [디버그] 서버 분석 성공:", result);
                this.handleServerAnalysisResult(result);
            } else {
                console.warn("⚠️ 서버 분석 응답 오류:", response.status, response.statusText);
                console.log("🔍 [디버그] 응답 헤더:", Object.fromEntries(response.headers.entries()));
                console.log("🔍 [디버그] 응답 URL:", response.url);
                
                // 서버 오류 응답 내용 확인
                try {
                    const errorText = await response.text();
                    console.log("🔍 [디버그] 서버 오류 응답:", errorText);
                } catch (e) {
                    console.log("🔍 [디버그] 서버 오류 응답 읽기 실패:", e);
                }
                
                console.log("📊 [서버 오류] MediaPipe 점수만 사용하여 UI 업데이트 계속");
                // UI 깜빡임 방지를 위해 서버 분석 결과 처리는 생략
            }
            
        } catch (error) {
            console.warn("⚠️ 서버 분석 요청 실패:", error);
            // 네트워크 오류시에도 UI 업데이트는 계속 (MediaPipe 점수 사용)
            console.log("📊 [서버 실패] MediaPipe 점수만 사용하여 UI 업데이트 계속");
            // UI 깜빡임 방지를 위해 서버 분석 결과 처리는 생략
        } finally {
            // 성능 모니터링
            const processingTime = performance.now() - startTime;
            console.log(`⏱️ [성능] 서버 분석 처리 시간: ${processingTime.toFixed(0)}ms`);
            
            // 동적 주기 조정
            if (processingTime > 2500) { // 2.5초 초과
                this.serverAnalysisInterval = Math.min(5000, this.serverAnalysisInterval * 1.2);
                console.log(`🔄 [성능] 주기 조정: ${this.serverAnalysisInterval}ms로 증가`);
            } else if (processingTime < 1500) { // 1.5초 미만
                this.serverAnalysisInterval = Math.max(2000, this.serverAnalysisInterval * 0.9);
                console.log(`🔄 [성능] 주기 조정: ${this.serverAnalysisInterval}ms로 감소`);
            }
        }
    }
    
    /**
     * 서버 분석 결과 처리 (서버 80% + MediaPipe 20% 가중 평균)
     */
    handleServerAnalysisResult(result) {
        console.log("🎯 서버 분석 결과:", result);
        console.log("🔍 [디버그] 서버 분석 결과 상세:", {
            hasModelScores: !!result.model_scores,
            hasMediapipeScores: !!result.mediapipe_scores,
            modelScores: result.model_scores,
            mediapipeScores: result.mediapipe_scores,
            isAnomaly: result.is_anomaly,
            feedback: result.feedback
        });
        
        this.serverAnalysisResults = result;
        
        // MLflow 모델을 100% 사용 (MediaPipe는 랜드마크 감지만 가능)
        const serverWeight = 1.0;
        const mediapipeWeight = 0.0;
        
        const modelScores = result.model_scores || {};
        const mediapipeScores = result.mediapipe_scores || {};
        
        // 가중 평균 점수 계산
        const weightedScores = {};
        const scoreTypes = ['expression', 'concentration', 'gaze', 'blinking', 'posture', 'initiative'];
        
        scoreTypes.forEach(type => {
            let serverScore = modelScores[type] || 0;
            const mediapipeScore = mediapipeScores[type] || 0;
            
            // expression의 경우 서버에서 올바른 점수 필드 사용
            if (type === 'expression') {
                // 서버에서 expression 점수 사용 (이미 0-100 범위로 변환됨)
                if (modelScores.expression !== undefined) {
                    serverScore = modelScores.expression;
                } else if (modelScores.confidence !== undefined) {
                    // confidence가 0-1 범위라면 0-100으로 변환
                    serverScore = Math.round(modelScores.confidence * 100);
                }
            }
            
            // 가중 평균 계산
            const weightedScore = Math.round(
                (serverScore * serverWeight) + (mediapipeScore * mediapipeWeight)
            );
            
            weightedScores[type] = weightedScore;
        });
        
        console.log("⚖️ MLflow 모델 점수 (100% 사용):", {
            server: modelScores,
            mediapipe: mediapipeScores,
            weighted: weightedScores
        });
        
        // 가중 평균 점수로 UI 업데이트
        this.updateRealtimeUI(weightedScores);
        
        // 모델 vs MediaPipe 점수 비교 (디버깅용)
        if (result.is_anomaly) {
            console.warn("⚠️ 점수 불일치 감지:", {
                model: result.model_scores,
                mediapipe: result.mediapipe_scores,
                difference: result.score_differences
            });
            
            // 이상 감지 알림 비활성화 (사용자 요청)
            // this.showAnomalyAlert(result);
            console.log("🔕 [UI] 이상 감지 팝업 비활성화됨");
        }
        
        // 피드백 UI 업데이트
        this.updateFeedbackUI(result);
        
        // 서버 분석 결과를 전역 변수에 저장 (팝업에서 사용)
        if (!window.currentExpressionData) {
            window.currentExpressionData = {};
        }
        
        // 서버 분석 결과 저장
        window.currentExpressionData.serverAnalysis = result;
        window.currentExpressionData.weightedScore = weightedScores.expression;
        window.currentExpressionData.lastUpdate = new Date().toISOString();
        window.currentExpressionData.isRealTime = true;
            
            // 서버 MLflow 모델의 8가지 감정 분석 결과 저장
            if (result.model_scores) {
                // all_scores 우선, 없으면 개별 감정 점수로 구성
                let expressionProbabilities = result.model_scores.all_scores;
                
                if (!expressionProbabilities) {
                    // all_scores가 없으면 개별 감정 점수로 구성
                    expressionProbabilities = {
                        happy: result.model_scores.happiness || 0,
                        sad: result.model_scores.sadness || 0,
                        angry: result.model_scores.anger || 0,
                        surprised: result.model_scores.surprise || 0,
                        fearful: result.model_scores.fear || 0,
                        disgusted: result.model_scores.disgust || 0,
                        neutral: result.model_scores.neutral || 0,
                        contempt: result.model_scores.contempt || 0
                    };
                }
                
                window.currentExpressionData.expressionProbabilities = expressionProbabilities;
                window.currentExpressionData.confidence = result.model_scores.confidence || 0.8;
                window.currentExpressionData.emotion = result.model_scores.emotion || result.model_emotion || 'neutral';
                window.currentExpressionData.expression = result.model_emotion || 'neutral';
                
                console.log("✅ [MLflow] 전역 변수 업데이트 완료:", {
                    weightedScore: window.currentExpressionData.weightedScore,
                    confidence: window.currentExpressionData.confidence,
                    emotion: window.currentExpressionData.emotion,
                    hasExpressionProbabilities: !!window.currentExpressionData.expressionProbabilities
                });
                
                console.log("🎭 [서버] MLflow 8-감정 분석 결과:", {
                    all_scores: expressionProbabilities,
                    confidence: result.model_scores.confidence,
                    emotion: window.currentExpressionData.emotion,
                    expression_score: result.model_scores.expression,
                    has_all_scores: !!result.model_scores.all_scores
                });
            }
        }
        
        // 다른 분석 데이터도 업데이트
        if (window.currentConcentrationData) {
            window.currentConcentrationData.weightedScore = weightedScores.concentration;
        }
        if (window.currentGazeData) {
            window.currentGazeData.weightedScore = weightedScores.gaze;
        }
        if (window.currentBlinkingData) {
            window.currentBlinkingData.weightedScore = weightedScores.blinking;
        }
        if (window.currentPostureData) {
            window.currentPostureData.weightedScore = weightedScores.posture;
        }
        if (window.currentInitiativeData) {
            window.currentInitiativeData.weightedScore = weightedScores.initiative;
        }
    }
    
    /**
     * 실시간 UI 클리어
     */
    clearRealtimeUI() {
        const scoreElements = document.querySelectorAll('[id*="score"]');
        scoreElements.forEach(element => {
            element.textContent = '0';
            element.style.color = '#F44336';
        });
    }
    
    /**
     * 분석 상태 리셋
     */
    resetAnalysisStatus() {
        this.consecutiveFailures = 0;
        this.currentMediaPipeScores = {
            expression: 0,
            concentration: 0,
            gaze: 0,
            blinking: 0,
            posture: 0,
            initiative: 0
        };
        console.log("🔄 [MediaPipe] 분석 상태 리셋 완료");
    }
    
    /**
     * 현재 분석 결과 반환
     */
    getCurrentAnalysis() {
        return {
            realtime: this.currentMediaPipeScores,
            server: this.serverAnalysisResults,
            timestamp: Date.now()
        };
    }
    
    /**
     * 피드백 UI 업데이트
     */
    updateFeedbackUI(serverResult) {
        console.log("🎨 피드백 UI 업데이트:", serverResult);
        
        // 표정 분석 결과를 전역 변수로 저장 (팝업에서 사용)
        window.currentExpressionAnalysis = serverResult;
        
        // 감정 표시 업데이트
        this.updateEmotionDisplay(serverResult.model_emotion, serverResult.feedback?.confidence || 0);
        
        // 이상 감지 알림
        if (serverResult.is_anomaly) {
            this.showAnomalyNotification(serverResult);
        }
        
        // 팝업 데이터 업데이트 (기존 팝업들과 연동)
        this.updatePopupData(serverResult);
    }
    
    /**
     * 이상 감지 알림 표시
     */
    showAnomalyAlert(result) {
        console.warn("🚨 이상 감지 알림:", result);
        
        // 간단한 알림 표시 (나중에 더 정교한 UI로 대체 가능)
        const alertDiv = document.createElement('div');
        alertDiv.className = 'anomaly-alert';
        alertDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: #ff9800; color: white; 
            padding: 10px 15px; border-radius: 8px; 
            font-size: 14px; z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        alertDiv.innerHTML = `
            <strong>⚠️ 분석 정확도 확인</strong><br/>
            모델-MediaPipe 점수 차이: ${Math.max(...Object.values(result.score_differences || {})).toFixed(2)}
        `;
        
        document.body.appendChild(alertDiv);
        
        // 5초 후 자동 제거
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }
    
    /**
     * 감정 표시 업데이트
     */
    updateEmotionDisplay(emotion, confidence) {
        // 메인 감정 표시 업데이트
        const emotionElement = document.querySelector('.current-emotion, [data-emotion]');
        if (emotionElement) {
            emotionElement.textContent = emotion || 'neutral';
            emotionElement.setAttribute('data-confidence', confidence.toFixed(2));
        }
        
        // 신뢰도 표시
        const confidenceElement = document.querySelector('.emotion-confidence, [data-confidence-display]');
        if (confidenceElement) {
            confidenceElement.textContent = `${(confidence * 100).toFixed(1)}%`;
        }
    }
    
    /**
     * 팝업 데이터 업데이트
     */
    updatePopupData(serverResult) {
        // 표정 상세 팝업 데이터 업데이트
        if (window.currentExpressionData) {
            window.currentExpressionData = {
                ...window.currentExpressionData,
                serverAnalysis: serverResult,
                lastUpdate: new Date().toISOString()
            };
        }
        
        // 집중도 팝업 데이터 업데이트  
        if (window.currentConcentrationData) {
            window.currentConcentrationData = {
                ...window.currentConcentrationData,
                modelScore: serverResult.model_scores?.concentration || 0,
                mediapipeScore: serverResult.mediapipe_scores?.concentration || 0,
                scoreDifference: serverResult.score_differences?.concentration || 0,
                isAnomaly: serverResult.is_anomaly
            };
        }
    }
    
    /**
     * 모델 점수로 UI 조정
     */
    adjustUIWithModelScores(modelScores) {
        console.log("🔧 모델 점수로 UI 조정:", modelScores);
        
        // 모델 기반 정확한 점수로 UI 미세 조정
        // (MediaPipe 실시간 점수는 유지하되, 2초마다 모델 점수로 보정)
        
        if (modelScores.happiness !== undefined) {
            this.adjustExpressionUI(modelScores.happiness, 'happiness');
        }
        
        if (modelScores.concentration !== undefined) {
            this.adjustConcentrationUI(modelScores.concentration);
        }
    }
    
    /**
     * 표정 UI 미세 조정
     */
    adjustExpressionUI(modelScore, emotion) {
        // 모델 점수가 MediaPipe와 크게 다른 경우 점진적 조정
        const currentScore = this.currentMediaPipeScores.expression || 0;
        const diff = Math.abs(modelScore - currentScore);
        
        if (diff > 0.2) { // 20% 이상 차이시 조정
            const adjustedScore = (currentScore + modelScore) / 2; // 평균값 사용
            console.log(`🔧 표정 점수 조정: ${currentScore.toFixed(2)} → ${adjustedScore.toFixed(2)} (모델: ${modelScore.toFixed(2)})`);
            this.updateExpressionScore(adjustedScore);
        }
    }
    
    /**
     * 연결 상태 확인
     */
    isConnected() {
        return true; // 하이브리드 모드에서는 항상 true
    }
    
    // === MediaPipe 점수 계산 함수들 (실제 구현) ===
    
    /**
     * 표정 점수 계산 (데이팅 친화적 점수 시스템)
     */
    calculateExpressionScore(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return 0;
            }
            
            // MediaPipe는 랜드마크 감지만 하고, 실제 감정 분석은 서버 MLflow 모델에서 처리
            // 기본 점수는 중간값으로 설정 (서버 분석 결과가 우선)
            const basicScore = 50;
            
            // 전역 변수에 기본 데이터 저장 (실제 감정 분석은 서버에서)
            if (!window.currentExpressionData) {
                window.currentExpressionData = {};
            }
            window.currentExpressionData.basicScore = basicScore;
            window.currentExpressionData.isRealTime = true;
            
            console.log(`📊 [MediaPipe] 랜드마크 감지 완료 (기본 점수: ${basicScore})`);
            
            return basicScore;
            
        } catch (error) {
            console.error("❌ 표정 점수 계산 실패:", error);
            return 0;
        }
    }
    
    /**
     * 8가지 표정 분석 (happy, sad, angry, surprised, fearful, disgusted, neutral, contempt)
     */
    analyzeEightExpressions(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                console.warn("⚠️ [MediaPipe] 랜드마크 데이터 부족:", landmarks?.length || 0);
                return {
                    happy: 0.25, sad: 0, angry: 0, surprised: 0.25, 
                    fearful: 0.25, disgusted: 0, neutral: 0.25, contempt: 0
                };
            }
            
            // 더 정교한 랜드마크 분석 (올바른 MediaPipe 인덱스 사용)
        // 입술 분석 (미소, 슬픔, 분노, 놀람)
            const mouthLeft = landmarks[61];      // 입술 왼쪽
            const mouthRight = landmarks[291];    // 입술 오른쪽
            const mouthTop = landmarks[13];       // 입술 위
            const mouthBottom = landmarks[14];    // 입술 아래
            const mouthCenter = landmarks[0];     // 코 끝 (중앙 기준점)
            
        const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
        const mouthHeight = Math.abs(mouthTop.y - mouthBottom.y);
        const smileRatio = mouthWidth / (mouthHeight + 0.001);
        
            // 입술 모서리 분석 (미소 강도) - 올바른 인덱스
            const leftCorner = landmarks[78];     // 왼쪽 입술 모서리
            const rightCorner = landmarks[308];   // 오른쪽 입술 모서리
            const cornerHeight = (leftCorner.y + rightCorner.y) / 2;
            const smileIntensity = Math.max(0, (cornerHeight - mouthCenter.y) * 10);
            
            // 랜드마크 값 디버깅 (3초마다) - 더 자세한 정보
            if (!this.lastLandmarkDebugTime || Date.now() - this.lastLandmarkDebugTime > 3000) {
                console.log("🔍 [MediaPipe] 랜드마크 값 디버깅:", {
                    landmarksCount: landmarks.length,
                    mouthLeft: { x: mouthLeft.x.toFixed(4), y: mouthLeft.y.toFixed(4) },
                    mouthRight: { x: mouthRight.x.toFixed(4), y: mouthRight.y.toFixed(4) },
                    mouthTop: { x: mouthTop.x.toFixed(4), y: mouthTop.y.toFixed(4) },
                    mouthBottom: { x: mouthBottom.x.toFixed(4), y: mouthBottom.y.toFixed(4) },
                    mouthCenter: { x: mouthCenter.x.toFixed(4), y: mouthCenter.y.toFixed(4) },
                    mouthWidth: mouthWidth.toFixed(4),
                    mouthHeight: mouthHeight.toFixed(4),
                    smileRatio: smileRatio.toFixed(4),
                    leftCorner: { x: leftCorner.x.toFixed(4), y: leftCorner.y.toFixed(4) },
                    rightCorner: { x: rightCorner.x.toFixed(4), y: rightCorner.y.toFixed(4) },
                    smileIntensity: smileIntensity.toFixed(4),
                    leftEyeTop: { x: leftEyeTop.x.toFixed(4), y: leftEyeTop.y.toFixed(4) },
                    leftEyeBottom: { x: leftEyeBottom.x.toFixed(4), y: leftEyeBottom.y.toFixed(4) },
                    rightEyeTop: { x: rightEyeTop.x.toFixed(4), y: rightEyeTop.y.toFixed(4) },
                    rightEyeBottom: { x: rightEyeBottom.x.toFixed(4), y: rightEyeBottom.y.toFixed(4) },
                    eyeOpenness: eyeOpenness.toFixed(4),
                    eyebrowDistance: eyebrowDistance.toFixed(4),
                    averageChange: averageChange.toFixed(4)
                });
                this.lastLandmarkDebugTime = Date.now();
            }
            
            // 눈썹 분석 (분노, 슬픔, 놀람) - 올바른 인덱스
            const leftEyebrow = landmarks[70];    // 왼쪽 눈썹
            const rightEyebrow = landmarks[300];  // 오른쪽 눈썹
            const leftEye = landmarks[159];       // 왼쪽 눈
            const rightEye = landmarks[386];      // 오른쪽 눈
        const eyebrowDistance = (
            Math.abs(leftEyebrow.y - leftEye.y) + 
            Math.abs(rightEyebrow.y - rightEye.y)
        ) / 2;
            
            // 눈 분석 (깜빡임, 집중도) - 올바른 인덱스
            const leftEyeTop = landmarks[159];    // 왼쪽 눈 위
            const leftEyeBottom = landmarks[145]; // 왼쪽 눈 아래
            const rightEyeTop = landmarks[386];   // 오른쪽 눈 위
            const rightEyeBottom = landmarks[374]; // 오른쪽 눈 아래
            const leftEyeOpen = Math.abs(leftEyeTop.y - leftEyeBottom.y);
            const rightEyeOpen = Math.abs(rightEyeTop.y - rightEyeBottom.y);
            const eyeOpenness = (leftEyeOpen + rightEyeOpen) / 2;
        
        // 코 분석 (혐오, 경멸)
        const nose = landmarks[1];
        const noseWrinkle = landmarks[168];
        const noseWrinkleIntensity = Math.abs(nose.y - noseWrinkle.y);
        
            // 이마 분석 (놀람, 두려움)
            const forehead = landmarks[10];
            const eyebrowHeight = (leftEyebrow.y + rightEyebrow.y) / 2;
            const foreheadTension = Math.abs(forehead.y - eyebrowHeight);
            
            // 동적 변화 감지 (이전 프레임과 비교)
            if (!this.previousLandmarks) {
                this.previousLandmarks = landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z }));
                this.landmarkHistory = [];
                console.log("🔄 [MediaPipe] 첫 번째 랜드마크 설정 완료");
            }
            
            // 랜드마크 변화량 계산 (더 민감하게)
            let totalChange = 0;
            let changeCount = 0;
            let maxChange = 0;
            let maxChangeIndex = 0;
            
            for (let i = 0; i < Math.min(landmarks.length, this.previousLandmarks.length); i++) {
                const current = landmarks[i];
                const previous = this.previousLandmarks[i];
                const change = Math.sqrt(
                    Math.pow(current.x - previous.x, 2) + 
                    Math.pow(current.y - previous.y, 2)
                );
                if (change > 0.001) { // 더 작은 변화도 감지
                    totalChange += change;
                    changeCount++;
                    if (change > maxChange) {
                        maxChange = change;
                        maxChangeIndex = i;
                    }
                }
            }
            const averageChange = changeCount > 0 ? totalChange / changeCount : 0;
            
            // 변화 감지 디버깅 (3초마다)
            if (!this.lastChangeDebugTime || Date.now() - this.lastChangeDebugTime > 3000) {
                console.log("🔄 [MediaPipe] 랜드마크 변화 감지:", {
                    totalChange: totalChange.toFixed(6),
                    changeCount: changeCount,
                    averageChange: averageChange.toFixed(6),
                    maxChange: maxChange.toFixed(6),
                    maxChangeIndex: maxChangeIndex,
                    landmarksCount: landmarks.length,
                    previousLandmarksCount: this.previousLandmarks.length
                });
                this.lastChangeDebugTime = Date.now();
            }
            
            // 이전 랜드마크 업데이트 (깊은 복사)
            this.previousLandmarks = landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z }));
            
            // 8가지 표정 확률 계산 (실제 랜드마크 값에 기반한 동적 계산)
        const expressions = {
                // 행복 (미소, 눈꺼풀 올라감, 볼 올라감)
                happy: Math.max(0.05, Math.min(1, 
                    Math.max(0, smileRatio - 1.2) * 2.0 + 
                    Math.max(0, smileIntensity - 0.1) * 5.0 + 
                    Math.max(0, eyebrowDistance - 0.08) * 8.0 +
                    (averageChange > 0.002 ? 0.3 : 0) // 변화가 있으면 행복 증가
                )),
                
                // 슬픔 (입술 내려감, 눈썹 내려감, 볼 내려감)
                sad: Math.max(0.05, Math.min(1, 
                    Math.max(0, 1.5 - smileRatio) * 1.5 + 
                    Math.max(0, 0.06 - eyebrowDistance) * 6.0 + 
                    Math.max(0, 0.012 - eyeOpenness) * 8.0 +
                    (averageChange < 0.001 ? 0.2 : 0) // 변화가 없으면 슬픔 증가
                )),
                
                // 분노 (눈썹 내려감, 입술 꾹 다물음, 이마 주름)
                angry: Math.max(0.05, Math.min(1, 
                    Math.max(0, 0.05 - eyebrowDistance) * 8.0 + 
                    Math.max(0, 1.3 - smileRatio) * 1.0 + 
                    Math.max(0, foreheadTension - 0.02) * 10.0 +
                    (averageChange > 0.005 ? 0.4 : 0) // 급격한 변화시 분노 증가
                )),
                
                // 놀람 (입술 벌어짐, 눈썹 올라감, 눈 크게 뜸)
                surprised: Math.max(0.05, Math.min(1, 
                    Math.max(0, smileRatio - 1.8) * 1.5 + 
                    Math.max(0, eyebrowDistance - 0.12) * 6.0 + 
                    Math.max(0, eyeOpenness - 0.025) * 8.0 +
                    (averageChange > 0.008 ? 0.5 : 0) // 큰 변화시 놀람 증가
                )),
                
                // 두려움 (눈썹 올라감, 입술 약간 벌어짐, 눈 반개)
                fearful: Math.max(0.05, Math.min(1, 
                    Math.max(0, eyebrowDistance - 0.10) * 4.0 + 
                    Math.max(0, smileRatio - 1.4) * 0.5 + 
                    Math.max(0, 0.010 - eyeOpenness) * 6.0 +
                    (averageChange > 0.003 ? 0.3 : 0) // 중간 변화시 두려움 증가
                )),
                
                // 혐오 (코 주름, 입술 오므림, 눈썹 내려감)
                disgusted: Math.max(0.05, Math.min(1, 
                    Math.max(0, noseWrinkleIntensity - 0.01) * 15.0 + 
                    Math.max(0, 1.1 - smileRatio) * 1.0 + 
                    Math.max(0, 0.06 - eyebrowDistance) * 3.0 +
                    (averageChange > 0.004 ? 0.2 : 0) // 변화시 혐오 증가
                )),
                
                // 중립 (기본 상태, 변화량 적음)
                neutral: Math.max(0.05, Math.min(1, 
                    0.6 - Math.abs(smileRatio - 1.3) * 0.2 - 
                    Math.abs(eyebrowDistance - 0.08) * 2.0 - 
                    Math.abs(eyeOpenness - 0.018) * 3.0 +
                    (averageChange < 0.002 ? 0.4 : 0) + // 변화가 적으면 중립 증가
                    (averageChange > 0.006 ? 0.1 : 0)   // 변화가 크면 중립 감소
                )),
                
                // 경멸 (입술 한쪽 올라감, 코 주름, 눈썹 약간 올라감)
                contempt: Math.max(0.05, Math.min(1, 
                    Math.max(0, noseWrinkleIntensity - 0.005) * 8.0 + 
                    Math.abs(smileRatio - 1.2) * 0.8 + 
                    Math.max(0, eyebrowDistance - 0.09) * 2.0 +
                    (averageChange > 0.003 ? 0.2 : 0) // 변화시 경멸 증가
                ))
            };
            
            // 확률 정규화 (합이 1이 되도록, 최소값 보장)
        const total = Object.values(expressions).reduce((sum, val) => sum + val, 0);
        if (total > 0) {
            Object.keys(expressions).forEach(key => {
                expressions[key] = expressions[key] / total;
            });
            } else {
                // 모든 값이 0인 경우 기본값 설정
                Object.keys(expressions).forEach(key => {
                    expressions[key] = 0.125; // 8개 감정이므로 1/8
                });
            }
            
            // 디버깅 정보 (3초마다 출력, 더 자세한 정보)
            if (!this.lastDebugTime || Date.now() - this.lastDebugTime > 3000) {
                console.log("🔍 [MediaPipe] 랜드마크 분석 디버그:", {
                    smileRatio: smileRatio.toFixed(3),
                    smileIntensity: smileIntensity.toFixed(3),
                    eyebrowDistance: eyebrowDistance.toFixed(3),
                    eyeOpenness: eyeOpenness.toFixed(3),
                    noseWrinkleIntensity: noseWrinkleIntensity.toFixed(3),
                    foreheadTension: foreheadTension.toFixed(3),
                    averageChange: averageChange.toFixed(4),
                    totalExpressions: Object.values(expressions).reduce((sum, val) => sum + val, 0).toFixed(3),
                    expressions: Object.fromEntries(
                        Object.entries(expressions).map(([k, v]) => [k, v.toFixed(3)])
                    ),
                    topEmotion: Object.entries(expressions).reduce((a, b) => expressions[a[0]] > expressions[b[0]] ? a : b)[0]
                });
                
                // 8-감정 분석 결과 상세 로그
                console.log("🎭 [MediaPipe] 8-감정 분석 결과:", {
                    happy: expressions.happy.toFixed(3),
                    sad: expressions.sad.toFixed(3),
                    angry: expressions.angry.toFixed(3),
                    surprised: expressions.surprised.toFixed(3),
                    fearful: expressions.fearful.toFixed(3),
                    disgusted: expressions.disgusted.toFixed(3),
                    neutral: expressions.neutral.toFixed(3),
                    contempt: expressions.contempt.toFixed(3),
                    totalSum: Object.values(expressions).reduce((sum, val) => sum + val, 0).toFixed(3),
                    dominantEmotion: Object.entries(expressions).reduce((a, b) => expressions[a[0]] > expressions[b[0]] ? a : b)[0]
                });
                
                this.lastDebugTime = Date.now();
        }
        
        return expressions;
            
        } catch (error) {
            console.error("❌ [MediaPipe] 표정 분석 실패:", error);
            return {
                happy: 0.25, sad: 0, angry: 0, surprised: 0.25, 
                fearful: 0.25, disgusted: 0, neutral: 0.25, contempt: 0
            };
        }
    }
    
    /**
     * 집중도 점수 계산
     */
    calculateConcentrationScore(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return 0;
            }
            
            // 시선 안정성
            const gazeScore = this.calculateGazeScore(landmarks);
            
            // 눈꺼풀 안정성 (너무 많이 깜빡이면 집중도 낮음)
            const blinkResult = this.calculateBlinkingScore(landmarks);
            const blinkScore = 100 - blinkResult.score;
            
            // 머리 기울기 (너무 기울어지면 집중도 낮음)  
            const nose = landmarks[1];   // 코끝
            const forehead = landmarks[10]; // 이마
            const headTilt = Math.abs(nose.x - forehead.x) * 200; // 기울기
            const headScore = Math.max(0, 100 - headTilt);
            
            // 종합 집중도 점수
            const concentrationScore = Math.round(
                (gazeScore * 0.5 + blinkScore * 0.3 + headScore * 0.2)
            );
            
            console.log(`📊 [MediaPipe] 집중도 점수: ${concentrationScore} (시선: ${gazeScore}, 깜빡임: ${blinkScore}, 머리: ${headScore.toFixed(1)})`);
            return concentrationScore;
            
        } catch (error) {
            console.error("❌ 집중도 점수 계산 실패:", error);
            return 0;
        }
    }
    
    /**
     * 시선 데이터 계산 (점수 + 상세 데이터)
     */
    calculateGazeData(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return {
                    score: 0,
                    gazeDirection: { x: 0.5, y: 0.53, distance: 0.5, status: '외곽' },
                    eyeCenter: { left: { x: 0.4, y: 0.5 }, right: { x: 0.6, y: 0.5 } }
                };
            }
            
            // 눈동자 중심점 계산
            const leftEyeCenter = this.getEyeCenter(landmarks, 'left');
            const rightEyeCenter = this.getEyeCenter(landmarks, 'right');
            
            // 화면 중앙을 향한 시선 계산 (0.5, 0.53이 실제 중앙)
            const screenCenter = { x: 0.5, y: 0.53 };
            const bandCenterHalf = 0.08;  // 중앙 밴드
            const bandMidHalf = 0.18;     // 중간 밴드
            
            const leftDistance = Math.sqrt(
                Math.pow(leftEyeCenter.x - screenCenter.x, 2) + 
                Math.pow(leftEyeCenter.y - screenCenter.y, 2)
            );
            
            const rightDistance = Math.sqrt(
                Math.pow(rightEyeCenter.x - screenCenter.x, 2) + 
                Math.pow(rightEyeCenter.y - screenCenter.y, 2)
            );
            
            const avgDistance = (leftDistance + rightDistance) / 2;
            
            // 정교한 시선 안정성 점수 계산 (더 관대한 기준)
            let stabilityScore = 100;
            if (avgDistance > bandMidHalf) {        // > 0.18
                stabilityScore = 50; // 최소 50점으로 상향 (기존 30점)
            } else if (avgDistance > bandCenterHalf) { // > 0.08  
                stabilityScore = 75; // 75점으로 상향 (기존 70점)
            } else if (avgDistance > bandCenterHalf * 0.5) { // > 0.04
                stabilityScore = 90; // 유지
            } else {                                // <= 0.04
                stabilityScore = 100; // 유지
            }
            
            // 시선 안정성 보너스 (움직임이 적으면 추가 점수)
            if (this.previousGazeDistance !== undefined) {
                const gazeMovement = Math.abs(avgDistance - this.previousGazeDistance);
                if (gazeMovement < 0.02) { // 매우 안정적
                    stabilityScore = Math.min(100, stabilityScore + 5);
                }
            }
            this.previousGazeDistance = avgDistance;
            
            // 시선 방향 및 집중 상태 판단
            let gazeStatus = '중앙';
            if (avgDistance > bandMidHalf) {
                gazeStatus = '외곽';
            } else if (avgDistance > bandCenterHalf) {
                gazeStatus = '중간';
            }
            
            const gazeDirection = {
                x: screenCenter.x,
                y: screenCenter.y,
                distance: avgDistance,
                status: gazeStatus
            };
            
            const eyeCenter = {
                left: leftEyeCenter,
                right: rightEyeCenter
            };
            
            console.log(`📊 [MediaPipe] 시선 데이터: 점수=${stabilityScore.toFixed(1)}, 거리=${avgDistance.toFixed(3)}, 상태=${gazeStatus}`);
            
            return {
                score: Math.round(stabilityScore),
                gazeDirection: gazeDirection,
                eyeCenter: eyeCenter
            };
            
        } catch (error) {
            console.error("❌ 시선 데이터 계산 실패:", error);
            return {
                score: 0,
                gazeDirection: { x: 0.5, y: 0.53, distance: 0.5, status: '외곽' },
                eyeCenter: { left: { x: 0.4, y: 0.5 }, right: { x: 0.6, y: 0.5 } }
            };
        }
    }
    
    /**
     * 시선 점수 계산 (정교한 안정성 분석)
     */
    calculateGazeScore(landmarks) {
        return this.calculateGazeData(landmarks).score;
    }
    
    /**
     * 깜빡임 점수 계산 (EAR 기반 + 통계 추적)
     */
    calculateBlinkingScore(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return 0;
            }
            
            // EAR (Eye Aspect Ratio) 계산 - 더 많은 랜드마크 사용
            const leftEye = [
                landmarks[33], landmarks[7], landmarks[163], landmarks[144], landmarks[145], landmarks[153],  // 기존 6개
                landmarks[160], landmarks[158], landmarks[157], landmarks[173], landmarks[133], landmarks[155]  // 추가 6개
            ];
            const rightEye = [
                landmarks[362], landmarks[382], landmarks[381], landmarks[380], landmarks[374], landmarks[373], // 기존 6개  
                landmarks[387], landmarks[385], landmarks[384], landmarks[398], landmarks[359], landmarks[384]  // 추가 6개
            ];
            
            function eyeAspectRatio(eye) {
                const A = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
                const B = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
                const C = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
                return (A + B) / (2.0 * C);
            }
            
            const leftEAR = eyeAspectRatio(leftEye);
            const rightEAR = eyeAspectRatio(rightEye);
            const avgEAR = (leftEAR + rightEAR) / 2.0;
            
            // 깜빡임 상태 판단
            const blinkEarThreshold = 0.19;
            const blinkClosedThreshold = 0.22;
            
            let blinkStatus = 'open';
            if (avgEAR < blinkClosedThreshold) {
                blinkStatus = 'closed';
            } else if (avgEAR < blinkEarThreshold) {
                blinkStatus = 'blinking';
            }
            
            // 깜빡임 통계 업데이트
            const currentTime = Date.now();
            if (blinkStatus === 'blinking' && this.lastBlinkTime === 0) {
                // 깜빡임 시작
                this.lastBlinkTime = currentTime;
            } else if (blinkStatus === 'open' && this.lastBlinkTime > 0) {
                // 깜빡임 완료
                const blinkDuration = currentTime - this.lastBlinkTime;
                if (blinkDuration > 50 && blinkDuration < 500) { // 유효한 깜빡임 (50ms-500ms)
                    this.blinkCount++;
                    this.blinkHistory.push({
                        time: currentTime,
                        duration: blinkDuration,
                        ear: avgEAR
                    });
                }
                this.lastBlinkTime = 0;
            }
            
            // 1분 이전 데이터 제거
            this.blinkHistory = this.blinkHistory.filter(blink => currentTime - blink.time < 60000);
            
            // 분당 깜빡임 수 계산
            const oneMinuteAgo = currentTime - 60000;
            const recentBlinks = this.blinkHistory.filter(blink => blink.time > oneMinuteAgo);
            const blinkRatePerMinute = recentBlinks.length;
            
            // 평균 깜빡임 지속시간
            const avgBlinkDuration = recentBlinks.length > 0 
                ? recentBlinks.reduce((sum, blink) => sum + blink.duration, 0) / recentBlinks.length 
                : 0;
            
            // 깜빡임 점수 계산 (EAR 기반, 더 관대한 기준)
            let blinkingScore = Math.min(100, avgEAR * 400); // 더 관대한 스케일링
            
            // 적절한 깜빡임 빈도 보너스 (분당 15-25회가 이상적)
            if (blinkRatePerMinute >= 15 && blinkRatePerMinute <= 25) {
                blinkingScore = Math.min(100, blinkingScore + 10); // 보너스 10점
            } else if (blinkRatePerMinute >= 10 && blinkRatePerMinute <= 30) {
                blinkingScore = Math.min(100, blinkingScore + 5);  // 보너스 5점
            }
            
            // 최소 점수 보장 (너무 낮지 않게)
            blinkingScore = Math.max(40, blinkingScore);
            
            console.log(`📊 [MediaPipe] 깜빡임 점수: ${blinkingScore.toFixed(1)} (EAR: ${avgEAR.toFixed(4)}, 분당: ${blinkRatePerMinute}회, 평균지속: ${avgBlinkDuration.toFixed(0)}ms)`);
            
            return {
                score: Math.round(blinkingScore),
                ear: avgEAR,
                blinkStatus,
                blinkRatePerMinute,
                avgBlinkDuration,
                totalBlinkCount: this.blinkCount
            };
            
        } catch (error) {
            console.error("❌ 깜빡임 점수 계산 실패:", error);
            return {
                score: 0,
                ear: 0.22,
                blinkStatus: 'open',
                blinkRatePerMinute: 0,
                avgBlinkDuration: 0,
                totalBlinkCount: this.blinkCount
            };
        }
    }
    
    /**
     * 자세 점수 계산 (얼굴 기울기 + 어깨 자세 추정)
     */
    calculatePostureScore(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return 75; // 기본값을 높게 설정 (너무 엄격하지 않게)
            }
            
            // 1. 얼굴 기울기 계산 (더 많은 포인트 사용)
            const leftEar = landmarks[234];      // 왼쪽 귀
            const rightEar = landmarks[454];     // 오른쪽 귀
            const leftCheek = landmarks[172];    // 왼쪽 볼
            const rightCheek = landmarks[397];   // 오른쪽 볼
            const leftJaw = landmarks[172];      // 왼쪽 턱선
            const rightJaw = landmarks[397];     // 오른쪽 턱선
            
            // 다중 포인트로 얼굴 기울기 계산 (더 안정적)
            const earTilt = Math.abs(leftEar.y - rightEar.y);
            const cheekTilt = Math.abs(leftCheek.y - rightCheek.y);
            const jawTilt = Math.abs(leftJaw.y - rightJaw.y);
            const avgFaceTilt = (earTilt + cheekTilt + jawTilt) / 3;
            
            // 2. 얼굴 수직성 (더 관대한 기준)
            const nose = landmarks[1];           // 코끝
            const forehead = landmarks[10];      // 이마
            const chin = landmarks[18];          // 턱
            
            const faceVertical1 = Math.abs(nose.x - forehead.x);
            const faceVertical2 = Math.abs(nose.x - chin.x);
            const avgFaceVertical = (faceVertical1 + faceVertical2) / 2;
            
            // 3. 어깨 자세 추정 (더 정교하게)
            const leftSide = landmarks[234];
            const rightSide = landmarks[454];
            
            // 어깨 위치 추정 (더 현실적인 위치)
            const leftShoulder = { x: leftSide.x - 0.05, y: leftSide.y + 0.15 };
            const rightShoulder = { x: rightSide.x + 0.05, y: rightSide.y + 0.15 };
            
            const shoulderHeightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
            const shoulderSlope = (rightShoulder.y - leftShoulder.y) / Math.abs(rightShoulder.x - leftShoulder.x);
            const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
            
            // 4. 목 자세 분석 (새로 추가)
            const neckTilt = Math.abs((leftEar.x + rightEar.x) / 2 - (leftCheek.x + rightCheek.x) / 2);
            const neckForward = Math.abs(forehead.y - chin.y); // 목이 앞으로 나온 정도
            
            // 5. 점수 계산 (더 관대한 기준)
            const shoulderWidthBaseline = 0.25; // 기준을 더 관대하게
            const widthRatio = shoulderWidth / shoulderWidthBaseline;
            const shoulderRotation = Math.atan(shoulderSlope) * (180 / Math.PI);
            
            // 어깨 자세 점수 계산 (더 관대한 감점)
            const heightBalanceScore = Math.max(50, 100 - (shoulderHeightDiff * 300)); // 최소 50점
            const slopeScore = Math.max(60, 100 - (Math.abs(shoulderSlope) * 100));    // 최소 60점
            const widthScore = Math.min(100, Math.max(70, (widthRatio - 0.6) / 0.5 * 100)); // 최소 70점
            const rotationScore = Math.max(65, 100 - (Math.abs(shoulderRotation) * 0.5)); // 최소 65점
            
            const shoulderScore = Math.round((heightBalanceScore + slopeScore + widthScore + rotationScore) / 4);
            
            // 얼굴 자세 점수 (더 관대한 기준)
            const facePostureScore = Math.max(60, 100 - (avgFaceTilt + avgFaceVertical) * 100); // 최소 60점
            
            // 목 자세 점수 (새로 추가)
            const neckScore = Math.max(70, 100 - (neckTilt * 150 + neckForward * 50)); // 최소 70점
            
            // 종합 자세 점수 (얼굴 50% + 어깨 30% + 목 20%)
            const postureScore = Math.round(
                facePostureScore * 0.5 + shoulderScore * 0.3 + neckScore * 0.2
            );
            
            // 최소 점수 보장 (너무 낮지 않게)
            const finalScore = Math.max(50, postureScore);
            
            console.log(`📊 [MediaPipe] 자세 점수: ${finalScore} (얼굴: ${facePostureScore.toFixed(1)}, 어깨: ${shoulderScore.toFixed(1)}, 목: ${neckScore.toFixed(1)}, 기울기: ${avgFaceTilt.toFixed(4)})`);
            return finalScore;
            
        } catch (error) {
            console.error("❌ 자세 점수 계산 실패:", error);
            return 75; // 오류시에도 적당한 점수
        }
    }
    
    /**
     * 주도권 점수 계산
     */
    calculateInitiativeScore(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return 0;
            }
            
            // 표정과 시선의 조합으로 주도권 계산
            const expressionScore = this.calculateExpressionScore(landmarks);
            const gazeScore = this.calculateGazeScore(landmarks);
            const postureScore = this.calculatePostureScore(landmarks);
            
            // 주도권 점수 (표정 + 시선 + 자세의 가중 평균)
            const initiativeScore = Math.round(
                expressionScore * 0.4 + gazeScore * 0.4 + postureScore * 0.2
            );
            
            console.log(`📊 [MediaPipe] 주도권 점수: ${initiativeScore} (표정: ${expressionScore}, 시선: ${gazeScore}, 자세: ${postureScore})`);
            return initiativeScore;
            
        } catch (error) {
            console.error("❌ 주도권 점수 계산 실패:", error);
            return 0;
        }
    }
    
    /**
     * 눈동자 중심점 계산
     */
    getEyeCenter(landmarks, eye) {
        try {
            if (eye === 'left') {
                // 왼쪽 눈 랜드마크들의 중심 (더 많은 포인트 사용)
                const eyeLandmarks = [
                    33, 7, 163, 144, 145, 153,        // 기존 6개
                    160, 158, 157, 173, 133, 155,     // 눈꺼풀 추가 6개
                    46, 53, 52, 51, 48, 115           // 눈동자 영역 6개
                ];
                let x = 0, y = 0;
                for (const idx of eyeLandmarks) {
                    x += landmarks[idx].x;
                    y += landmarks[idx].y;
                }
                return { x: x / eyeLandmarks.length, y: y / eyeLandmarks.length };
            } else {
                // 오른쪽 눈 랜드마크들의 중심 (더 많은 포인트 사용)
                const eyeLandmarks = [
                    362, 382, 381, 380, 374, 373,    // 기존 6개
                    387, 385, 384, 398, 359, 384,     // 눈꺼풀 추가 6개 
                    276, 283, 282, 281, 278, 344      // 눈동자 영역 6개
                ];
                let x = 0, y = 0;
                for (const idx of eyeLandmarks) {
                    x += landmarks[idx].x;
                    y += landmarks[idx].y;
                }
                return { x: x / eyeLandmarks.length, y: y / eyeLandmarks.length };
            }
        } catch (error) {
            console.error(`❌ ${eye} 눈동자 중심 계산 실패:`, error);
            return { x: 0.5, y: 0.5 };
        }
    }

    /**
     * 여러 ID로 요소 찾기
     */
    findElementByIds(ids) {
        for (const id of ids) {
            const element = document.getElementById(id);
            if (element) {
                return element;
            }
        }
        return null;
    }
    
    /**
     * 분석 상태 업데이트 (실제 동작 내용 표시)
     */
    updateAnalysisStatus(scores) {
        try {
            // 표정 상태 업데이트
            const expressionStatus = document.getElementById('expression-status');
            if (expressionStatus) {
                if (scores.expression >= 85) {
                    expressionStatus.textContent = '매우 긍정적';
                    expressionStatus.style.color = '#10b981';
                } else if (scores.expression >= 70) {
                    expressionStatus.textContent = '긍정적';
                    expressionStatus.style.color = '#3b82f6';
                } else if (scores.expression >= 50) {
                    expressionStatus.textContent = '보통';
                    expressionStatus.style.color = '#f59e0b';
                } else {
                    expressionStatus.textContent = '개선 필요';
                    expressionStatus.style.color = '#ef4444';
                }
            }
            
            // 시선 상태 업데이트
            const gazeStatus = document.getElementById('gaze-status');
            if (gazeStatus) {
                if (scores.gaze >= 85) {
                    gazeStatus.textContent = '안정적';
                    gazeStatus.style.color = '#10b981';
                } else if (scores.gaze >= 70) {
                    gazeStatus.textContent = '양호';
                    gazeStatus.style.color = '#3b82f6';
                } else if (scores.gaze >= 50) {
                    gazeStatus.textContent = '보통';
                    gazeStatus.style.color = '#f59e0b';
                } else {
                    gazeStatus.textContent = '불안정';
                    gazeStatus.style.color = '#ef4444';
                }
            }
            
            // 집중도 상태 업데이트
            const concentrationStatus = document.getElementById('concentration-status');
            if (concentrationStatus) {
                if (scores.concentration >= 85) {
                    concentrationStatus.textContent = '매우 집중';
                    concentrationStatus.style.color = '#10b981';
                } else if (scores.concentration >= 70) {
                    concentrationStatus.textContent = '집중';
                    concentrationStatus.style.color = '#3b82f6';
                } else if (scores.concentration >= 50) {
                    concentrationStatus.textContent = '보통';
                    concentrationStatus.style.color = '#f59e0b';
                } else {
                    concentrationStatus.textContent = '산만';
                    concentrationStatus.style.color = '#ef4444';
                }
            }
            
            // 자세 상태 업데이트
            const postureStatus = document.getElementById('posture-status');
            if (postureStatus) {
                if (scores.posture >= 85) {
                    postureStatus.textContent = '매우 우수';
                    postureStatus.style.color = '#10b981';
                } else if (scores.posture >= 70) {
                    postureStatus.textContent = '우수';
                    postureStatus.style.color = '#3b82f6';
                } else if (scores.posture >= 50) {
                    postureStatus.textContent = '보통';
                    postureStatus.style.color = '#f59e0b';
                } else {
                    postureStatus.textContent = '개선 필요';
                    postureStatus.style.color = '#ef4444';
                }
            }
            
            // 깜빡임 상태 업데이트
            const blinkingStatus = document.getElementById('blinking-status');
            if (blinkingStatus) {
                if (scores.blinking >= 85) {
                    blinkingStatus.textContent = '정상';
                    blinkingStatus.style.color = '#10b981';
                } else if (scores.blinking >= 70) {
                    blinkingStatus.textContent = '양호';
                    blinkingStatus.style.color = '#3b82f6';
                } else if (scores.blinking >= 50) {
                    blinkingStatus.textContent = '보통';
                    blinkingStatus.style.color = '#f59e0b';
                } else {
                    blinkingStatus.textContent = '과도함';
                    blinkingStatus.style.color = '#ef4444';
                }
            }
            
        } catch (error) {
            console.warn("⚠️ 분석 상태 업데이트 실패:", error);
        }
    }
    
    /**
     * 주요 표정 판별
     */
    getMainExpression(expressions) {
        const entries = Object.entries(expressions);
        const maxEntry = entries.reduce((max, current) => 
            current[1] > max[1] ? current : max
        );
        
        return {
            name: maxEntry[0],
            confidence: maxEntry[1] / 100
        };
    }
    
    /**
     * 평균 표정 분류 결과 반환
     */
    getAveragedExpressions() {
        if (this.expressionHistory.length === 0) {
            return this.expressionClassifications;
        }
        
        const averaged = {};
        const emotions = Object.keys(this.expressionClassifications);
        
        emotions.forEach(emotion => {
            const values = this.expressionHistory.map(h => h[emotion]).filter(v => v !== undefined);
            averaged[emotion] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        });
        
        return averaged;
    }
    
    /**
     * 점수 라벨 반환
     */
    getScoreLabel(score) {
        if (score >= 85) return '매우 좋음';
        if (score >= 70) return '좋음';
        if (score >= 50) return '보통';
        if (score >= 30) return '나쁨';
        return '매우 나쁨';
    }
    
    /**
     * 눈 개방도 데이터
     */
    getEyeOpennessData() {
        // 실제 랜드마크 데이터가 있을 때 계산
        return {
            leftEye: 0.0141, // 예시 값
            rightEye: 0.0141,
            average: 0.0141
        };
    }
    
    /**
     * 깜빡임 빈도 계산
     */
    calculateBlinkRate() {
        // 실제 구현에서는 시간 기반 계산
        return {
            perMinute: 15,
            status: '정상'
        };
    }
    
    /**
     * 시선 방향 데이터
     */
    getGazeDirection() {
        return {
            x: 0.5,
            y: 0.5,
            distance: 0.184,
            status: '중앙'
        };
    }
    
    /**
     * 눈 중심점 데이터
     */
    getEyeCenterData() {
        return {
            left: { x: 0.4, y: 0.5 },
            right: { x: 0.6, y: 0.5 }
        };
    }
    
    /**
     * 머리 기울기 데이터
     */
    getHeadTiltData() {
        return {
            angle: 0.0028,
            status: '거의 수직'
        };
    }
    
    /**
     * 얼굴 수직성 데이터
     */
    getFaceVerticalData() {
        return {
            verticality: 0.0041,
            status: '수직'
        };
    }
    
    /**
     * 머리 안정성 점수
     */
    getHeadStabilityScore() {
        return 99.2; // 예시 값
    }
    
    /**
     * 집중도 UI 조정
     */
    adjustConcentrationUI(score) {
        // 집중도 점수 미세 조정
        const currentScore = this.currentMediaPipeScores.concentration || 0;
        const diff = Math.abs(score - currentScore);
        
        if (diff > 0.15) { // 15% 이상 차이시 조정
            const adjustedScore = (currentScore + score) / 2;
            console.log(`🔧 집중도 점수 조정: ${currentScore.toFixed(2)} → ${adjustedScore.toFixed(2)} (모델: ${score.toFixed(2)})`);
            this.updateConcentrationScore(adjustedScore);
        }
    }
    
    /**
     * 이상 감지 알림 표시
     */
    showAnomalyNotification(result) {
        console.warn("🚨 이상 감지:", result);
        // 실제 구현에서는 더 정교한 알림 UI 사용
    }

    /**
     * 카메라 스트림 모니터링 설정
     */
    setupCameraMonitoring() {
        // 비디오 요소 모니터링
        const video = document.querySelector('video');
        if (video) {
            this.monitorVideoElement(video);
        } else {
            // 비디오 요소가 아직 없는 경우, DOM 변경 감지
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const video = node.querySelector('video') || (node.tagName === 'VIDEO' ? node : null);
                            if (video) {
                                this.monitorVideoElement(video);
                                observer.disconnect();
                            }
                        }
                    });
                });
            });
            
            // document.body가 존재하는지 확인 후 observe
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            } else {
                // DOM이 아직 로드되지 않은 경우, DOMContentLoaded 이벤트 대기
                document.addEventListener('DOMContentLoaded', () => {
                    if (document.body) {
                        observer.observe(document.body, {
                            childList: true,
                            subtree: true
                        });
                    }
                });
            }
        }
    }
    
    /**
     * 백그라운드 카메라 모니터링
     */
    monitorVideoElement(video) {
        console.log("📹 [카메라] 백그라운드 카메라 모니터링 시작");
        
        // 비디오 이벤트 리스너
        const events = [
            'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough',
            'play', 'playing', 'pause', 'ended', 'error', 'abort', 'emptied',
            'stalled', 'suspend', 'waiting'
        ];
        
        events.forEach(event => {
            video.addEventListener(event, (e) => {
                const status = {
                    readyState: video.readyState,
                    readyStateText: this.getReadyStateText(video.readyState),
                    paused: video.paused,
                    ended: video.ended,
                    currentTime: video.currentTime,
                    duration: video.duration,
                    srcObject: !!video.srcObject,
                    streamActive: video.srcObject?.active || false,
                    networkState: video.networkState,
                    error: video.error
                };
                
                console.log(`📹 [카메라] 이벤트: ${event}`, status);
                
                // 중요 이벤트 강조
                if (event === 'ended') {
                    console.error("🚨 [카메라] 백그라운드 카메라 종료됨");
                }
                if (event === 'pause') {
                    console.warn("⚠️ [카메라] 백그라운드 카메라 일시정지됨");
                }
                if (event === 'error') {
                    console.error("🚨 [카메라] 백그라운드 카메라 오류 발생:", video.error);
                }
            });
        });
        
        // 스트림 상태 모니터링
        if (video.srcObject) {
            this.monitorStream(video.srcObject);
        }
        
        // srcObject 변경 감지
        const originalSrcObject = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'srcObject');
        if (originalSrcObject && originalSrcObject.set) {
            const self = this;
            Object.defineProperty(video, 'srcObject', {
                set: function(stream) {
                    console.log("📹 [카메라] 카메라 스트림 변경:", {
                        hasStream: !!stream,
                        streamActive: stream?.active || false,
                        streamId: stream?.id || 'none',
                        tracks: stream ? stream.getTracks().length : 0
                    });
                    
                    if (stream) {
                        self.monitorStream(stream);
                    } else {
                        console.warn("⚠️ [카메라] 카메라 스트림이 제거됨");
                    }
                    
                    originalSrcObject.set.call(this, stream);
                },
                get: originalSrcObject.get
            });
        }
        
        // 주기적 상태 체크 (5초마다)
        this.videoStatusInterval = setInterval(() => {
            this.logDetailedCameraStatus(video);
        }, 5000);
    }
    
    /**
     * 스트림 모니터링
     */
    monitorStream(stream) {
        console.log("🔍 [카메라] 스트림 모니터링 시작:", {
            id: stream.id,
            active: stream.active,
            tracks: stream.getTracks().map(track => ({
                kind: track.kind,
                enabled: track.enabled,
                readyState: track.readyState,
                muted: track.muted
            }))
        });
        
        // 스트림 이벤트 모니터링
        stream.addEventListener('addtrack', (e) => {
            console.log("🔍 [카메라] 트랙 추가:", e.track);
        });
        
        stream.addEventListener('removetrack', (e) => {
            console.log("🔍 [카메라] 트랙 제거:", e.track);
        });
        
        // 트랙 상태 모니터링
        stream.getTracks().forEach(track => {
            this.monitorTrack(track);
        });
    }
    
    /**
     * 트랙 모니터링
     */
    monitorTrack(track) {
        const events = ['ended', 'mute', 'unmute'];
        
        events.forEach(event => {
            track.addEventListener(event, (e) => {
                console.log(`🔍 [카메라] 트랙 이벤트: ${event}`, {
                    kind: track.kind,
                    enabled: track.enabled,
                    readyState: track.readyState,
                    muted: track.muted
                });
            });
        });
        
        // 트랙 상태 주기적 체크
        const checkTrackStatus = () => {
            if (track.readyState === 'ended') {
                console.log("🔍 [카메라] 트랙 종료됨:", {
                    kind: track.kind,
                    readyState: track.readyState
                });
            }
        };
        
        setInterval(checkTrackStatus, 5000); // 5초마다 체크
    }
    
    /**
     * 카메라 상태 상세 로깅
     */
    logCameraStatus(video) {
        if (!video) {
            console.log("🔍 [카메라] 비디오 요소가 없음");
            return;
        }
        
        const status = {
            readyState: video.readyState,
            readyStateText: this.getReadyStateText(video.readyState),
            paused: video.paused,
            ended: video.ended,
            currentTime: video.currentTime,
            duration: video.duration,
            src: video.src,
            hasSrcObject: !!video.srcObject,
            streamActive: video.srcObject?.active || false,
            streamId: video.srcObject?.id || 'none',
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            naturalWidth: video.naturalWidth,
            naturalHeight: video.naturalHeight
        };
        
        // 상태가 변경된 경우에만 로그 출력
        const statusKey = JSON.stringify(status);
        if (this.lastCameraStatus !== statusKey) {
            console.log("🔍 [카메라] 상태 변경:", status);
            this.lastCameraStatus = statusKey;
        }
    }
    
    /**
     * 비디오 readyState 텍스트 변환
     */
    getReadyStateText(readyState) {
        const states = {
            0: 'HAVE_NOTHING',
            1: 'HAVE_METADATA',
            2: 'HAVE_CURRENT_DATA',
            3: 'HAVE_FUTURE_DATA',
            4: 'HAVE_ENOUGH_DATA'
        };
        return states[readyState] || 'UNKNOWN';
    }

    /**
     * 모든 팝업 데이터 업데이트
     */
    updateAllPopupData(scores) {
        // 전역 변수에 현재 점수 저장
        this.currentMediaPipeScores = scores;
        
        // 각 메트릭별 팝업 데이터 업데이트
        this.updateExpressionPopupData(scores);
        this.updateGazePopupData(scores);
        this.updateConcentrationPopupData(scores);
        this.updateBlinkingPopupData(scores);
        this.updatePosturePopupData(scores);
        this.updateInitiativePopupData(scores);
        
        console.log("📊 [팝업] 모든 팝업 데이터 업데이트 완료:", scores);
    }
    
    /**
     * 표정 팝업 데이터 업데이트
     */
    updateExpressionPopupData(scores) {
        const expressionData = {
            expression: this.getMainExpression(scores),
            confidence: scores.expression / 100,
            score: {
                score: scores.expression,
                label: this.getScoreLabel(scores.expression)
            },
            probabilities: scores.expressionProbabilities || this.getAveragedExpressions(scores),
            datingScore: scores.expression, // 데이팅 친화적 점수
            lastUpdate: new Date().toISOString(),
            isRealTime: true
        };
        
        // 전역 변수에 저장
        window.currentExpressionData = expressionData;
        
        // 팝업이 열려있으면 UI 업데이트
        const popup = document.getElementById('expression-details-popup');
        if (popup && popup.classList.contains('active')) {
            this.updateExpressionPopupUI(expressionData);
        }
    }
    
    /**
     * 시선 팝업 데이터 업데이트
     */
    updateGazePopupData(scores) {
        const gazeData = {
            score: scores.gaze,
            label: this.getScoreLabel(scores.gaze),
            gazeDirection: scores.gazeDirection || this.getGazeDirection(scores),
            eyeCenter: scores.eyeCenter || this.getEyeCenterData(scores),
            lastUpdate: new Date().toISOString(),
            isRealTime: true
        };
        
        window.currentGazeData = gazeData;
        
        const popup = document.getElementById('gaze-details-popup');
        if (popup && popup.classList.contains('active')) {
            this.updateGazePopupUI(gazeData);
        }
    }
    
    /**
     * 집중도 팝업 데이터 업데이트
     */
    updateConcentrationPopupData(scores) {
        const concentrationData = {
            score: scores.concentration,
            label: this.getScoreLabel(scores.concentration),
            factors: this.getConcentrationFactors(scores),
            lastUpdate: new Date().toISOString(),
            isRealTime: true
        };
        
        window.currentConcentrationData = concentrationData;
        
        const popup = document.getElementById('concentration-details-popup');
        if (popup && popup.classList.contains('active')) {
            this.updateConcentrationPopupUI(concentrationData);
        }
    }
    
    /**
     * 깜빡임 팝업 데이터 업데이트
     */
    updateBlinkingPopupData(scores) {
        const blinkingData = {
            score: scores.blinking,
            label: this.getScoreLabel(scores.blinking),
            blinkRate: this.calculateBlinkRate(scores),
            explanation: this.generateBlinkingExplanation(scores.blinking),
            lastUpdate: new Date().toISOString(),
            isRealTime: true
        };
        
        window.currentBlinkingData = blinkingData;
        
        const popup = document.getElementById('blinking-details-popup');
        if (popup && popup.classList.contains('active')) {
            this.updateBlinkingPopupUI(blinkingData);
        }
    }
    
    /**
     * 자세 팝업 데이터 업데이트
     */
    updatePosturePopupData(scores) {
        const postureData = {
            score: scores.posture,
            label: this.getScoreLabel(scores.posture),
            headTilt: this.getHeadTiltData(scores),
            stability: this.getHeadStabilityScore(scores),
        };
        
        window.currentPostureData = postureData;
        
        const popup = document.getElementById('posture-details-popup');
        if (popup && popup.classList.contains('active')) {
            this.updatePosturePopupUI(postureData);
        }
    }
    
    /**
     * 대화 주도권 팝업 데이터 업데이트
     */
    updateInitiativePopupData(scores) {
        const initiativeData = {
            score: scores.initiative,
            label: this.getScoreLabel(scores.initiative),
            userInitiativeScore: scores.initiative,
            status: this.getInitiativeStatus(scores.initiative),
            stats: this.getInitiativeStats(scores),
            lastUpdate: new Date().toISOString(),
            isRealTime: true
        };
        
        window.currentInitiativeData = initiativeData;
        
        const popup = document.getElementById('initiative-details-popup');
        if (popup && popup.classList.contains('active')) {
            this.updateInitiativePopupUI(initiativeData);
        }
    }
    
    /**
     * 표정 팝업이 열릴 때 호출되는 메서드
     */
    updateExpressionPopupOnOpen() {
        if (this.currentMediaPipeScores && Object.keys(this.currentMediaPipeScores).length > 0) {
            this.updateExpressionPopupData(this.currentMediaPipeScores);
        } else {
            console.log("⚠️ [팝업] 표정 데이터가 없어서 기본값 사용");
            // 기본 데이터 생성
            const defaultScores = {
                expression: 75,
                concentration: 70,
                gaze: 80,
                blinking: 85,
                posture: 75,
                initiative: 70
            };
            this.updateExpressionPopupData(defaultScores);
        }
    }
    
    /**
     * 시선 팝업이 열릴 때 호출되는 메서드
     */
    updateGazePopupOnOpen() {
        if (this.currentMediaPipeScores && Object.keys(this.currentMediaPipeScores).length > 0) {
            this.updateGazePopupData(this.currentMediaPipeScores);
        } else {
            console.log("⚠️ [팝업] 시선 데이터가 없어서 기본값 사용");
            const defaultScores = {
                expression: 75,
                concentration: 70,
                gaze: 80,
                blinking: 85,
                posture: 75,
                initiative: 70
            };
            this.updateGazePopupData(defaultScores);
        }
    }
    
    /**
     * 깜빡임 팝업이 열릴 때 호출되는 메서드
     */
    updateBlinkingPopupOnOpen() {
        if (this.currentMediaPipeScores && Object.keys(this.currentMediaPipeScores).length > 0) {
            this.updateBlinkingPopupData(this.currentMediaPipeScores);
        } else {
            console.log("⚠️ [팝업] 깜빡임 데이터가 없어서 기본값 사용");
            const defaultScores = {
                expression: 75,
                concentration: 70,
                gaze: 80,
                blinking: 85,
                posture: 75,
                initiative: 70
            };
            this.updateBlinkingPopupData(defaultScores);
        }
    }
    
    /**
     * 자세 팝업이 열릴 때 호출되는 메서드
     */
    updatePosturePopupOnOpen() {
        if (this.currentMediaPipeScores && Object.keys(this.currentMediaPipeScores).length > 0) {
            this.updatePosturePopupData(this.currentMediaPipeScores);
        } else {
            console.log("⚠️ [팝업] 자세 데이터가 없어서 기본값 사용");
            const defaultScores = {
                expression: 75,
                concentration: 70,
                gaze: 80,
                blinking: 85,
                posture: 75,
                initiative: 70
            };
            this.updatePosturePopupData(defaultScores);
        }
    }
    
    /**
     * 집중도 팝업이 열릴 때 호출되는 메서드
     */
    updateConcentrationPopupOnOpen() {
        if (this.currentMediaPipeScores && Object.keys(this.currentMediaPipeScores).length > 0) {
            this.updateConcentrationPopupData(this.currentMediaPipeScores);
        } else {
            console.log("⚠️ [팝업] 집중도 데이터가 없어서 기본값 사용");
            const defaultScores = {
                expression: 75,
                concentration: 70,
                gaze: 80,
                blinking: 85,
                posture: 75,
                initiative: 70
            };
            this.updateConcentrationPopupData(defaultScores);
        }
    }
    
    /**
     * 대화 주도권 팝업이 열릴 때 호출되는 메서드
     */
    updateInitiativePopupOnOpen() {
        if (this.currentMediaPipeScores && Object.keys(this.currentMediaPipeScores).length > 0) {
            this.updateInitiativePopupData(this.currentMediaPipeScores);
        } else {
            console.log("⚠️ [팝업] 대화 주도권 데이터가 없어서 기본값 사용");
            const defaultScores = {
                expression: 75,
                concentration: 70,
                gaze: 80,
                blinking: 85,
                posture: 75,
                initiative: 70
            };
            this.updateInitiativePopupData(defaultScores);
        }
    }
    
    // 헬퍼 메서드들
    getMainExpression(scores) {
        return 'neutral'; // 기본값
    }
    
    getAveragedExpressions(scores) {
        return {
            happy: Math.max(0, scores.expression - 20),
            sad: Math.max(0, 100 - scores.expression - 20),
            angry: Math.max(0, 50 - Math.abs(scores.expression - 50)),
            surprised: Math.max(0, 30 - Math.abs(scores.expression - 70)),
            fearful: Math.max(0, 20 - Math.abs(scores.expression - 30)),
            disgusted: Math.max(0, 15 - Math.abs(scores.expression - 40)),
            neutral: Math.max(0, 100 - Math.abs(scores.expression - 50)),
            contempt: Math.max(0, 10 - Math.abs(scores.expression - 20))
        };
    }
    
    getScoreLabel(score) {
        if (score >= 85) return '매우 좋음';
        if (score >= 70) return '좋음';
        if (score >= 50) return '보통';
        if (score >= 30) return '나쁨';
        return '매우 나쁨';
    }
    
    getGazeDirection(scores) {
        return {
            x: 0.5,
            y: 0.5,
            distance: 0.184,
            status: '중앙'
        };
    }
    
    getEyeCenterData(scores) {
        return {
            left: { x: 0.4, y: 0.5 },
            right: { x: 0.6, y: 0.5 }
        };
    }
    
    getConcentrationFactors(scores) {
        return {
            eyeOpenness: scores.concentration * 0.8,
            headStability: scores.concentration * 0.9,
            blinkRate: scores.concentration * 0.7
        };
    }
    
    calculateBlinkRate(scores) {
        return scores.blinking * 0.01; // 분당 깜빡임 횟수
    }
    
    generateBlinkingExplanation(score) {
        if (score >= 80) return "적절한 깜빡임으로 눈이 건강합니다.";
        if (score >= 60) return "깜빡임이 다소 적습니다.";
        return "깜빡임이 너무 적어 눈이 건조할 수 있습니다.";
    }
    
    getHeadTiltData(scores) {
        return {
            angle: 0.5,
            direction: '중앙',
            stability: scores.posture / 100
        };
    }
    
    getHeadStabilityScore(scores) {
        return scores.posture;
    }
    
    getInitiativeFactors(scores) {
        return {
            expression: scores.expression * 0.8,
            gaze: scores.gaze * 0.9,
            concentration: scores.concentration * 0.7
        };
    }
    
    getInitiativeStatus(score) {
        if (score >= 85) return '매우 적극적';
        if (score >= 70) return '적극적';
        if (score >= 50) return '보통';
        if (score >= 30) return '소극적';
        return '매우 소극적';
    }
    
    getInitiativeStats(scores) {
        return {
            expression: scores.expression,
            gaze: scores.gaze,
            concentration: scores.concentration,
            average: Math.round((scores.expression + scores.gaze + scores.concentration) / 3)
        };
    }
    
    // UI 업데이트 메서드들 (팝업이 열려있을 때만 호출)
    updateExpressionPopupUI(data) {
        // popup-manager.js에서 직접 관리하므로 중복 호출 제거
        console.log("📊 [MediaPipe] 표정 팝업 데이터 업데이트됨");
    }
    
    updateGazePopupUI(data) {
        if (typeof window.updateGazePopupContent === 'function') {
            window.updateGazePopupContent();
        }
    }
    
    updateConcentrationPopupUI(data) {
        if (typeof window.updateConcentrationPopupContent === 'function') {
            window.updateConcentrationPopupContent();
        }
    }
    
    updateBlinkingPopupUI(data) {
        if (typeof window.updateBlinkingPopupContent === 'function') {
            window.updateBlinkingPopupContent();
        }
    }
    
    updatePosturePopupUI(data) {
        if (typeof window.updatePosturePopupContent === 'function') {
            window.updatePosturePopupContent();
        }
    }
    
    updateInitiativePopupUI(data) {
        if (typeof window.updateInitiativePopupContent === 'function') {
            window.updateInitiativePopupContent();
        }
    }

    /**
     * 상세 카메라 상태 로그
     */
    logDetailedCameraStatus(video) {
        if (!video) {
            console.warn("⚠️ [카메라] 백그라운드 카메라 요소가 없음");
            return;
        }
        
        const status = {
            // 기본 상태
            readyState: video.readyState,
            readyStateText: this.getReadyStateText(video.readyState),
            paused: video.paused,
            ended: video.ended,
            currentTime: video.currentTime,
            duration: video.duration,
            
            // 소스 정보
            src: video.src,
            srcObject: !!video.srcObject,
            
            // 네트워크 상태
            networkState: video.networkState,
            networkStateText: this.getNetworkStateText(video.networkState),
            
            // 오류 정보
            error: video.error,
            errorMessage: video.error ? video.error.message : null,
            
            // 스트림 정보
            streamActive: video.srcObject?.active || false,
            streamId: video.srcObject?.id || 'none',
            tracks: video.srcObject ? video.srcObject.getTracks().map(track => ({
                kind: track.kind,
                enabled: track.enabled,
                readyState: track.readyState,
                muted: track.muted,
                id: track.id
            })) : []
        };
        
        console.log("📊 [카메라] 백그라운드 카메라 상세 상태:", status);
        
        // 문제 상황 감지
        if (video.ended) {
            console.error("🚨 [카메라] 백그라운드 카메라가 종료됨");
        }
        if (video.paused) {
            console.warn("⚠️ [카메라] 백그라운드 카메라가 일시정지됨");
        }
        if (video.readyState !== 4) {
            console.warn("⚠️ [카메라] 백그라운드 카메라가 완전히 로드되지 않음");
        }
        if (video.error) {
            console.error("🚨 [카메라] 백그라운드 카메라 오류:", video.error);
        }
        if (!video.srcObject) {
            console.warn("⚠️ [카메라] 카메라 스트림이 없음");
        }
        if (video.srcObject && !video.srcObject.active) {
            console.error("🚨 [카메라] 카메라 스트림이 비활성화됨");
        }
        
        // 트랙 상태 확인
        if (video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => {
                if (!track.enabled) {
                    console.warn(`⚠️ [카메라] ${track.kind} 트랙이 비활성화됨`);
                }
                if (track.muted) {
                    console.warn(`⚠️ [카메라] ${track.kind} 트랙이 음소거됨`);
                }
                if (track.readyState === 'ended') {
                    console.error(`🚨 [카메라] ${track.kind} 트랙이 종료됨`);
                }
            });
        }
    }
    
    /**
     * 네트워크 상태 텍스트 반환
     */
    getNetworkStateText(networkState) {
        const states = {
            0: 'NETWORK_EMPTY',
            1: 'NETWORK_IDLE',
            2: 'NETWORK_LOADING',
            3: 'NETWORK_NO_SOURCE'
        };
        return states[networkState] || 'UNKNOWN';
    }
}

// 전역 인스턴스 생성
window.mediaPipeAnalyzer = new MediaPipeAnalyzer();

// 페이지 로드 시 자동 연결
document.addEventListener('DOMContentLoaded', () => {
    // 약간의 지연 후 연결 (다른 모듈들이 로드될 시간 확보)
    setTimeout(() => {
        window.mediaPipeAnalyzer.connect();
    }, 1000);
});

// 페이지 언로드 시 연결 해제
window.addEventListener('beforeunload', () => {
    if (window.mediaPipeAnalyzer) {
        window.mediaPipeAnalyzer.disconnect();
    }
});
