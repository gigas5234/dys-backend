/**
 * 카메라 분석기 모듈
 * 실시간 카메라 스트림 분석 및 피드백 처리를 담당
 */

// --- 전역 변수 ---
let analyzerClient = null;
let analyzerStarted = false;

/**
 * 카메라 분석기 클래스
 * 실시간 카메라 스트림을 분석하여 사용자 자세, 표정, 시선 등을 평가
 */
class CameraAnalyzer {
  constructor({ onMetrics } = {}) {
    this.onMetrics = onMetrics;
    this._videoEl = null;
    this._stream = null;
    this._useWorkerOnly = true; // MediaPipe 모드만 사용
    
    // 점수 유지 시스템
    this._lastValidScores = {
      attention: 0,
      stability: 0,
      blink: 0,
      posture: 0
    };
    this._consecutiveZeroScores = 0;
    this._maxConsecutiveZeros = 4; // 4번 연속 0점이면 경고
    this._scoreHoldDuration = 3000; // 3초간 점수 유지
    this._lastScoreTime = 0;
    this._cameraWarningShown = false;
    
    // 카메라 자동 종료 대응
    this._watchdogTimer = null;
    this._lastFrameTime = Date.now();
    this._cameraHealthCheck = null;
    this._restartAttempts = 0;
    this._maxRestartAttempts = 3;
    
    // Page Visibility API 대응
    this._setupVisibilityHandlers();
  }

