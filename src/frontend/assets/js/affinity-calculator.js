/**
 * 호감도 계산기 (Affinity Calculator)
 * 대화, 표정, 자세를 기반으로 호감도를 계산하고 관리
 */
class AffinityCalculator {
    constructor() {
        // 호감도 기본 설정
        this.baseScore = 50;           // 기본 호감도 50점
        this.currentScore = 50;        // 현재 호감도
        this.maxScore = 100;           // 최대 호감도
        this.minScore = 0;             // 최소 호감도
        
        // 호감도 증가 요소들
        this.conversationBonus = 0;    // 대화 지속 보너스
        this.expressionBonus = 0;      // 표정 보너스
        this.postureBonus = 0;         // 자세 보너스
        this.gazeBonus = 0;           // 시선 보너스
        
        // 대화 관련 변수
        this.conversationCount = 0;    // 대화 횟수
        this.positiveWords = 0;        // 긍정적 단어 수
        this.conversationDuration = 0; // 대화 지속 시간 (분)
        
        // 표정/자세 관련 변수
        this.goodExpressionStreak = 0; // 좋은 표정 연속 횟수
        this.goodPostureStreak = 0;    // 좋은 자세 연속 횟수
        this.goodGazeStreak = 0;       // 좋은 시선 연속 횟수
        
        // 애니메이션 상태
        this.isAnimating = false;
        this.lastBoostTime = 0;
        
        // 호감도 레벨 정의
        this.levels = {
            0: { name: "차갑다", color: "#2196F3", icon: "❄️" },
            20: { name: "무관심", color: "#607D8B", icon: "😐" },
            40: { name: "보통", color: "#FF9800", icon: "😊" },
            60: { name: "호감", color: "#4CAF50", icon: "😍" },
            80: { name: "매력적", color: "#E91E63", icon: "💕" },
            95: { name: "완벽", color: "#9C27B0", icon: "✨" }
        };
        
        console.log("🎯 [호감도] AffinityCalculator 초기화 완료");
    }
    
    /**
     * 대화 기반 호감도 업데이트
     */
    updateConversationAffinity(messageData) {
        try {
            this.conversationCount++;
            
            // 대화 지속 보너스 (최대 5점) - 대폭 감소
            const conversationBonus = Math.min(this.conversationCount * 0.1, 5);
            
            // 긍정적 단어 감지 (간단한 키워드 기반) - 점수 감소
            const positiveKeywords = ['좋다', '감사', '고마워', '훌륭', '멋지다', '예쁘다', '좋아요', '최고', '완벽'];
            const message = messageData.message || '';
            
            let positiveBonus = 0;
            positiveKeywords.forEach(keyword => {
                if (message.includes(keyword)) {
                    this.positiveWords++;
                    positiveBonus += 0.5; // 2점 → 0.5점으로 대폭 감소
                }
            });
            
            // 대화 길이 보너스 - 거의 없애기
            const lengthBonus = Math.min(message.length * 0.002, 0.5);
            
            this.conversationBonus = conversationBonus + Math.min(positiveBonus, 3) + lengthBonus;
            
            console.log(`💬 [호감도] 대화 업데이트: +${this.conversationBonus.toFixed(1)}점 (총 ${this.conversationCount}회)`);
            
            this.calculateTotalAffinity();
            this.triggerAffinityBoost("conversation");
            
        } catch (error) {
            console.warn("⚠️ [호감도] 대화 업데이트 실패:", error);
        }
    }
    
    /**
     * 표정 기반 호감도 업데이트
     */
    updateExpressionAffinity(expressionScore) {
        try {
            if (expressionScore >= 75) { // 70 → 75로 기준 상승
                this.goodExpressionStreak++;
                
                // 연속 좋은 표정 보너스 (최대 3점) - 대폭 감소
                const streakBonus = Math.min(this.goodExpressionStreak * 0.05, 3);
                this.expressionBonus = streakBonus;
                
                // 15회 연속 좋은 표정시 특별 보너스 - 조건 강화
                if (this.goodExpressionStreak % 15 === 0) {
                    this.triggerAffinityBoost("expression", 1); // 3점 → 1점
                    console.log(`😊 [호감도] 표정 연속 보너스! ${this.goodExpressionStreak}회 연속`);
                }
            } else {
                this.goodExpressionStreak = Math.max(0, this.goodExpressionStreak - 1);
                this.expressionBonus = Math.max(0, this.expressionBonus - 0.02); // 감소 속도도 줄임
            }
            
            this.calculateTotalAffinity();
            
        } catch (error) {
            console.warn("⚠️ [호감도] 표정 업데이트 실패:", error);
        }
    }
    
