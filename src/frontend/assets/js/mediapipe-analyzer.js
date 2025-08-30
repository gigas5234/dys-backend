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
        
        // 카메라 스트림 모니터링
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
        this.serverAnalysisInterval = 2000; // 2초마다
        this.currentMediaPipeScores = {};
        this.serverAnalysisResults = {};
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
     * 비디오 분석 시작
     */
    async startVideoAnalysis() {
        try {
            console.log("🎥 [MediaPipe] 비디오 분석 시작...");
            
            // 비디오 요소 찾기
            const video = document.querySelector('video');
            if (!video) {
                console.error("❌ [MediaPipe] 비디오 요소를 찾을 수 없습니다");
                return;
            }
            
            // 비디오가 로드될 때까지 대기
            if (video.readyState < 2) {
                console.log("⏳ [MediaPipe] 비디오 로딩 대기 중...");
                await new Promise((resolve) => {
                    video.addEventListener('loadeddata', resolve, { once: true });
                });
            }
            
            console.log("✅ [MediaPipe] 비디오 준비 완료, 분석 시작");
            
            // 실시간 분석 루프 시작
            this.analysisLoop(video);
            
        } catch (error) {
            console.error("❌ [MediaPipe] 비디오 분석 시작 실패:", error);
        }
    }
    
    /**
     * 실시간 분석 루프
     */
    async analysisLoop(video) {
        // 카메라 상태 상세 로깅 (주기적으로만)
        if (Math.random() < 0.1) { // 10% 확률로만 로그 출력
            this.logCameraStatus(video);
        }
        
        if (!this.isMediaPipeReady || !this.faceLandmarker) {
            console.warn("⚠️ [MediaPipe] 아직 준비되지 않음");
            setTimeout(() => this.analysisLoop(video), 1000); // 1초 후 재시도
            return;
        }
        
        // 비디오 상태 확인
        if (!video || video.readyState !== 4 || video.paused || video.ended) {
            console.warn("⚠️ [MediaPipe] 비디오가 준비되지 않음, 1초 후 재시도");
            setTimeout(() => this.analysisLoop(video), 1000);
            return;
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
                
                console.log("👤 [MediaPipe] 얼굴 감지됨, 점수:", scores);
                
                // 연속 실패 카운터 리셋
                this.consecutiveFailures = 0;
            } else {
                // 얼굴이 감지되지 않은 경우
                this.consecutiveFailures++;
                console.log(`❌ [MediaPipe] 얼굴이 감지되지 않음 (${this.consecutiveFailures}회 연속)`);
                
                // 연속 실패가 많으면 UI 클리어
                if (this.consecutiveFailures >= 10) {
                    this.clearRealtimeUI();
                    this.resetAnalysisStatus();
                }
            }
            
        } catch (error) {
            console.error("❌ [MediaPipe] 분석 중 오류:", error);
            this.consecutiveFailures++;
            
            // 오류 발생시 재시도 간격 조정
            const retryDelay = this.consecutiveFailures >= 20 ? 5000 : 2000;
            setTimeout(() => this.analysisLoop(video), retryDelay);
            return;
        }
        
        // 다음 프레임 분석 (약 5fps로 대폭 감소)
        if (this.isMediaPipeReady) {
            setTimeout(() => this.analysisLoop(video), 200); // 200ms 간격 (5fps)
        }
    }
    
    /**
     * MediaPipe 실시간 점수 계산
     */
    calculateRealtimeScores(landmarks) {
        const scores = {
            expression: this.calculateExpressionScore(landmarks),
            concentration: this.calculateConcentrationScore(landmarks),
            gaze: this.calculateGazeScore(landmarks),
            blinking: this.calculateBlinkingScore(landmarks),
            posture: this.calculatePostureScore(landmarks),
            initiative: this.calculateInitiativeScore(landmarks)
        };
        
        this.currentMediaPipeScores = scores;
        return scores;
    }
    
    /**
     * 실시간 UI 업데이트
     */
    updateRealtimeUI(scores) {
        try {
            // 표정 점수 업데이트
            this.updateExpressionScore(scores.expression);
            this.updateConcentrationScore(scores.concentration);
            this.updateGazeScore(scores.gaze);
            this.updateBlinkingScore(scores.blinking);
            this.updatePostureScore(scores.posture);
            
            console.log("📊 실시간 점수 업데이트:", scores);
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
            element.textContent = Math.round(score);
            element.style.color = this.getScoreColor(score);
        } else {
            console.log("📊 [UI] 표정 점수:", Math.round(score));
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
     * 서버 분석 스케줄링 (임시 비활성화)
     */
    async scheduleServerAnalysis(video, mediapipeScores) {
        // 임시로 서버 분석 비활성화 (405 오류 해결 전까지)
        console.log("🚫 서버 분석 임시 비활성화 (MediaPipe만 사용)");
        return;
        
        const now = Date.now();
        
        if (this.isServerAnalysisRunning || 
            (now - this.lastServerAnalysis) < this.serverAnalysisInterval) {
            return; // 아직 시간 안됨
        }
        
        this.lastServerAnalysis = now;
        this.isServerAnalysisRunning = true;
        
        try {
            await this.sendFrameToServer(video, mediapipeScores);
        } catch (error) {
            console.warn("⚠️ 서버 분석 실패, MediaPipe로만 계속 진행:", error);
        } finally {
            this.isServerAnalysisRunning = false;
        }
    }
    
    /**
     * 서버로 프레임 및 MediaPipe 점수 전송
     */
    async sendFrameToServer(video, mediapipeScores) {
        // 캔버스에 현재 프레임 캡처
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        // 이미지를 base64로 변환
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        try {
            console.log("🧠 서버 표정 분석 요청...");
            
            // 절대 URL로 변경
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/expression/analyze`, {
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
                this.handleServerAnalysisResult(result);
            } else {
                console.warn("⚠️ 서버 분석 응답 오류:", response.status, response.statusText);
                // 서버 오류시 MediaPipe 점수만 사용
                this.handleServerAnalysisResult({
                    model_scores: mediapipeScores,
                    mediapipe_scores: mediapipeScores,
                    is_anomaly: false,
                    feedback: { confidence: 0.8 }
                });
            }
            
        } catch (error) {
            console.warn("⚠️ 서버 분석 요청 실패:", error);
            // 네트워크 오류시 MediaPipe 점수만 사용
            this.handleServerAnalysisResult({
                model_scores: mediapipeScores,
                mediapipe_scores: mediapipeScores,
                is_anomaly: false,
                feedback: { confidence: 0.8 }
            });
        }
    }
    
    /**
     * 서버 분석 결과 처리
     */
    handleServerAnalysisResult(result) {
        console.log("🎯 서버 분석 결과:", result);
        
        this.serverAnalysisResults = result;
        
        // 모델 vs MediaPipe 점수 비교
        if (result.is_anomaly) {
            console.warn("⚠️ 점수 불일치 감지:", {
                model: result.model_scores,
                mediapipe: result.mediapipe_scores,
                difference: result.score_differences
            });
            
            // 이상 감지시 UI에 알림
            this.showAnomalyAlert(result);
        }
        
        // 피드백 UI 업데이트
        this.updateFeedbackUI(result);
        
        // 정확한 모델 기반 점수로 UI 조정
        this.adjustUIWithModelScores(result.model_scores);
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
     * 표정 점수 계산
     */
    calculateExpressionScore(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return 0;
            }
            
            // 입술 곡률 계산 (미소 감지)
            const mouthLeft = landmarks[61];  // 입 왼쪽
            const mouthRight = landmarks[291]; // 입 오른쪽  
            const mouthTop = landmarks[13];    // 입 위
            const mouthBottom = landmarks[14]; // 입 아래
            
            // 미소 정도 계산
            const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
            const mouthHeight = Math.abs(mouthTop.y - mouthBottom.y);
            const smileRatio = mouthWidth / (mouthHeight + 0.001); // 0으로 나누기 방지
            
            // 눈 표정 계산 (눈썹 위치)
            const leftEyebrow = landmarks[70];   // 왼쪽 눈썹
            const rightEyebrow = landmarks[300]; // 오른쪽 눈썹
            const leftEye = landmarks[159];      // 왼쪽 눈
            const rightEye = landmarks[386];     // 오른쪽 눈
            
            const eyebrowDistance = (
                Math.abs(leftEyebrow.y - leftEye.y) + 
                Math.abs(rightEyebrow.y - rightEye.y)
            ) / 2;
            
            // 정규화된 점수 계산 (0-100)
            const normalizedSmileRatio = Math.min(1, Math.max(0, (smileRatio - 1) * 2)); // 1-2 범위를 0-1로 정규화
            const normalizedEyebrowDistance = Math.min(1, Math.max(0, eyebrowDistance * 10)); // 0-0.1 범위를 0-1로 정규화
            
            // 종합 표정 점수 (0-100)
            const expressionScore = Math.round(
                (normalizedSmileRatio * 60 + normalizedEyebrowDistance * 40)
            );
            
            console.log(`📊 [MediaPipe] 표정 점수 계산:`, {
                mouthWidth: mouthWidth.toFixed(4),
                mouthHeight: mouthHeight.toFixed(4),
                smileRatio: smileRatio.toFixed(4),
                eyebrowDistance: eyebrowDistance.toFixed(4),
                normalizedSmileRatio: normalizedSmileRatio.toFixed(4),
                normalizedEyebrowDistance: normalizedEyebrowDistance.toFixed(4),
                finalScore: expressionScore
            });
            
            return expressionScore;
            
        } catch (error) {
            console.error("❌ 표정 점수 계산 실패:", error);
            return 0;
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
            const blinkScore = 100 - this.calculateBlinkingScore(landmarks);
            
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
     * 시선 점수 계산
     */
    calculateGazeScore(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return 0;
            }
            
            // 눈동자 중심점 계산
            const leftEyeCenter = this.getEyeCenter(landmarks, 'left');
            const rightEyeCenter = this.getEyeCenter(landmarks, 'right');
            
            // 화면 중앙을 향한 시선 계산 (0.5, 0.5가 중앙)
            const targetX = 0.5, targetY = 0.5;
            
            const leftDistance = Math.sqrt(
                Math.pow(leftEyeCenter.x - targetX, 2) + 
                Math.pow(leftEyeCenter.y - targetY, 2)
            );
            
            const rightDistance = Math.sqrt(
                Math.pow(rightEyeCenter.x - targetX, 2) + 
                Math.pow(rightEyeCenter.y - targetY, 2)
            );
            
            const avgDistance = (leftDistance + rightDistance) / 2;
            const gazeScore = Math.max(0, 100 - (avgDistance * 200));
            
            console.log(`📊 [MediaPipe] 시선 점수: ${gazeScore.toFixed(1)} (거리: ${avgDistance.toFixed(3)})`);
            return Math.round(gazeScore);
            
        } catch (error) {
            console.error("❌ 시선 점수 계산 실패:", error);
            return 0;
        }
    }
    
    /**
     * 깜빡임 점수 계산
     */
    calculateBlinkingScore(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return 0;
            }
            
            // 왼쪽 눈 개방도
            const leftEyeTop = landmarks[159];    // 왼쪽 눈 위
            const leftEyeBottom = landmarks[145]; // 왼쪽 눈 아래
            const leftEyeOpen = Math.abs(leftEyeTop.y - leftEyeBottom.y);
            
            // 오른쪽 눈 개방도  
            const rightEyeTop = landmarks[386];   // 오른쪽 눈 위
            const rightEyeBottom = landmarks[374]; // 오른쪽 눈 아래
            const rightEyeOpen = Math.abs(rightEyeTop.y - rightEyeBottom.y);
            
            // 평균 눈 개방도
            const avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2;
            
            // 깜빡임 점수 (눈이 많이 열려있을수록 높은 점수)
            const blinkingScore = Math.min(100, avgEyeOpen * 2000); // 스케일링
            
            console.log(`📊 [MediaPipe] 깜빡임 점수: ${blinkingScore.toFixed(1)} (개방도: ${avgEyeOpen.toFixed(4)})`);
            return Math.round(blinkingScore);
            
        } catch (error) {
            console.error("❌ 깜빡임 점수 계산 실패:", error);
            return 0;
        }
    }
    
    /**
     * 자세 점수 계산
     */
    calculatePostureScore(landmarks) {
        try {
            if (!landmarks || landmarks.length < 468) {
                return 0;
            }
            
            // 얼굴 기울기 계산
            const leftEar = landmarks[234];  // 왼쪽 귀
            const rightEar = landmarks[454]; // 오른쪽 귀
            const faceTilt = Math.abs(leftEar.y - rightEar.y);
            
            // 코와 이마의 수직성
            const nose = landmarks[1];       // 코끝
            const forehead = landmarks[10];  // 이마
            const faceVertical = Math.abs(nose.x - forehead.x);
            
            // 자세 점수 (기울기가 적을수록 높은 점수)
            const postureScore = Math.max(0, 100 - (faceTilt + faceVertical) * 200);
            
            console.log(`📊 [MediaPipe] 자세 점수: ${postureScore.toFixed(1)} (기울기: ${faceTilt.toFixed(4)}, 수직성: ${faceVertical.toFixed(4)})`);
            return Math.round(postureScore);
            
        } catch (error) {
            console.error("❌ 자세 점수 계산 실패:", error);
            return 0;
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
                // 왼쪽 눈 랜드마크들의 중심
                const eyeLandmarks = [33, 7, 163, 144, 145, 153];
                let x = 0, y = 0;
                for (const idx of eyeLandmarks) {
                    x += landmarks[idx].x;
                    y += landmarks[idx].y;
                }
                return { x: x / eyeLandmarks.length, y: y / eyeLandmarks.length };
            } else {
                // 오른쪽 눈 랜드마크들의 중심
                const eyeLandmarks = [362, 382, 381, 380, 374, 373];
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
     * 비디오 요소 모니터링
     */
    monitorVideoElement(video) {
        console.log("🔍 [카메라] 비디오 요소 모니터링 시작");
        
        // 비디오 이벤트 리스너
        const events = [
            'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough',
            'play', 'playing', 'pause', 'ended', 'error', 'abort', 'emptied',
            'stalled', 'suspend', 'waiting'
        ];
        
        events.forEach(event => {
            video.addEventListener(event, (e) => {
                console.log(`🔍 [카메라] 이벤트: ${event}`, {
                    readyState: video.readyState,
                    paused: video.paused,
                    ended: video.ended,
                    currentTime: video.currentTime,
                    srcObject: !!video.srcObject,
                    streamActive: video.srcObject?.active || false
                });
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
                    console.log("🔍 [카메라] srcObject 변경:", {
                        hasStream: !!stream,
                        streamActive: stream?.active || false,
                        streamId: stream?.id || 'none'
                    });
                    
                    if (stream) {
                        self.monitorStream(stream);
                    }
                    
                    originalSrcObject.set.call(this, stream);
                },
                get: originalSrcObject.get
            });
        }
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
            probabilities: this.getAveragedExpressions(scores),
            lastUpdate: new Date().toISOString()
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
            gazeDirection: this.getGazeDirection(scores),
            eyeCenter: this.getEyeCenterData(scores),
            lastUpdate: new Date().toISOString()
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
            lastUpdate: new Date().toISOString()
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
            lastUpdate: new Date().toISOString()
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
            lastUpdate: new Date().toISOString()
        };
        
        window.currentPostureData = postureData;
        
        const popup = document.getElementById('posture-details-popup');
        if (popup && popup.classList.contains('active')) {
            this.updatePosturePopupUI(postureData);
        }
    }
    
    /**
     * 주도성 팝업 데이터 업데이트
     */
    updateInitiativePopupData(scores) {
        const initiativeData = {
            score: scores.initiative,
            label: this.getScoreLabel(scores.initiative),
            factors: this.getInitiativeFactors(scores),
            lastUpdate: new Date().toISOString()
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
    
    // UI 업데이트 메서드들 (팝업이 열려있을 때만 호출)
    updateExpressionPopupUI(data) {
        if (typeof window.updateExpressionPopupContent === 'function') {
            window.updateExpressionPopupContent();
        }
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