  /**
   * 미디어 스트림 초기화
   */
  async _ensureMedia() {
    if (this._stream) return;
    
    const constraints = { 
      video: { 
        width: { ideal: 640 }, 
        height: { ideal: 360 }, 
        frameRate: { ideal: 15, max: 15 } 
      }, 
      audio: false 
    };
    
    this._stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // hidden video element
    this._videoEl = document.createElement('video');
    this._videoEl.playsInline = true;
    this._videoEl.muted = true;
    this._videoEl.autoplay = true;
    this._videoEl.style.display = 'none';
    this._videoEl.srcObject = this._stream;
    document.body.appendChild(this._videoEl);
    await this._videoEl.play().catch(() => {});
    
    // MediaPipe 직접 모듈 연결
    console.log('[ANALYZER] 🚀 MediaPipe 직접 모듈 연결 시작...');
    console.log('[ANALYZER] 📊 현재 상태:', {
      videoEl: !!this._videoEl,
      videoWidth: this._videoEl?.videoWidth,
      videoHeight: this._videoEl?.videoHeight,
      readyState: this._videoEl?.readyState,
      MediaPipeDirect: typeof window.MediaPipeDirect,
      isInitialized: window.MediaPipeDirect?.isInitialized?.()
    });
    
    // MediaPipe 직접 모듈이 로드될 때까지 대기
    let retryCount = 0;
    const maxRetries = 20; // 최대 20초 대기 (MediaPipe 라이브러리 로딩 시간 고려)
    
    const waitForMediaPipeDirect = async () => {
      console.log(`[ANALYZER] 🔍 MediaPipe 직접 모듈 검색 시도 ${retryCount + 1}/${maxRetries}:`, {
        MediaPipeDirect: typeof window.MediaPipeDirect,
        connectMediaPipeToVideo: typeof window.MediaPipeDirect?.connectMediaPipeToVideo,
        isInitialized: window.MediaPipeDirect?.isInitialized?.()
      });
      
      if (typeof window.MediaPipeDirect?.connectMediaPipeToVideo === 'function') {
        console.log('[ANALYZER] ✅ MediaPipe 직접 모듈 발견! 연결 시도...');
        try {
          console.log('[ANALYZER] 📹 비디오 요소 상태:', {
            videoEl: !!this._videoEl,
            videoWidth: this._videoEl?.videoWidth,
            videoHeight: this._videoEl?.videoHeight,
            readyState: this._videoEl?.readyState,
            paused: this._videoEl?.paused,
            ended: this._videoEl?.ended
          });
          
          // MediaPipe 직접 모듈 연결
          await window.MediaPipeDirect.connectMediaPipeToVideo(
            this._videoEl,
            (analysisResult) => {
              console.log('[ANALYZER] 🎯 MediaPipe 분석 결과 수신:', {
                smileIntensity: analysisResult.smileIntensity,
                ear: analysisResult.ear,
                neckScore: analysisResult.neckAnalysis?.postureScore,
                shoulderScore: analysisResult.shoulderAnalysis?.shoulderPostureScore,
                gazeScore: analysisResult.gazeAnalysis?.stabilityScore,
                timestamp: new Date().toISOString()
              });
              
              // UI 업데이트 함수 호출
              if (typeof updateCameraMetrics === 'function') {
                updateCameraMetrics(analysisResult);
              }
            }
          );
          
          console.log('[ANALYZER] 🎉 MediaPipe 직접 모듈 연결 완료!');
          
          // MediaPipe 모드 활성화
          this._useWorkerOnly = true;
          console.log('[ANALYZER] ✅ MediaPipe 직접 모드 활성화');
          
          return; // 성공적으로 MediaPipe 연결됨
        } catch (error) {
          console.error('[ANALYZER] ❌ MediaPipe 직접 모듈 연결 중 오류:', error);
          console.error('[ANALYZER] 🔍 오류 상세 정보:', {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack?.split('\n').slice(0, 3).join('\n')
          });
          throw error;
        }
      } else {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error(`[ANALYZER] 💀 MediaPipe 직접 모듈을 ${maxRetries}초 동안 찾을 수 없음`);
          console.error('[ANALYZER] 🔍 최종 상태:', {
            MediaPipeDirect: typeof window.MediaPipeDirect,
            connectMediaPipeToVideo: typeof window.MediaPipeDirect?.connectMediaPipeToVideo,
            retryCount,
            maxRetries
          });
          throw new Error(`MediaPipe 직접 모듈을 ${maxRetries}초 동안 찾을 수 없음 - MediaPipe 모드 필수`);
        }
        
        console.log(`[ANALYZER] ⏳ MediaPipe 직접 모듈 대기 중... (${retryCount}/${maxRetries})`);
        console.log('[ANALYZER] 📊 현재 전역 상태:', {
          windowKeys: Object.keys(window).filter(key => key.includes('MediaPipe') || key.includes('media')),
          hasMediaPipeDirect: typeof window.MediaPipeDirect,
          hasConnectFunction: typeof window.MediaPipeDirect?.connectMediaPipeToVideo
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        return waitForMediaPipeDirect(); // 재귀적으로 재시도
      }
    };
    
    try {
      console.log('[ANALYZER] 🚀 MediaPipe 직접 모듈 연결 프로세스 시작...');
      await waitForMediaPipeDirect();
      console.log('[ANALYZER] 🎉 MediaPipe 직접 모듈 연결 프로세스 완료!');
    } catch (error) {
      console.error('[ANALYZER] 💀 MediaPipe 직접 모듈 연결 실패:', error);
      console.error('[ANALYZER] 🔍 실패 원인 분석:', {
        errorType: error.constructor.name,
        errorMessage: error.message,
        hasMediaPipeDirect: typeof window.MediaPipeDirect,
        hasConnectFunction: typeof window.MediaPipeDirect?.connectMediaPipeToVideo,
        windowKeys: Object.keys(window).filter(key => key.includes('MediaPipe') || key.includes('media'))
      });
      throw new Error('MediaPipe 직접 모듈 연결이 필수입니다. 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.');
    }
  }
  
  /**
   * 분석 시작 (MediaPipe 전용)
   */
  async start() {
    try {
      console.log('[ANALYZER] 🚀 분석기 시작 시도...');
      await this._ensureMedia();
      
      if (this._loopTimer) {
        console.log('[ANALYZER] ⚠️ 이미 실행 중');
        return;
      }
      
      // MediaPipe 모드만 지원
      if (this._useWorkerOnly) {
        console.log('[ANALYZER] ✅ MediaPipe 모드 활성화 - HTTP 분석 루프 비활성화');
        // 워치독 시작
        this._startWatchdog();
        
        // 시작 후 상태 확인
        setTimeout(() => {
          console.log('[ANALYZER] 📊 시작 후 상태 확인:', {
            stream: !!this._stream,
            videoEl: !!this._videoEl,
            MediaPipeDirect: typeof window.MediaPipeDirect,
            isInitialized: window.MediaPipeDirect?.isInitialized?.()
          });
        }, 2000);
        
        return;
      } else {
        throw new Error('MediaPipe 모드가 활성화되지 않았습니다. 페이지를 새로고침해주세요.');
      }
    } catch (e) {
      console.error('[ANALYZER] ❌ 시작 실패:', e);
      console.error('[ANALYZER] 📋 상세 오류:', e.stack);
      
      // 에러 발생 시 재시도 로직
      if (this._restartAttempts < this._maxRestartAttempts) {
        console.log(`[ANALYZER] 🔄 재시도 시도 ${this._restartAttempts + 1}/${this._maxRestartAttempts}`);
        this._restartAttempts++;
        setTimeout(() => this.start(), 3000);
      } else {
        console.error('[ANALYZER] ❌ 최대 재시도 횟수 초과');
        throw e;
      }
    }
  }

  /**
   * 분석 중지
   */
  stop() {
    // MediaPipe 모드에서는 별도 정리 작업 불필요
    console.log('[ANALYZER] MediaPipe 모드 중지');
  }
  
  /**
   * MediaPipe 모드 활성화 (기본값)
   */
  enableMediaPipeMode() {
    this._useWorkerOnly = true;
    if (this._loopTimer) { 
      clearTimeout(this._loopTimer); 
      this._loopTimer = null; 
    }
    console.log('[ANALYZER] MediaPipe 모드 활성화');
  }

  /**
   * 에러 처리
   */
  _onError(statusCode) {
    this.consecutiveErrors += 1;
    
    // 500 에러는 더 강력한 대응
    if (statusCode >= 500) {
      this.consecutiveErrors += 2; // 500 에러는 더 심각하게 취급
      this.cooldownUntil = Date.now() + 4000; // 4초 휴식
    }
    
    if (this.consecutiveErrors === 1) {
      // first error → reduce fps
      this.captureFps = Math.max(this.minFps, this.captureFps - 0.3);
    }
    if (this.consecutiveErrors >= 2) {
      // 2번째 에러부터 더 적극적으로 감소
      this.captureFps = Math.max(this.minFps, this.captureFps - 0.2);
      this._jpegQuality = Math.max(0.6, this._jpegQuality - 0.1);
    }
    if (this.consecutiveErrors >= 3) {
      // sustained errors → downscale and reduce quality
      if (this._targetWidth > 640) this._targetWidth = 640;
      else if (this._targetWidth > 480) this._targetWidth = 480;
      else if (this._targetWidth > 320) this._targetWidth = 320;
      this._jpegQuality = Math.max(0.5, this._jpegQuality - 0.05);
      this.captureFps = Math.max(this.minFps, 0.3); // 더 낮은 최소 FPS
    }
    if (this.consecutiveErrors >= 5) {
      // 심각한 에러 → 최소 설정
      this._targetWidth = 320;
      this._jpegQuality = 0.5;
      this.captureFps = 0.2; // 매우 낮은 FPS
      this.cooldownUntil = Date.now() + 8000; // 8초 휴식
    }
  }

  /**
   * 성공 처리
   */
  _onSuccess() {
    if (this.consecutiveErrors > 0) {
      this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1); // 점진적 복구
    }
    this.cooldownUntil = 0;
    
    // 연속 성공 시에만 점진적 복구
    if (this.consecutiveErrors === 0) {
      // 매우 보수적으로 복구
      if (this.captureFps < this.maxFps) this.captureFps = Math.min(this.maxFps, this.captureFps + 0.05);
      if (this._jpegQuality < 0.8) this._jpegQuality = Math.min(0.8, this._jpegQuality + 0.005);
      if (this._targetWidth < 800) this._targetWidth += 10; // 더 작은 증가
    }
  }
  
