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
        
        console.log("🎭 MediaPipe 분석기 초기화됨");
    }
    
    /**
     * 웹소켓 베이스 URL 초기화
     */
    initializeBaseUrl() {
        // 웹소켓 베이스 URL 동적 구성
        const protocol = 'wss';
        
        // Vercel을 통한 WebSocket 연결이 어려우므로 직접 GKE IP 사용
        const host = '34.64.136.237:8001';
        
        this.baseUrl = `${protocol}://${host}/ws`;
        
        console.log("🔗 MediaPipe WebSocket URL:", this.baseUrl);
        console.log("🔗 Location:", { protocol: location.protocol, host: location.host });
    }
    
    /**
     * 웹소켓 연결 설정
     */
    connect() {
        try {
            // 랜드마크 데이터용 웹소켓 (Ingress를 통한 경로 기반 라우팅)
            const landmarksUrl = `${this.baseUrl}/landmarks`;
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
            
            // 분석 결과용 웹소켓 (Ingress를 통한 경로 기반 라우팅)
            const analysisUrl = `${this.baseUrl}/analysis`;
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
     * 현재 분석 결과 반환
     */
    getCurrentAnalysis() {
        return this.currentAnalysis;
    }
    
    /**
     * 연결 상태 확인
     */
    isConnected() {
        return this.isConnected && this.isAnalysisConnected;
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