    /**
     * 자세 기반 호감도 업데이트
     */
    updatePostureAffinity(postureScore) {
        try {
            if (postureScore >= 80) { // 75 → 80으로 기준 상승
                this.goodPostureStreak++;
                
                // 연속 좋은 자세 보너스 (최대 2점) - 대폭 감소
                const streakBonus = Math.min(this.goodPostureStreak * 0.03, 2);
                this.postureBonus = streakBonus;
                
                // 25회 연속 좋은 자세시 특별 보너스 - 조건 강화
                if (this.goodPostureStreak % 25 === 0) {
                    this.triggerAffinityBoost("posture", 0.5); // 2점 → 0.5점
                    console.log(`🧍 [호감도] 자세 연속 보너스! ${this.goodPostureStreak}회 연속`);
                }
            } else {
                this.goodPostureStreak = Math.max(0, this.goodPostureStreak - 1);
                this.postureBonus = Math.max(0, this.postureBonus - 0.01); // 감소 속도 줄임
            }
            
            this.calculateTotalAffinity();
            
        } catch (error) {
            console.warn("⚠️ [호감도] 자세 업데이트 실패:", error);
        }
    }
    
    /**
     * 시선 기반 호감도 업데이트
     */
    updateGazeAffinity(gazeScore) {
        try {
            if (gazeScore >= 85) { // 80 → 85로 기준 상승
                this.goodGazeStreak++;
                
                // 연속 좋은 시선 보너스 (최대 2점) - 대폭 감소
                const streakBonus = Math.min(this.goodGazeStreak * 0.02, 2);
                this.gazeBonus = streakBonus;
                
                // 30회 연속 좋은 시선시 특별 보너스 - 조건 강화
                if (this.goodGazeStreak % 30 === 0) {
                    this.triggerAffinityBoost("gaze", 0.5); // 2점 → 0.5점
                    console.log(`👁️ [호감도] 시선 연속 보너스! ${this.goodGazeStreak}회 연속`);
                }
            } else {
                this.goodGazeStreak = Math.max(0, this.goodGazeStreak - 1);
                this.gazeBonus = Math.max(0, this.gazeBonus - 0.005); // 감소 속도 줄임
            }
            
            this.calculateTotalAffinity();
            
        } catch (error) {
            console.warn("⚠️ [호감도] 시선 업데이트 실패:", error);
        }
    }
    
    /**
     * 총 호감도 계산
     */
    calculateTotalAffinity() {
        try {
            const totalBonus = this.conversationBonus + this.expressionBonus + this.postureBonus + this.gazeBonus;
            this.currentScore = Math.min(this.maxScore, Math.max(this.minScore, this.baseScore + totalBonus));
            
            // UI 업데이트
            this.updateAffinityUI();
            
            console.log(`💖 [호감도] 총점: ${this.currentScore.toFixed(1)}/100 (대화:${this.conversationBonus.toFixed(1)} 표정:${this.expressionBonus.toFixed(1)} 자세:${this.postureBonus.toFixed(1)} 시선:${this.gazeBonus.toFixed(1)})`);
            
        } catch (error) {
            console.warn("⚠️ [호감도] 계산 실패:", error);
        }
    }
    
    /**
     * 호감도 부스트 애니메이션 트리거
     */
    triggerAffinityBoost(type, extraPoints = 0) {
        try {
            const now = Date.now();
            if (now - this.lastBoostTime < 1000 || this.isAnimating) return; // 1초 쿨다운
            
            this.lastBoostTime = now;
            this.isAnimating = true;
            
            if (extraPoints > 0) {
                this.currentScore = Math.min(this.maxScore, this.currentScore + extraPoints);
            }
            
            // 아이콘 애니메이션
            this.animateAffinityIcon(type);
            
            setTimeout(() => {
                this.isAnimating = false;
            }, 2000);
            
        } catch (error) {
            console.warn("⚠️ [호감도] 부스트 애니메이션 실패:", error);
        }
    }
    
    /**
     * 호감도 아이콘 애니메이션
     */
    animateAffinityIcon(type) {
        try {
            const iconElement = document.querySelector('.likability-icon');
            if (!iconElement) return;
            
            // 타입별 이모지
            const typeEmojis = {
                conversation: '💬',
                expression: '😊',
                posture: '🧍',
                gaze: '👁️'
            };
            
            // 원래 아이콘 저장
            const originalIcon = iconElement.textContent;
            
            // 애니메이션 시작
            iconElement.style.transform = 'scale(1.3)';
            iconElement.style.transition = 'transform 0.3s ease';
            iconElement.textContent = typeEmojis[type] || '💖';
            
            setTimeout(() => {
                iconElement.style.transform = 'scale(1)';
                setTimeout(() => {
                    iconElement.textContent = this.getCurrentLevelIcon();
                    iconElement.style.transition = '';
                }, 300);
            }, 300);
            
        } catch (error) {
            console.warn("⚠️ [호감도] 아이콘 애니메이션 실패:", error);
        }
    }
    