  /**
   * 점수 처리 및 유지 시스템
   */
  _processScores(mapped) {
    const now = Date.now();
    const scores = mapped.scores || {};
    
    // 모든 점수가 0인지 확인 (백엔드에서 0점 반환)
    const allZero = Object.values(scores).every(score => score === 0);
    
    // 추가 조건: status나 posture_status가 데이터없음/분석오류인 경우도 0점으로 처리
    const noDataStatus = mapped.status === 'no-face' || 
                        mapped.status === 'no-camera' || 
                        mapped.posture_status === '데이터없음' || 
                        mapped.posture_status === '분석오류' ||
                        mapped.enhanced_posture_status === '데이터없음' ||
                        mapped.enhanced_posture_status === '분석오류';
    
    const shouldTreatAsZero = allZero || noDataStatus;
    
    if (shouldTreatAsZero) {
      this._consecutiveZeroScores++;
      
      // 연속 0점이 임계값을 넘으면 경고 표시
      if (this._consecutiveZeroScores >= this._maxConsecutiveZeros && !this._cameraWarningShown) {
        this._showCameraWarning();
        this._cameraWarningShown = true;
      }
      
      // 이전 유효한 점수 사용 (3초 이내)
      if (now - this._lastScoreTime < this._scoreHoldDuration) {
        return {
          ...mapped,
          scores: { ...this._lastValidScores },
          _usingHeldScores: true
        };
      }
    } else {
      // 유효한 점수가 있으면 저장하고 카운터 리셋
      this._lastValidScores = { ...scores };
      this._lastScoreTime = now;
      this._consecutiveZeroScores = 0;
      this._cameraWarningShown = false;
      this._hideCameraWarning();
    }
    
    return mapped;
  }
  
