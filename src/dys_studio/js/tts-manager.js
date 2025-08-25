/**
 * TTS (Text-to-Speech) 관리 모듈
 * AI 응답을 음성으로 읽어주는 기능
 */

class TTSManager {
    constructor() {
        console.log('[TTS] TTSManager 초기화');
        
        this.isPlaying = false;
        this.currentAudio = null;
        this.voice = "ko-KR-SunHiNeural"; // 기본 목소리 (밝고 친근한)
        this.volume = 0.8;
        this.rate = 1.5; // 기본 속도를 1.5로 설정
        this.isEnabled = true; // TTS 기본 활성화 (UI 없이도 작동)
        
        // TTS 설정 UI (숨김 처리)
        this.createTTSControls();
        
        console.log('[TTS] 초기화 완료 (UI 숨김)');
    }

    /**
     * TTS 컨트롤 UI 생성 (숨김 처리)
     */
    createTTSControls() {
        // TTS 버튼 UI 숨김 처리 - 녹색 버튼이 보이지 않도록 주석처리
        console.log('[TTS] TTS 컨트롤 UI 숨김 처리됨');
        return;
        
        /*
        // 기존 컨트롤이 있으면 제거
        const existing = document.getElementById('voice-settings-container');
        if (existing) existing.remove();
        
        const container = document.createElement('div');
        container.id = 'voice-settings-container';
        container.className = 'voice-settings-container';
        
        container.innerHTML = `
            <button class="voice-settings-toggle" id="voice-settings-toggle" title="목소리 설정">
                🔊
            </button>
            <div class="voice-settings-popup" id="voice-settings-popup">
                <div class="voice-settings-header">
                    <div class="voice-settings-title">
                        <span>🎤</span>
                        <span>목소리 설정</span>
                    </div>
                    <button class="voice-settings-close" id="voice-settings-close">×</button>
                </div>
                <div class="voice-settings-content">
                    <div class="voice-setting-group">
                        <div class="voice-setting-label">
                            <span>🔊</span>
                            <span>목소리 활성화</span>
                        </div>
                        <div class="voice-setting-control">
                            <div class="voice-toggle" id="voice-toggle"></div>
                            <span class="voice-value" id="voice-status">ON</span>
                        </div>
                    </div>
                    <div class="voice-setting-group">
                        <div class="voice-setting-label">
                            <span>⚡</span>
                            <span>속도</span>
                        </div>
                        <div class="voice-setting-control">
                                        <input type="range" class="voice-slider" id="voice-rate" min="0.8" max="2.0" step="0.1" value="1.5">
            <span class="voice-value" id="rate-value">1.5x</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // 이벤트 리스너 설정
        this.bindControlEvents();
        
        // 초기 상태 설정
        this.updateToggleState();
        */
    }
    
