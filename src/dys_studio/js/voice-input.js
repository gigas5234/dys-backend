/**
 * 음성 입력 관리 모듈
 * 비디오 하단 빨간 버튼을 통한 음성 녹음 및 분석 기능
 */

class VoiceInputManager {
    constructor() {
        console.log('[VOICE] VoiceInputManager 생성자 호출');
        
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
        
        // DOM 요소 참조
        this.voiceInputBtn = null;
        this.chatInput = null;
        
        console.log('[VOICE] 초기화 시작...');
        
        // DOM이 로드된 후 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initialize();
            });
        } else {
            this.initialize();
        }
    }

    /**
     * 초기화 메서드
     */
    initialize() {
        this.initializeElements();
        this.bindEvents();
        console.log('[VOICE] 초기화 완료');
    }

    /**
     * DOM 요소 초기화
     */
    initializeElements() {
        this.chatInput = document.getElementById('chatInput');
        
        // 기존 버튼이 있는지 확인
        this.voiceInputBtn = document.getElementById('voiceInputBtn');
        
        if (!this.voiceInputBtn) {
            console.log('[VOICE] 음성 입력 버튼 생성');
            this.createVoiceButton();
        }
        
        console.log('[VOICE] DOM 요소 초기화 완료');
        console.log('[VOICE] voiceInputBtn:', this.voiceInputBtn);
        console.log('[VOICE] chatInput:', this.chatInput);
    }

    /**
     * 음성 입력 버튼 직접 생성
     */
    createVoiceButton() {
        console.log('[VOICE] 음성 입력 버튼 생성 시작');
        
        // 기존 버튼이 있으면 제거
        const existingBtn = document.getElementById('voiceInputBtn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        // 새 버튼 생성
        const button = document.createElement('button');
        button.id = 'voiceInputBtn';
        button.innerHTML = '🎤<br>음성';
        button.style.cssText = `
            position: fixed !important;
            bottom: 120px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 99999 !important;
            width: 80px !important;
            height: 80px !important;
            background: #ff4757 !important;
            border: none !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            color: white !important;
            font-weight: 600 !important;
            font-size: 12px !important;
            text-align: center !important;
            box-shadow: 0 8px 25px rgba(255, 71, 87, 0.5) !important;
            pointer-events: auto !important;
        `;
        
        // 직접 onclick 이벤트 설정
        button.onclick = () => {
            console.log('[VOICE] 버튼 클릭됨!');
            this.handleVoiceButtonClick();
        };
        
        document.body.appendChild(button);
        this.voiceInputBtn = button;
        
        console.log('[VOICE] 음성 입력 버튼 생성 완료');
        
        // 전역 스코프에 노출
        window.voiceManager = this;
    }



    /**
     * 이벤트 리스너 바인딩
     */
    bindEvents() {
        console.log('[VOICE] 이벤트 바인딩 완료 (onclick 직접 설정됨)');
    }

    /**
     * 음성 입력 버튼 클릭 처리
     */
    async handleVoiceButtonClick() {
        console.log('[VOICE] 음성 입력 버튼 클릭 처리');
        
        if (this.isRecording) {
            // 녹음 중이면 중지
            this.stopRecording();
        } else {
            // 마이크 권한 먼저 확인
            try {
                console.log('[VOICE] 마이크 권한 확인 중...');
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => track.stop()); // 테스트 스트림 정리
                console.log('[VOICE] 마이크 권한 확인 완료');
                
                // 권한이 있으면 녹음 시작
                this.startRecording();
            } catch (error) {
                console.error('[VOICE] 마이크 권한 거부:', error);
                alert('🎤 마이크 권한이 필요합니다!\n\n브라우저 주소창 왼쪽의 🔒 아이콘을 클릭하여\n마이크 권한을 허용해주세요.');
            }
        }
    }

    /**
     * 마이크 권한 상태 확인
     */
    async checkMicrophonePermission() {
        try {
            if (navigator.permissions && navigator.permissions.query) {
                const permission = await navigator.permissions.query({ name: 'microphone' });
                console.log('[VOICE] 마이크 권한 상태:', permission.state);
                return permission.state;
            } else {
                // permissions API가 지원되지 않는 경우
                console.log('[VOICE] permissions API 미지원, 직접 확인');
                return 'unknown';
            }
        } catch (error) {
            console.warn('[VOICE] 권한 상태 확인 실패:', error);
            return 'unknown';
        }
    }

    /**
     * 마이크 권한 요청
     */
    async requestMicrophonePermission() {
        try {
            console.log('[VOICE] 마이크 권한 요청 시작');
            
            // 사용자에게 권한 요청 안내
            this.showPermissionRequestMessage();
            
            // 권한 요청
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });
            
            // 권한 획득 성공 시 스트림 정리
            stream.getTracks().forEach(track => track.stop());
            
            console.log('[VOICE] 마이크 권한 획득 성공');
            this.showSuccessMessage('마이크 권한이 허용되었습니다! 이제 음성 입력을 사용할 수 있습니다.');
            
            // 권한 획득 후 녹음 시작
            setTimeout(() => {
                this.startRecording();
            }, 1000);
            
        } catch (error) {
            console.error('[VOICE] 마이크 권한 요청 실패:', error);
            this.showPermissionDeniedMessage();
        }
    }

    /**
     * 권한 요청 안내 메시지
     */
    showPermissionRequestMessage() {
        const message = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 400px;
                text-align: center;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">🎤</div>
                <h3 style="margin: 0 0 12px; color: #1f2937;">마이크 권한이 필요합니다</h3>
                <p style="margin: 0 0 20px; color: #6b7280; line-height: 1.5;">
                    음성 입력을 사용하려면 마이크 접근 권한이 필요합니다.<br>
                    브라우저에서 권한 요청 팝업이 나타나면 "허용"을 클릭해주세요.
                </p>
                <button onclick="this.parentElement.remove()" style="
                    background: linear-gradient(135deg, #ff4757, #ff3742);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                ">확인</button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', message);
    }

    /**
     * 권한 거부 안내 메시지
     */
    showPermissionDeniedMessage() {
        const message = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 400px;
                text-align: center;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <h3 style="margin: 0 0 12px; color: #1f2937;">마이크 권한이 거부되었습니다</h3>
                <p style="margin: 0 0 20px; color: #6b7280; line-height: 1.5;">
                    음성 입력을 사용하려면 브라우저 설정에서 마이크 권한을 허용해주세요.<br><br>
                    <strong>Chrome/Edge:</strong> 주소창 왼쪽 자물쇠 아이콘 클릭 → 마이크 허용<br>
                    <strong>Firefox:</strong> 주소창 왼쪽 자물쇠 아이콘 클릭 → 권한 허용
                </p>
                <button onclick="this.parentElement.remove()" style="
                    background: #6b7280;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                ">확인</button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', message);
    }

    /**
     * 성공 메시지 표시
     */
    showSuccessMessage(text) {
        const message = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                padding: 16px 20px;
                border-radius: 12px;
                box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
                z-index: 10000;
                max-width: 300px;
                animation: slideInRight 0.3s ease-out;
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="font-size: 20px;">✅</div>
                    <div>${text}</div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', message);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            const messageElement = document.querySelector('div[style*="slideInRight"]');
            if (messageElement) {
                messageElement.remove();
            }
        }, 3000);
    }



    /**
     * 음성 녹음 시작
     */
    async startRecording() {
        console.log('[VOICE] 음성 녹음 시작 시도');
        
        try {
            // 마이크 권한 요청
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });
            
            console.log('[VOICE] 마이크 권한 획득 성공');
            
            // MediaRecorder 설정
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];
            
            // 녹음 완료 시 처리
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                console.log('[VOICE] 녹음 완료');
                this.processAudio();
            };
            
            // 녹음 시작
            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateVoiceButton(true);
            this.showRecordingIndicator();
            
            console.log('[VOICE] 음성 녹음 시작됨');
            
        } catch (error) {
            console.error('[VOICE] 마이크 권한 실패:', error);
            alert('마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.');
        }
    }

    /**
     * 음성 녹음 중지
     */
    stopRecording() {
        console.log('[VOICE] 음성 녹음 중지');
        
        if (!this.isRecording || !this.mediaRecorder) {
            console.log('[VOICE] 녹음 중이 아님');
            return;
        }
        
        this.mediaRecorder.stop();
        this.isRecording = false;
        this.updateVoiceButton(false);
        this.hideRecordingIndicator();
        
        // 스트림 정리
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        console.log('[VOICE] 음성 녹음 중지 완료');
    }

    /**
     * 오디오 데이터 처리
     */
    async processAudio() {
        if (this.audioChunks.length === 0) {
            console.warn('[VOICE] 녹음된 오디오 데이터가 없습니다');
            return;
        }
        
        try {
            console.log('[VOICE] 음성 분석 시작...');
            
            // 오디오 블롭 생성
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            console.log('[VOICE] 오디오 블롭 생성 완료:', audioBlob.size, 'bytes');
            
            // FormData 생성
            const formData = new FormData();
            formData.append('audio', audioBlob, 'voice_input.webm');
            
            // 서버로 전송
            const response = await fetch(`${window.serverUrl || 'https://dys-phi.vercel.app/api/gke'}/api/voice/analyze`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`서버 응답 오류: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[VOICE] 서버 응답:', result);
            
            if (result.success && result.analysis) {
                this.displayVoiceAnalysis(result.analysis);
                this.showCompletionMessage();
            } else {
                throw new Error(result.error || '음성 분석 실패');
            }
            
        } catch (error) {
            console.error('[VOICE] 음성 분석 실패:', error);
            
            // 실패 시 간단한 텍스트 입력
            const fallbackText = "음성 입력 (분석 실패)";
            if (this.chatInput) {
                this.chatInput.value = fallbackText;
                this.chatInput.focus();
                
                setTimeout(() => {
                    if (window.sendMessage) {
                        window.sendMessage();
                    }
                }, 500);
            }
        }
    }

    /**
     * 음성 분석 결과 표시 및 피드백 업데이트
     */
    displayVoiceAnalysis(analysis) {
        console.log('[VOICE] 음성 분석 결과 처리:', analysis);
        
        // 1. 인식된 텍스트를 채팅 입력창에 설정
        const transcript = analysis.transcript || '음성 인식 실패';
        if (this.chatInput) {
            this.chatInput.value = transcript;
            this.chatInput.focus();
        }
        
        // 2. 음성 분석 결과를 피드백 패널에 반영
        this.updateVoiceFeedback(analysis);
        
        // 3. 자동으로 메시지 전송
        setTimeout(() => {
            if (window.sendMessage) {
                window.sendMessage();
            }
        }, 500);
        
        console.log('[VOICE] 음성 분석 결과 처리 완료');
    }

    /**
     * 음성 분석 결과를 피드백 패널에 반영
     */
    updateVoiceFeedback(analysis) {
        try {
            // 말투 점수 업데이트 (voice_tone_score 기반)
            const toneElement = document.getElementById('tone-score');
            if (toneElement && analysis.voice_tone_score !== undefined) {
                const toneScore = Math.round(analysis.voice_tone_score);
                toneElement.textContent = `${toneScore}%`;
                console.log('[VOICE] 말투 점수 업데이트:', toneScore);
            }
            
            // 음성 분석 결과를 꿀팁에 추가
            const tipsContainer = document.getElementById('ai-feedback-summary');
            if (tipsContainer && analysis) {
                const voiceTips = this.generateVoiceTips(analysis);
                
                // 기존 꿀팁과 음성 꿀팁 결합
                const existingTips = tipsContainer.querySelector('ol');
                if (existingTips && voiceTips.length > 0) {
                    voiceTips.forEach(tip => {
                        const li = document.createElement('li');
                        li.textContent = tip;
                        li.style.color = '#ff6b6b'; // 음성 분석 결과는 다른 색상으로 표시
                        existingTips.appendChild(li);
                    });
                }
            }
            
            console.log('[VOICE] 피드백 패널 업데이트 완료');
            
        } catch (error) {
            console.error('[VOICE] 피드백 패널 업데이트 실패:', error);
        }
    }

    /**
     * 음성 분석 결과 기반 꿀팁 생성
     */
    generateVoiceTips(analysis) {
        const tips = [];
        
        // 음성 톤 점수 기반 조언
        const voiceToneScore = analysis.voice_tone_score || 0;
        if (voiceToneScore < 60) {
            tips.push("🎵 목소리에 더 많은 감정을 담아보세요!");
        } else if (voiceToneScore < 80) {
            tips.push("🎵 목소리 톤이 좋아지고 있어요. 조금 더 자신감 있게!");
        }
        
        // 단어 선택 점수 기반 조언
        const wordChoiceScore = analysis.word_choice_score || 0;
        if (wordChoiceScore < 60) {
            tips.push("💬 더 긍정적인 표현을 사용해보세요!");
        }
        
        // 감정 분석 결과 기반 조언
        const emotion = analysis.emotion;
        const emotionScore = analysis.emotion_score || 0;
        
        if (emotion === '중립' && emotionScore > 0.7) {
            tips.push("😊 차분한 목소리가 좋아요. 조금 더 밝게 표현해보세요!");
        } else if (emotion === '기쁨' && emotionScore > 0.6) {
            tips.push("😄 밝은 목소리가 매력적이에요!");
        } else if (emotion === '슬픔' || emotion === '분노') {
            tips.push("😌 긍정적인 에너지를 담아 말해보세요!");
        }
        
        // 긍정/부정 단어 기반 조언
        if (analysis.positive_words && analysis.positive_words.length > 0) {
            tips.push(`✨ "${analysis.positive_words.join(', ')}" 같은 긍정적 표현이 좋아요!`);
        }
        
        if (analysis.negative_words && analysis.negative_words.length > 0) {
            tips.push("💡 더 긍정적인 단어로 표현해보시는 건 어떨까요?");
        }
        
        return tips.slice(0, 2); // 최대 2개까지만 표시
    }

    /**
     * 음성 입력 버튼 상태 업데이트
     */
    updateVoiceButton(isRecording) {
        console.log('[VOICE] 버튼 상태 업데이트:', isRecording ? '녹음 중' : '일반');
        
        if (!this.voiceInputBtn) return;
        
        if (isRecording) {
            // 녹음 중 스타일
            this.voiceInputBtn.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            this.voiceInputBtn.style.animation = 'pulse 1.5s infinite';
            this.voiceInputBtn.title = '녹음 중... (클릭하여 중지)';
            
            // 아이콘 변경
            const iconDiv = this.voiceInputBtn.querySelector('div:first-child');
            const textDiv = this.voiceInputBtn.querySelector('div:last-child');
            if (iconDiv) iconDiv.textContent = '⏹️';
            if (textDiv) textDiv.textContent = '중지';
        } else {
            // 일반 상태
            this.voiceInputBtn.style.background = 'linear-gradient(135deg, #ff4757, #ff3742)';
            this.voiceInputBtn.style.animation = '';
            this.voiceInputBtn.title = '음성으로 입력하기';
            
            // 아이콘 복원
            const iconDiv = this.voiceInputBtn.querySelector('div:first-child');
            const textDiv = this.voiceInputBtn.querySelector('div:last-child');
            if (iconDiv) iconDiv.textContent = '🎤';
            if (textDiv) textDiv.textContent = '음성 입력';
        }
    }

    /**
     * 음성 버튼 상태 업데이트 (강화된 시각적 피드백)
     */
    updateVoiceButton(isRecording) {
        if (!this.voiceInputBtn) return;
        
        if (isRecording) {
            this.voiceInputBtn.innerHTML = '⏹️<br><span style="font-size: 10px;">녹음중</span>';
            this.voiceInputBtn.style.background = 'linear-gradient(45deg, #e74c3c, #c0392b) !important';
            this.voiceInputBtn.style.animation = 'recordingPulse 0.8s infinite !important';
            this.voiceInputBtn.style.boxShadow = '0 0 30px rgba(231, 76, 60, 0.8), 0 0 60px rgba(231, 76, 60, 0.4) !important';
            this.voiceInputBtn.style.transform = 'translateX(-50%) scale(1.1) !important';
        } else {
            this.voiceInputBtn.innerHTML = '🎤<br><span style="font-size: 10px;">음성</span>';
            this.voiceInputBtn.style.background = 'linear-gradient(45deg, #ff4757, #ff3742) !important';
            this.voiceInputBtn.style.animation = 'readyPulse 3s infinite !important';
            this.voiceInputBtn.style.boxShadow = '0 8px 25px rgba(255, 71, 87, 0.5) !important';
            this.voiceInputBtn.style.transform = 'translateX(-50%) scale(1) !important';
        }
    }

    /**
     * 녹음 중 인디케이터 표시
     */
    showRecordingIndicator() {
        // 기존 인디케이터 제거
        const existing = document.getElementById('recording-indicator');
        if (existing) existing.remove();
        
        const indicator = document.createElement('div');
        indicator.id = 'recording-indicator';
        indicator.style.cssText = `
            position: fixed !important;
            bottom: 220px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 99998 !important;
            background: rgba(231, 76, 60, 0.95) !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 25px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            box-shadow: 0 8px 25px rgba(231, 76, 60, 0.4) !important;
            animation: fadeInUp 0.3s ease-out !important;
        `;
        indicator.innerHTML = '🔴 음성을 말씀해 주세요...';
        document.body.appendChild(indicator);
    }
    
    /**
     * 녹음 인디케이터 숨기기
     */
    hideRecordingIndicator() {
        const indicator = document.getElementById('recording-indicator');
        if (indicator) {
            indicator.style.animation = 'fadeOutDown 0.3s ease-out';
            setTimeout(() => indicator.remove(), 300);
        }
    }
    
    /**
     * 완료 메시지 표시
     */
    showCompletionMessage() {
        // 기존 메시지 제거
        const existing = document.getElementById('completion-message');
        if (existing) existing.remove();
        
        const message = document.createElement('div');
        message.id = 'completion-message';
        message.style.cssText = `
            position: fixed !important;
            bottom: 220px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 99998 !important;
            background: rgba(52, 152, 219, 0.95) !important;
            color: white !important;
            padding: 12px 20px !important;
            border-radius: 25px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            box-shadow: 0 8px 25px rgba(52, 152, 219, 0.4) !important;
            animation: fadeInUp 0.3s ease-out !important;
        `;
        message.innerHTML = '✅ 음성 처리 완료! 다시 클릭하여 계속 대화하세요';
        document.body.appendChild(message);
        
        // 3초 후 자동으로 숨기기
        setTimeout(() => {
            if (message.parentNode) {
                message.style.animation = 'fadeOutDown 0.3s ease-out';
                setTimeout(() => message.remove(), 300);
            }
        }, 3000);
    }

    /**
     * 리소스 정리
     */
    cleanup() {
        if (this.isRecording) {
            this.stopRecording();
        }
        this.hideRecordingIndicator();
        const completionMsg = document.getElementById('completion-message');
        if (completionMsg) completionMsg.remove();
        console.log('[VOICE] 정리 완료');
    }


}

// 전역 스코프에 노출
window.VoiceInputManager = VoiceInputManager;

console.log('[VOICE] 음성 입력 모듈 로드 완료');