  /**
   * 카메라 경고 표시
   */
  _showCameraWarning = () => {
    if (typeof showCameraWarning === 'function') {
      showCameraWarning();
    }
  }

  /**
   * 카메라 경고 숨김
   */
  _hideCameraWarning = () => {
    if (typeof hideCameraWarning === 'function') {
      hideCameraWarning();
    }
  }
  
  /**
   * Page Visibility API 핸들러 설정
   */
  _setupVisibilityHandlers() {
    // 탭 숨김/표시 이벤트 처리
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[CAMERA] 🫥 탭이 숨겨짐 - 카메라 일시정지');
        this._pauseCamera();
      } else {
        console.log('[CAMERA] 👁️ 탭이 표시됨 - 카메라 재시작');
        this._resumeCamera();
      }
    });
    
    // 브라우저 포커스 이벤트
    window.addEventListener('blur', () => {
      console.log('[CAMERA] 🔍 브라우저 포커스 잃음');
    });
    
    window.addEventListener('focus', () => {
      console.log('[CAMERA] 🎯 브라우저 포커스 복귀');
      this._checkCameraHealth();
    });
  }

  /**
   * 카메라 일시정지
   */
  _pauseCamera() {
    if (this._watchdogTimer) {
      clearInterval(this._watchdogTimer);
      this._watchdogTimer = null;
    }
    if (this._cameraHealthCheck) {
      clearInterval(this._cameraHealthCheck);
      this._cameraHealthCheck = null;
    }
  }

  /**
   * 카메라 재시작
   */
  async _resumeCamera() {
    try {
      await this._checkCameraHealth();
      this._startWatchdog();
    } catch (error) {
      console.error('[CAMERA] 재시작 실패:', error);
      this._attemptRestart();
    }
  }

  /**
   * 카메라 상태 확인
   */
  async _checkCameraHealth() {
    if (!this._stream) {
      console.log('[CAMERA] ⚠️ 스트림 없음 - 재시작 필요');
      return this._attemptRestart();
    }
    
    const tracks = this._stream.getVideoTracks();
    if (tracks.length === 0) {
      console.log('[CAMERA] ⚠️ 비디오 트랙 없음 - 재시작 필요');
      return this._attemptRestart();
    }
    
    const track = tracks[0];
    if (track.readyState === 'ended') {
      console.log('[CAMERA] ⚠️ 비디오 트랙 종료됨 - 재시작 필요');
      return this._attemptRestart();
    }
    
    console.log('[CAMERA] ✅ 카메라 상태 양호');
    return true;
  }

  /**
   * 카메라 재시작 시도
   */
  async _attemptRestart() {
    if (this._restartAttempts >= this._maxRestartAttempts) {
      console.error('[CAMERA] ❌ 최대 재시작 시도 횟수 초과');
      this._showCameraWarning();
      return false;
    }
    
    this._restartAttempts++;
    console.log(`[CAMERA] 🔄 카메라 재시작 시도 ${this._restartAttempts}/${this._maxRestartAttempts}`);
    
    try {
      // 기존 스트림 정리
      if (this._stream) {
        this._stream.getTracks().forEach(track => track.stop());
        this._stream = null;
      }
      
      // 새 스트림 획득
      await this._ensureMedia();
      console.log('[CAMERA] ✅ 카메라 재시작 성공');
      this._restartAttempts = 0; // 성공 시 카운터 리셋
      this._hideCameraWarning();
      this._startWatchdog();
      return true;
      
    } catch (error) {
      console.error(`[CAMERA] ❌ 재시작 실패 (${this._restartAttempts}/${this._maxRestartAttempts}):`, error);
      
      // 재시도 대기
      setTimeout(() => {
        if (this._restartAttempts < this._maxRestartAttempts) {
          this._attemptRestart();
        }
      }, 2000 * this._restartAttempts); // 지수 백오프
      
      return false;
    }
  }

  /**
   * 카메라 감시 타이머 시작
   */
  _startWatchdog() {
    if (this._watchdogTimer) {
      clearInterval(this._watchdogTimer);
    }
    
    // 10초마다 카메라 상태 확인
    this._watchdogTimer = setInterval(() => {
      this._checkCameraHealth();
    }, 10000);
    
    // 5분마다 건강 체크
    if (this._cameraHealthCheck) {
      clearInterval(this._cameraHealthCheck);
    }
    this._cameraHealthCheck = setInterval(() => {
      const now = Date.now();
      if (now - this._lastFrameTime > 30000) { // 30초간 프레임 없음
        console.warn('[CAMERA] ⚠️ 30초간 프레임 없음 - 재시작 시도');
        this._attemptRestart();
      }
    }, 300000); // 5분마다
  }

  /**
   * 프레임 시간 업데이트 (MediaPipe에서 호출)
   */
  _updateFrameTime() {
    this._lastFrameTime = Date.now();
  }

  /**
   * 정리 메서드
   */
  cleanup() {
    this.stop();
    
    // 타이머 정리
    if (this._watchdogTimer) {
      clearInterval(this._watchdogTimer);
      this._watchdogTimer = null;
    }
    if (this._cameraHealthCheck) {
      clearInterval(this._cameraHealthCheck);
      this._cameraHealthCheck = null;
    }
    
    if (this._stream) {
      this._stream.getTracks().forEach(track => track.stop());
      this._stream = null;
    }
    if (this._videoEl && this._videoEl.parentNode) {
      this._videoEl.parentNode.removeChild(this._videoEl);
    }
    this._hideCameraWarning();
  }
  
  /**
   * 실시간 스코어 주입 메서드
   */
  ingestRealtimeScores(rawScores) {
    try {
      // 서버에서 매핑된 결과가 오면 통과,
      // 원시라면 mapFrameResultToMetrics로 통일(환경에 따라 주석 해제)
      const mapped = (typeof mapFrameResultToMetrics === "function")
        ? mapFrameResultToMetrics(rawScores)
        : rawScores;
      const processed = this._processScores(mapped);
      if (typeof this.onMetrics === "function") this.onMetrics(processed);
    } catch (_) {}
  }
}

