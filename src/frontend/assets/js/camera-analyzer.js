/**
 * 하이브리드 카메라 분석기 - MediaPipe 실시간 + 서버 모델 분석
 */

let analyzerClient = null;
let analyzerStarted = false;

class CameraAnalyzer {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.isRunning = false;
    this.animationId = null;
    
    console.log('🎬 [ANALYZER] 하이브리드 카메라 분석기 생성');
  }
  
  async start() { 
    console.log('🚀 [ANALYZER] 하이브리드 분석 시작');
    
    try {
      // 비디오 요소 찾기
      this.video = document.querySelector('#webcam-feed, video');
      this.canvas = document.querySelector('#landmarks-canvas, canvas');
      
      if (!this.video) {
        console.error('❌ [ANALYZER] 비디오 요소를 찾을 수 없음');
        return;
      }
      
      if (!this.canvas) {
        console.error('❌ [ANALYZER] 캔버스 요소를 찾을 수 없음');
        return;
      }
      
      this.isRunning = true;
      this.startAnalysisLoop();
      
      console.log('✅ [ANALYZER] 분석 루프 시작됨');
      
    } catch (error) {
      console.error('❌ [ANALYZER] 시작 실패:', error);
    }
  }
  
  startAnalysisLoop() {
    if (!this.isRunning) return;
    
    // MediaPipe 분석기와 연동
    if (window.mediaPipeAnalyzer && this.video && this.canvas) {
      const ctx = this.canvas.getContext('2d');
      window.mediaPipeAnalyzer.analyzeFrame(this.video, this.canvas, ctx);
    }
    
    // 다음 프레임 예약 (60fps 목표)
    this.animationId = requestAnimationFrame(() => this.startAnalysisLoop());
  }
  
  stop() { 
    console.log('⏹️ [ANALYZER] 분석 중지');
    this.isRunning = false;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  cleanup() { 
    console.log('🧹 [ANALYZER] 정리 중');
    this.stop();
    this.video = null;
    this.canvas = null;
  }
  
  ingestRealtimeScores(scores) {
    // 실시간 점수 수집 (필요시 구현)
    console.log('📊 [ANALYZER] 실시간 점수:', scores);
  }
}

function scheduleAnalyzerStart() {
  console.log('⏰ [ANALYZER] 분석기 시작 예약');
  
  // MediaPipe가 준비될 때까지 대기
  const waitForMediaPipe = () => {
    if (window.mediaPipeAnalyzer) {
      console.log('✅ [ANALYZER] MediaPipe 준비 확인됨');
      
      if (!analyzerClient) {
        analyzerClient = new CameraAnalyzer();
      }
      
      if (!analyzerStarted) {
        analyzerClient.start();
        analyzerStarted = true;
      }
    } else {
      console.log('⏳ [ANALYZER] MediaPipe 대기 중...');
      setTimeout(waitForMediaPipe, 500);
    }
  };
  
  waitForMediaPipe();
}

window.CameraAnalyzer = CameraAnalyzer;
window.analyzerClient = analyzerClient;
window.analyzerStarted = analyzerStarted;
window.scheduleAnalyzerStart = scheduleAnalyzerStart;
