/**
 * ChatManager - Comprehensive Chat Management Module
 * 
 * Extracted from studio_calibration.html to manage:
 * - Chat UI interactions (bubbles, typing indicators)
 * - Session management (MongoDB)
 * - Persona card display
 * - AI feedback analysis
 * - Likability score updates
 * - STT integration for voice input
 */

(function () {
    class ChatManager {
        constructor(options = {}) {
            // DOM elements
            this.chatLog = options.chatLog || document.getElementById('chatLog');
            this.chatInput = options.chatInput || document.getElementById('chatInput');
            this.inputBtn = options.inputBtn || document.getElementById('inputBtn');
            
            // State management
            this.currentSessionId = null;
            this.chatHistory = [];
            this.isSending = false;
            
            // Server configuration
            this.serverUrl = window.serverUrl || 'https://dys-phi.vercel.app/api/gke';
            this.apiBase = (this.serverUrl && this.serverUrl.replace(/\/$/, '')) || 'https://dys-phi.vercel.app';
            
            // User data (from global scope)
            this.userId = window.userId;
            this.email = window.email;
            this.personaName = window.personaName;
            this.personaAge = window.personaAge;
            this.personaMbti = window.personaMbti;
            this.personaJob = window.personaJob;
            this.personaPersonality = window.personaPersonality;
            this.personaImage = window.personaImage;
            
            this.bindEvents();
            console.log('✅ [CHAT] ChatManager 초기화 완료');
        }

        // Session Management
        setSessionId(sessionId) {
            this.currentSessionId = sessionId;
            console.log('✅ [CHAT] 세션 ID 설정:', sessionId);
        }

        async createSession() {
            try {
                const sessionName = this.personaName ? `${this.personaName}와의 데이트` : '새로운 데이트';
                const requestBody = {
                    session_name: sessionName,
                    user_id: this.userId,
                    email: this.email,
                    persona_name: this.personaName,
                    persona_age: this.personaAge,
                    persona_mbti: this.personaMbti,
                    persona_job: this.personaJob,
                    persona_personality: this.personaPersonality,
                    persona_image: this.personaImage
                };
                
                console.log('🔄 [CHAT] 세션 생성 요청:', {
                    url: `${this.apiBase}/api/chat/sessions`,
                    body: requestBody
                });
                
                const response = await fetch(`${this.apiBase}/api/chat/sessions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                console.log('📋 [CHAT] 세션 생성 응답 상태:', response.status);
                
                if (response.ok) {
                    const result = await response.json();
                    this.currentSessionId = result.session_id;
                    console.log('✅ [CHAT] 세션 생성 성공:', this.currentSessionId);
                    console.log('📋 [CHAT] 세션 생성 응답:', result);
                    return true;
                } else {
                    const errorText = await response.text();
                    console.error('❌ [CHAT] 세션 생성 실패:', response.status, errorText);
                    return false;
                }
            } catch (error) {
                console.error('❌ [CHAT] 세션 생성 오류:', error);
                return false;
            }
        }

        // Event Binding
        bindEvents() {
            if (this.inputBtn) {
                this.inputBtn.addEventListener('click', () => {
                    const text = (this.chatInput?.value || '').trim();
                    if (text) this.sendMessage(text);
                });
            }
            
            if (this.chatInput) {
                this.chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const text = (this.chatInput?.value || '').trim();
                        if (text) this.sendMessage(text);
                    }
                });
                
                this.chatInput.addEventListener('input', (e) => {
                    // 입력 필드 변경 감지 (필요시 추가 로직)
                });
            }
        }

        // UI Management
        addPersonaCard() {
            if (!this.personaName) return;
            
            // 기존 persona 카드가 있으면 제거
            const existingCard = document.querySelector('.persona-card');
            if (existingCard) {
                existingCard.remove();
            }
            
            const personaCard = document.createElement('div');
            personaCard.className = 'persona-card';
            
            // 성별에 따른 클래스 추가 (이미지 파일명으로 판단)
            const imageFileName = this.personaImage ? this.personaImage.split('/').pop() : '';
            if (imageFileName.includes('woman') || imageFileName.includes('female')) {
                personaCard.classList.add('female');
            } else if (imageFileName.includes('man') || imageFileName.includes('male')) {
                personaCard.classList.add('male');
            }
            
            const personalityArray = this.personaPersonality ? this.personaPersonality.split(',') : [];
            
            // 이미지 경로 수정
            const imagePath = this.personaImage ? 
                `${this.apiBase}/dys_studio/img/persona/${this.personaImage.split('/').pop()}` : 
                '/img/default-avatar.png';
            
            personaCard.innerHTML = `
                <div class="persona-header">
                    <img src="${imagePath}" alt="${this.personaName}" class="persona-avatar">
                    <div class="persona-info">
                        <h4>${this.personaName}</h4>
                        <p>${this.personaAge}세 · ${this.personaJob}</p>
                    </div>
                </div>
                <div class="persona-details">
                    <span class="persona-tag">${this.personaMbti}</span>
                    ${personalityArray.map(trait => `<span class="persona-tag">${trait.trim()}</span>`).join('')}
                </div>
            `;
            
            // persona-info-section에 추가
            const personaSection = document.getElementById('personaInfoSection');
            if (personaSection) {
                personaSection.appendChild(personaCard);
            } else {
                // fallback: chat-log에 추가
                this.chatLog.appendChild(personaCard);
            }
        }

        addBubble(text, role) {
            const bubble = document.createElement('div');
            bubble.className = `bubble ${role}`;
            bubble.innerHTML = text;
            this.chatLog.appendChild(bubble);
            this.chatLog.scrollTop = this.chatLog.scrollHeight;
        }

        showTyping() {
            const typingBubble = document.createElement('div');
            typingBubble.className = 'bubble typing';
            typingBubble.innerHTML = '<span></span><span></span><span></span>';
            this.chatLog.appendChild(typingBubble);
            this.chatLog.scrollTop = this.chatLog.scrollHeight;
        }

        hideTyping() {
            const typing = this.chatLog.querySelector('.typing');
            if (typing) this.chatLog.removeChild(typing);
        }

        // STT Integration
        onSTTPartial(text) {
            // Optional: show partial transcription in the input without sending
            if (this.chatInput) this.chatInput.value = text;
        }

        async onSTTFinal(text) {
            // Final transcript: mirror to input and send
            if (this.chatInput) this.chatInput.value = text;
            const clean = (text || '').trim();
            if (!clean) return;
            await this.sendMessage(clean);
        }

        // Message Sending
        async sendMessage(text) {
            if (this.isSending) return;
            this.isSending = true;
            
            try {
                // 세션이 없으면 자동으로 생성
                if (!this.currentSessionId) {
                    console.log('🔄 [CHAT] 세션이 없어서 자동 생성 시도...');
                    const sessionCreated = await this.createSession();
                    if (!sessionCreated) {
                        throw new Error('세션 생성에 실패했습니다.');
                    }
                }
                
                // UI echo
                this.addBubble(text, 'me');
                this.chatHistory.push({ role: 'user', content: text });
                
                if (window.ConversationAnalyzer) {
                    window.ConversationAnalyzer.addMessage('user', text);
                }
                
                if (this.chatInput) {
                    this.chatInput.value = '';
                    this.chatInput.focus();
                }
                
                this.showTyping();

                // MongoDB API call with correct URL
                const url = `${this.apiBase}/api/chat/sessions/${this.currentSessionId}/messages`;
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: text,
                        role: 'user',
                        user_id: this.userId,
                        email: this.email
                    })
                });

                this.hideTyping();
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const result = await resp.json();

                if (result.ai_response) {
                    this.addBubble(result.ai_response, 'ai');
                    this.chatHistory.push({ role: 'assistant', content: result.ai_response });
                    
                    if (window.ConversationAnalyzer) {
                        window.ConversationAnalyzer.addMessage('assistant', result.ai_response);
                    }
                    
                    if (window.ttsManager && window.ttsManager.isEnabled) {
                        setTimeout(() => {
                            window.speakAIResponse && window.speakAIResponse(result.ai_response);
                        }, 500);
                    }
                }
            } catch (err) {
                console.error('[CHAT] sendMessage error:', err);
                this.hideTyping();
                const fallback = '죄송해요, 잠시 후 다시 시도해 주세요.';
                this.addBubble(fallback, 'ai');
                this.chatHistory.push({ role: 'assistant', content: fallback });
            } finally {
                this.isSending = false;
            }
        }

        // AI Feedback Analysis
        async runAiAnalysis() {
            const summaryDiv = document.getElementById('ai-feedback-summary');
            if (this.chatHistory.length < 2) {
                summaryDiv.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 8px;">🍯 실시간 꿀팁!</div>
                    <p style="font-size: 13px; line-height: 1.6;">AI와 대화를 2회 이상 나누면<br>자동으로 분석이 시작됩니다.</p>
                `;
                return;
            }

            summaryDiv.textContent = '분석 중...';
            
            try {
                const response = await fetch(`${this.apiBase}/api/feedback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        chatHistory: this.chatHistory,
                        user_id: this.userId,
                        session_id: this.currentSessionId
                    })
                });

                if (response.ok) {
                    const feedback = await response.json();
                    this.updateFeedbackUI(feedback);
                } else {
                    throw new Error(`피드백 분석 실패: ${response.status}`);
                }
            } catch (error) {
                console.error("Error analyzing conversation:", error);
                summaryDiv.textContent = "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
            }
        }

        updateFeedbackUI(feedback) {
            this.setCircleProgress(feedback.likability);
            
            // 대화 주도권 업데이트 (실제 분석 결과 사용)
            if (window.ConversationAnalyzer) {
                const initiativeAnalysis = window.ConversationAnalyzer.getDetailedAnalysis();
                document.getElementById('user-initiative-bar').style.width = `${initiativeAnalysis.userInitiativeScore}%`;
                document.getElementById('ai-initiative-bar').style.width = `${100 - initiativeAnalysis.userInitiativeScore}%`;
                document.getElementById('initiative-status').textContent = initiativeAnalysis.status;
                document.getElementById('initiative-status').style.color = initiativeAnalysis.color;
                
                if (window.ComprehensiveScoreCalculator) {
                    window.ComprehensiveScoreCalculator.updateConversationScore('initiative', initiativeAnalysis.userInitiativeScore);
                }
            } else {
                // 폴백: 서버 피드백 사용
                document.getElementById('user-initiative-bar').style.width = `${feedback.initiative}%`;
                document.getElementById('ai-initiative-bar').style.width = `${100 - feedback.initiative}%`;
                document.getElementById('initiative-status').textContent = '분석 대기 중';
                document.getElementById('initiative-status').style.color = '#6b7280';
                
                if (window.ComprehensiveScoreCalculator) {
                    window.ComprehensiveScoreCalculator.updateConversationScore('initiative', feedback.initiative);
                }
            }
            
            // 기타 점수 업데이트
            document.getElementById('expression-text').textContent = feedback.expression;
            document.getElementById('tone-score').textContent = `${feedback.tone}%`;
            document.getElementById('gaze-score').textContent = `${feedback.gaze_stability}%`;
            document.getElementById('concentration-score').textContent = `${feedback.concentration}%`;
            document.getElementById('posture-score').textContent = `${feedback.posture}%`;
            document.getElementById('blinking-score').textContent = `${feedback.blinking}%`;
            
            // 종합 점수 계산기에 각 점수 업데이트
            if (window.ComprehensiveScoreCalculator) {
                window.ComprehensiveScoreCalculator.updateVisualScore('expression', feedback.expression_score || 60);
                window.ComprehensiveScoreCalculator.updateVisualScore('gaze_stability', feedback.gaze_stability);
                window.ComprehensiveScoreCalculator.updateVisualScore('posture', feedback.posture);
                window.ComprehensiveScoreCalculator.updateVisualScore('blinking', feedback.blinking);
                window.ComprehensiveScoreCalculator.updateAuditoryScore('tone', feedback.tone);
                window.ComprehensiveScoreCalculator.updateAuditoryScore('concentration', feedback.concentration);
            }

            document.getElementById('ai-feedback-summary').textContent = feedback.summary;
        }

        setCircleProgress(score) {
            const circle = document.getElementById('likability-progress');
            if (!circle) return;
            
            const radius = circle.r.baseVal.value;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (score / 100) * circumference;

            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            circle.style.strokeDashoffset = offset;
            
            const scoreElement = document.getElementById('likability-score');
            if (scoreElement) {
                scoreElement.innerHTML = `${score}<span>%</span>`;
            }
        }

        // Likability Management
        updateLikability(score) {
            // 기존 호감도 (호환성 유지)
            const likabilityScore = document.getElementById('likability-score');
            const likabilityProgress = document.getElementById('likability-progress');
            
            if (likabilityScore) {
                likabilityScore.innerHTML = `${score}<span>%</span>`;
            }
            
            if (likabilityProgress) {
                const circumference = 2 * Math.PI * 54;
                const offset = circumference - (score / 100) * circumference;
                likabilityProgress.style.strokeDasharray = circumference;
                likabilityProgress.style.strokeDashoffset = offset;
            }
            
            // 새로운 개선된 호감도
            const likabilityScoreEnhanced = document.getElementById('likability-score-enhanced');
            const likabilityProgressEnhanced = document.getElementById('likability-progress-enhanced');
            const likabilityStatus = document.getElementById('likability-status');
            
            if (likabilityScoreEnhanced) {
                likabilityScoreEnhanced.innerHTML = `${score}<span class="score-unit">%</span>`;
            }
            
            if (likabilityProgressEnhanced) {
                const circumference = 314; // 2 * Math.PI * 50
                const offset = circumference - (score / 100) * circumference;
                likabilityProgressEnhanced.style.strokeDashoffset = offset;
            }
            
            if (likabilityStatus) {
                let status = '';
                if (score >= 85) status = '매우 높음';
                else if (score >= 70) status = '높음';
                else if (score >= 50) status = '보통';
                else if (score >= 30) status = '낮음';
                else status = '매우 낮음';
                
                likabilityStatus.textContent = status;
            }
            
            // 호감도 요소 업데이트
            this.updateLikabilityFactors(score);
        }

        updateLikabilityFactors(totalScore) {
            // 시뮬레이션된 요소별 점수 (실제로는 개별 메트릭에서 계산)
            const expressionScore = Math.max(0, totalScore + (Math.random() - 0.5) * 20);
            const voiceScore = Math.max(0, totalScore + (Math.random() - 0.5) * 15);
            const conversationScore = Math.max(0, totalScore + (Math.random() - 0.5) * 10);
            
            const factorExpression = document.getElementById('factor-expression');
            const factorVoice = document.getElementById('factor-voice');
            const factorConversation = document.getElementById('factor-conversation');
            
            if (factorExpression) factorExpression.textContent = `${Math.round(expressionScore)}%`;
            if (factorVoice) factorVoice.textContent = `${Math.round(voiceScore)}%`;
            if (factorConversation) factorConversation.textContent = `${Math.round(conversationScore)}%`;
        }

        // Cleanup
        cleanup() {
            // 세션 스토리지 정리
            sessionStorage.removeItem('currentSessionId');
            sessionStorage.removeItem('userData');
            console.log('🧹 [CHAT] ChatManager 정리 완료');
        }
    }

    // Expose globally
    window.ChatManager = ChatManager;
    
    // Legacy function compatibility
    window.sendMessage = function() {
        if (window.chatManager) {
            const text = (window.chatInput?.value || '').trim();
            if (!text) return;
            window.chatManager.sendMessage(text);
        }
    };
    
    window.updateLikability = function(score) {
        if (window.chatManager) {
            window.chatManager.updateLikability(score);
        }
    };
    
    window.updateLikabilityFactors = function(score) {
        if (window.chatManager) {
            window.chatManager.updateLikabilityFactors(score);
        }
    };
    
    console.log('✅ [CHAT] ChatManager 모듈 로드 완료');
})();