/**
 * 분석기 시작 스케줄링
 */
function scheduleAnalyzerStart() {
  console.log('[ANALYZER] 🚀 분석기 시작 스케줄링 시작...');
  
  if (analyzerStarted) {
    console.log('[ANALYZER] ⚠️ 이미 시작됨');
    return;
  }
  
  analyzerStarted = true;
  
  const centralVideo = document.getElementById('video'); // 데이트 영상
  const maxDelayMs = 10000; // 10초 내 시작
  const extraDelayMs = 1500; // canplay 이후 추가 지연
  let started = false;

  const tryStart = async () => {
    if (started) {
      console.log('[ANALYZER] ⚠️ 이미 시작 시도됨');
      return;
    }
    started = true;
    
    console.log('[ANALYZER] 🔧 CameraAnalyzer 인스턴스 생성...');
    analyzerClient = new CameraAnalyzer({ onMetrics: updateCameraMetrics });
    window.analyzerClient = analyzerClient; // 전역으로 설정
    
    try {
      // 초기 10프레임 매핑 디버그 로깅 활성화
      window.__ANALYZER_DEBUG__ = 1;
      console.log('[ANALYZER] 🚀 분석기 시작...');
      await analyzerClient.start();
      
      console.log('[ANALYZER] ✅ MediaPipe 모드로 시작 완료');
    } catch (e) {
      console.error('[ANALYZER] ❌ MediaPipe 시작 실패:', e);
      console.error('[ANALYZER] 📋 상세 오류:', e.stack);
      throw e; // MediaPipe 연결 실패는 치명적 오류
    }
  };

  console.log('[ANALYZER] ⏰ 타이머 설정:', { maxDelayMs, extraDelayMs });
  const startTimer = setTimeout(() => {
    console.log('[ANALYZER] ⏰ 최대 지연 시간 도달 - 강제 시작');
    tryStart();
  }, maxDelayMs);
  
  if (centralVideo) {
    console.log('[ANALYZER] 📹 중앙 비디오 요소 발견:', centralVideo);
    const onReady = () => {
      console.log('[ANALYZER] 📹 비디오 준비됨 - 추가 지연 후 시작');
      setTimeout(tryStart, extraDelayMs);
      centralVideo.removeEventListener('canplay', onReady);
    };
    centralVideo.addEventListener('canplay', onReady);
  } else {
    console.log('[ANALYZER] ⚠️ 중앙 비디오 요소를 찾을 수 없음');
  }
}

// 외부에서 사용할 수 있도록 전역 스코프에 노출
window.CameraAnalyzer = CameraAnalyzer;
window.analyzerClient = analyzerClient;
window.analyzerStarted = analyzerStarted;
window.scheduleAnalyzerStart = scheduleAnalyzerStart;