    /**
     * 현재 호감도 레벨 정보 반환
     */
    getCurrentLevel() {
        const score = this.currentScore;
        let currentLevel = this.levels[0];
        
        Object.keys(this.levels).forEach(threshold => {
            if (score >= parseInt(threshold)) {
                currentLevel = this.levels[threshold];
            }
        });
        
        return currentLevel;
    }
    
    /**
     * 현재 레벨 아이콘 반환
     */
    getCurrentLevelIcon() {
        return this.getCurrentLevel().icon;
    }
    
    /**
     * 호감도 UI 업데이트
     */
    updateAffinityUI() {
        try {
            const currentLevel = this.getCurrentLevel();
            
            // 기존 호감도 시스템 업데이트
            if (window.chatManager && window.chatManager.updateLikability) {
                window.chatManager.updateLikability(Math.round(this.currentScore));
            }
            
            // 호감도 점수 업데이트
            const scoreElements = [
                document.getElementById('likability-score'),
                document.getElementById('likability-score-enhanced')
            ];
            
            scoreElements.forEach(element => {
                if (element) {
                    element.innerHTML = `${Math.round(this.currentScore)}<span class="score-unit">%</span>`;
                }
            });
            
            // 호감도 상태 업데이트
            const statusElement = document.getElementById('likability-status');
            if (statusElement) {
                statusElement.textContent = currentLevel.name;
                statusElement.style.color = currentLevel.color;
            }
            
            // 호감도 아이콘 업데이트
            const iconElement = document.querySelector('.likability-icon');
            if (iconElement && !this.isAnimating) {
                iconElement.textContent = currentLevel.icon;
            }
            
            // 원형 진행바 업데이트
            const progressElements = [
                document.getElementById('likability-progress'),
                document.getElementById('likability-progress-enhanced')
            ];
            
            progressElements.forEach(element => {
                if (element) {
                    const radius = 45;
                    const circumference = 2 * Math.PI * radius;
                    const offset = circumference - (this.currentScore / 100) * circumference;
                    
                    element.style.strokeDasharray = circumference;
                    element.style.strokeDashoffset = offset;
                    element.style.stroke = currentLevel.color;
                }
            });
            
        } catch (error) {
            console.warn("⚠️ [호감도] UI 업데이트 실패:", error);
        }
    }
    
    /**
     * 호감도 상세 정보 반환
     */
    getDetailedInfo() {
        return {
            currentScore: this.currentScore,
            level: this.getCurrentLevel(),
            bonuses: {
                conversation: this.conversationBonus,
                expression: this.expressionBonus,
                posture: this.postureBonus,
                gaze: this.gazeBonus
            },
            streaks: {
                conversation: this.conversationCount,
                expression: this.goodExpressionStreak,
                posture: this.goodPostureStreak,
                gaze: this.goodGazeStreak
            },
            stats: {
                positiveWords: this.positiveWords,
                conversationDuration: this.conversationDuration
            }
        };
    }
    
    /**
     * 호감도 초기화
     */
    reset() {
        this.currentScore = this.baseScore;
        this.conversationBonus = 0;
        this.expressionBonus = 0;
        this.postureBonus = 0;
        this.gazeBonus = 0;
        this.conversationCount = 0;
        this.positiveWords = 0;
        this.goodExpressionStreak = 0;
        this.goodPostureStreak = 0;
        this.goodGazeStreak = 0;
        
        this.updateAffinityUI();
        console.log("🔄 [호감도] 시스템 초기화 완료");
    }
}

// 전역 인스턴스 생성
window.AffinityCalculator = new AffinityCalculator();

// 전역 함수 (호환성)
window.updateAffinity = function(type, data) {
    if (window.AffinityCalculator) {
        switch(type) {
            case 'conversation':
                window.AffinityCalculator.updateConversationAffinity(data);
                break;
            case 'expression':
                window.AffinityCalculator.updateExpressionAffinity(data);
                break;
            case 'posture':
                window.AffinityCalculator.updatePostureAffinity(data);
                break;
            case 'gaze':
                window.AffinityCalculator.updateGazeAffinity(data);
                break;
        }
    }
};

console.log("✅ [호감도] AffinityCalculator 모듈 로드 완료");