    /**
     * 컨트롤 이벤트 바인딩
     */
    bindControlEvents() {
        const toggleBtn = document.getElementById('voice-settings-toggle');
        const popup = document.getElementById('voice-settings-popup');
        const closeBtn = document.getElementById('voice-settings-close');
        const voiceToggle = document.getElementById('voice-toggle');
        const voiceStatus = document.getElementById('voice-status');
        // const volumeSlider = document.getElementById('voice-volume');
        // const volumeValue = document.getElementById('volume-value');
        const rateSlider = document.getElementById('voice-rate');
        const rateValue = document.getElementById('rate-value');
        
        // 토글 버튼 클릭
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.togglePopup();
            });
        }
        
        // 닫기 버튼 클릭
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hidePopup();
            });
        }
        
        // 팝업 외부 클릭 시 닫기
        document.addEventListener('click', (e) => {
            const container = document.getElementById('voice-settings-container');
            if (container && !container.contains(e.target)) {
                this.hidePopup();
            }
        });
        
        // 목소리 활성화 토글
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => {
                this.toggleTTS();
            });
        }
        
        // 음량 슬라이더 (숨김 처리)
        /*
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.volume = parseFloat(e.target.value);
                volumeValue.textContent = Math.round(this.volume * 100) + '%';
                
                // 현재 재생 중인 오디오 볼륨 조절
                if (this.currentAudio) {
                    this.currentAudio.volume = this.volume;
                }
            });
        }
        */
        
        // 속도 슬라이더
        if (rateSlider) {
            rateSlider.addEventListener('input', (e) => {
                this.rate = parseFloat(e.target.value);
                rateValue.textContent = this.rate + 'x';
                console.log('[TTS] 속도 변경:', this.rate);
            });
        }
    }
    
    /**
     * 팝업 토글
     */
    togglePopup() {
        const popup = document.getElementById('voice-settings-popup');
        if (popup) {
            if (popup.classList.contains('visible')) {
                this.hidePopup();
            } else {
                this.showPopup();
            }
        }
    }
    
    /**
     * 팝업 표시
     */
    showPopup() {
        const popup = document.getElementById('voice-settings-popup');
        if (popup) {
            popup.classList.add('visible');
        }
    }
    
    /**
     * 팝업 숨기기
     */
    hidePopup() {
        const popup = document.getElementById('voice-settings-popup');
        if (popup) {
            popup.classList.remove('visible');
        }
    }
    
    /**
     * 토글 상태 업데이트
     */
    updateToggleState() {
        const voiceToggle = document.getElementById('voice-toggle');
        const voiceStatus = document.getElementById('voice-status');
        const toggleBtn = document.getElementById('voice-settings-toggle');
        
        if (voiceToggle && voiceStatus && toggleBtn) {
            if (this.isEnabled) {
                voiceToggle.classList.add('active');
                voiceStatus.textContent = 'ON';
                toggleBtn.classList.add('active');
            } else {
                voiceToggle.classList.remove('active');
                voiceStatus.textContent = 'OFF';
                toggleBtn.classList.remove('active');
            }
        }
    }
    
    /**
     * TTS 켜기/끄기 토글
     */
    toggleTTS() {
        if (this.isEnabled) {
            this.isEnabled = false;
            this.stopSpeaking();
        } else {
            this.isEnabled = true;
        }
        
        this.updateToggleState();
        console.log('[TTS] TTS 상태 변경:', this.isEnabled ? 'ON' : 'OFF');
    }

    /**
     * 텍스트를 음성으로 변환하여 재생
     */
    async speak(text) {
        // 텍스트 검증 강화
        if (!this.isEnabled) {
            console.log('[TTS] TTS 비활성화됨');
            return;
        }
        
        if (!text || typeof text !== 'string') {
            console.warn('[TTS] 유효하지 않은 텍스트:', text);
            return;
        }
        
        // 텍스트 길이 및 내용 검증
        const trimmedText = text.trim();
        if (trimmedText.length === 0) {
            console.warn('[TTS] 빈 텍스트');
            return;
        }
        
        // 시스템 메시지 패턴 체크
        const systemPatterns = [
            /^HTTP.*?OK.*?$/,
            /^INFO:httpx:.*?$/,
            /^✅.*?$/,
            /^🤖.*?$/,
            /^🔄.*?$/,
            /^🔍.*?$/,
            /^📊.*?$/,
            /^\[AI_RESPONSE\].*?$/,
            /^\[SEND_MESSAGE\].*?$/,
            /^\[SAVE_MESSAGE\].*?$/,
            /^OpenAI.*?응답.*?$/,
            /^랜드마크.*?프레임.*?$/,
            /^📊.*?랜드마크.*?$/,
            /https?:\/\/[^\s]+/, // URL 패턴
            /www\.[^\s]+/, // www 도메인
            /[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // 일반 도메인
            /\/\/[^\s]+/, // //로 시작하는 경로
            /\{[^}]*\}/, // JSON 객체
            /\[[^\]]*\]/, // 배열
            /"[^"]*":\s*"[^"]*"/, // JSON 키-값 쌍
            /"[^"]*":\s*[^,}\]]+/, // JSON 키-값 쌍 (값이 문자열이 아닌 경우)
            // SSML 관련 패턴
            /<speak[^>]*>/i, // SSML speak 태그
            /<\/speak>/i, // SSML speak 닫기 태그
            /<prosody[^>]*>/i, // SSML prosody 태그
            /<\/prosody>/i, // SSML prosody 닫기 태그
            /<voice[^>]*>/i, // SSML voice 태그
            /<\/voice>/i, // SSML voice 닫기 태그
            /<break[^>]*>/i, // SSML break 태그
            /<emphasis[^>]*>/i, // SSML emphasis 태그
            /<\/emphasis>/i, // SSML emphasis 닫기 태그
            /<say-as[^>]*>/i, // SSML say-as 태그
            /<\/say-as>/i, // SSML say-as 닫기 태그
            /<phoneme[^>]*>/i, // SSML phoneme 태그
            /<\/phoneme>/i, // SSML phoneme 닫기 태그
            /<sub[^>]*>/i, // SSML sub 태그
            /<\/sub>/i, // SSML sub 닫기 태그
            /<audio[^>]*>/i, // SSML audio 태그
            /<mark[^>]*>/i, // SSML mark 태그
            /<bookmark[^>]*>/i, // SSML bookmark 태그
            /<p[^>]*>/i, // SSML p 태그
            /<\/p>/i, // SSML p 닫기 태그
            /<s[^>]*>/i, // SSML s 태그
            /<\/s>/i, // SSML s 닫기 태그
            /<w[^>]*>/i, // SSML w 태그
            /<\/w>/i, // SSML w 닫기 태그
            /<m[^>]*>/i, // SSML m 태그
            /<\/m>/i, // SSML m 닫기 태그
            /<t[^>]*>/i, // SSML t 태그
            /<\/t>/i, // SSML t 닫기 태그
            /xmlns="[^"]*"/i, // XML 네임스페이스
            /xml:lang="[^"]*"/i, // XML 언어 속성
            /version="[^"]*"/i, // XML 버전 속성
            /rate="[^"]*"/i, // 속도 속성
            /pitch="[^"]*"/i, // 피치 속성
            /volume="[^"]*"/i // 볼륨 속성
        ];
        
        for (const pattern of systemPatterns) {
            if (pattern.test(trimmedText)) {
                console.warn('[TTS] 시스템 메시지 감지, TTS 건너뜀:', trimmedText);
                return;
            }
        }
        
        if (this.isPlaying) {
            console.log('[TTS] 이미 재생 중');
            return;
        }
        
        try {
            console.log('[TTS] 음성 합성 시작:', trimmedText.substring(0, 50) + '...');
            
            // 현재 재생 중인 오디오 중지
            this.stopSpeaking();
            
            // 재생 상태 표시
            this.showSpeakingIndicator(text);
            this.isPlaying = true;
            
            // 서버에 TTS 요청 (SSML 비활성화)
            const response = await fetch(`${window.serverUrl || 'http://34.64.136.237'}/api/tts/speak`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice: this.voice
                    // rate는 클라이언트에서 처리 (SSML 방지)
                })
            });
            
            if (!response.ok) {
                throw new Error(`TTS 서버 오류: ${response.status}`);
            }
            
            // 오디오 데이터를 Blob으로 변환
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // 오디오 재생 (클라이언트에서 속도 조절)
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.volume = this.volume;
            this.currentAudio.playbackRate = this.rate; // 클라이언트에서 속도 조절
            
            // 재생 완료 시 정리
            this.currentAudio.onended = () => {
                this.isPlaying = false;
                this.hideSpeakingIndicator();
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
                console.log('[TTS] 음성 재생 완료');
            };
            
            // 재생 오류 처리
            this.currentAudio.onerror = (error) => {
                console.error('[TTS] 음성 재생 오류:', error);
                this.isPlaying = false;
                this.hideSpeakingIndicator();
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
            };
            
            // 재생 시작
            await this.currentAudio.play();
            console.log('[TTS] 음성 재생 시작');
            
        } catch (error) {
            console.error('[TTS] 음성 합성 실패:', error);
            this.isPlaying = false;
            this.hideSpeakingIndicator();
            
            // 서버에서 자동으로 대체 목소리를 시도하므로 사용자에게 알리지 않음
            // 대신 로그만 남김
            console.log('[TTS] 서버에서 대체 목소리 시도 중...');
        }
    }
    
    /**
     * 현재 재생 중인 음성 중지
     */
    stopSpeaking() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        this.isPlaying = false;
        this.hideSpeakingIndicator();
        console.log('[TTS] 음성 재생 중지');
    }
    
    /**
     * 음성 재생 중 인디케이터 표시
     */
    showSpeakingIndicator(text) {
        // 기존 인디케이터 제거
        const existing = document.getElementById('speaking-indicator');
        if (existing) existing.remove();
        
        const indicator = document.createElement('div');
        indicator.id = 'speaking-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 300px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99997;
            background: rgba(16, 185, 129, 0.95);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
            animation: fadeInUp 0.3s ease-out;
            max-width: 400px;
            text-align: center;
        `;
        
        indicator.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="
                    width: 12px;
                    height: 12px;
                    background: white;
                    border-radius: 50%;
                    animation: speakingPulse 1s infinite;
                "></div>
                <span>🎤 AI가 말하고 있어요...</span>
                <button onclick="window.ttsManager.stopSpeaking()" style="
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 10px;
                ">중지</button>
            </div>
        `;
        
        document.body.appendChild(indicator);
    }
    
    /**
     * 음성 재생 인디케이터 숨기기
     */
    hideSpeakingIndicator() {
        const indicator = document.getElementById('speaking-indicator');
        if (indicator) {
            indicator.style.animation = 'fadeOutDown 0.3s ease-out';
            setTimeout(() => indicator.remove(), 300);
        }
    }
    
    /**
     * 오류 메시지 표시
     */
    showErrorMessage(message) {
        // 기존 오류 메시지 제거
        const existing = document.getElementById('tts-error');
        if (existing) existing.remove();
        
        const errorDiv = document.createElement('div');
        errorDiv.id = 'tts-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 99999;
            background: rgba(239, 68, 68, 0.95);
            color: white;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
            animation: fadeInRight 0.3s ease-out;
        `;
        
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>⚠️</span>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none;
                    color: white;
                    border: none;
                    cursor: pointer;
                    padding: 2px;
                ">×</button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // 5초 후 자동으로 숨기기
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
    
    /**
     * 리소스 정리
     */
    cleanup() {
        this.stopSpeaking();
        
        const container = document.getElementById('voice-settings-container');
        if (container) container.remove();
        
        const indicator = document.getElementById('speaking-indicator');
        if (indicator) indicator.remove();
        
        const error = document.getElementById('tts-error');
        if (error) error.remove();
        
        console.log('[TTS] 정리 완료');
    }
}

// TTS 기본 활성화 상태
TTSManager.prototype.isEnabled = true;

// 전역 스코프에 노출
window.TTSManager = TTSManager;

console.log('[TTS] TTS 관리 모듈 로드 완료');
