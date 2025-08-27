/**
 * 대화 주도권 분석 모듈
 * 사용자와 AI의 대화 패턴을 분석하여 주도권 점수를 계산합니다.
 */

class ConversationAnalyzer {
    constructor() {
        this.chatHistory = [];
        this.userMessageCount = 0;
        this.aiMessageCount = 0;
        this.userTotalLength = 0;
        this.aiTotalLength = 0;
        this.userQuestionCount = 0;
        this.aiQuestionCount = 0;
        this.userInitiativeScore = 50; // 기본값 50%
    }

    /**
     * 대화 히스토리 업데이트
     */
    updateChatHistory(chatHistory) {
        this.chatHistory = chatHistory;
        this.analyzeConversation();
    }

    /**
     * 새로운 메시지 추가
     */
    addMessage(role, content) {
        this.chatHistory.push({ role, content });
        this.analyzeConversation();
    }

    /**
     * 대화 분석 및 주도권 점수 계산
     */
    analyzeConversation() {
        if (this.chatHistory.length === 0) {
            this.userInitiativeScore = 50;
            return;
        }

        // 기본 통계 계산
        this.calculateBasicStats();
        
        // 주도권 점수 계산
        this.calculateInitiativeScore();
        
        console.log('[ConversationAnalyzer] 대화 분석 완료:', {
            userMessageCount: this.userMessageCount,
            aiMessageCount: this.aiMessageCount,
            userTotalLength: this.userTotalLength,
            aiTotalLength: this.aiTotalLength,
            userQuestionCount: this.userQuestionCount,
            aiQuestionCount: this.aiQuestionCount,
            userInitiativeScore: this.userInitiativeScore
        });
    }

    /**
     * 기본 통계 계산
     */
    calculateBasicStats() {
        this.userMessageCount = 0;
        this.aiMessageCount = 0;
        this.userTotalLength = 0;
        this.aiTotalLength = 0;
        this.userQuestionCount = 0;
        this.aiQuestionCount = 0;

        this.chatHistory.forEach(message => {
            const content = message.content;
            const length = content.length;
            const questionCount = this.countQuestions(content);

            if (message.role === 'user') {
                this.userMessageCount++;
                this.userTotalLength += length;
                this.userQuestionCount += questionCount;
            } else if (message.role === 'assistant') {
                this.aiMessageCount++;
                this.aiTotalLength += length;
                this.aiQuestionCount += questionCount;
            }
        });
    }

    /**
     * 질문 개수 계산
     */
    countQuestions(text) {
        const questionPatterns = [
            /\?/g,           // 물음표
            /[?？]/g,        // 전각 물음표
            /(어떻게|무엇|언제|어디서|왜|누가|어떤|얼마나|몇|어떠한)/g,  // 질문어
            /(인가요|인가\?|일까요|일까\?|겠어요|겠어\?)/g  // 질문 어미
        ];
        
        let count = 0;
        questionPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) count += matches.length;
        });
        
        return count;
    }

    /**
     * 주도권 점수 계산
     */
    calculateInitiativeScore() {
        if (this.userMessageCount === 0 && this.aiMessageCount === 0) {
            this.userInitiativeScore = 50;
            return;
        }

        let score = 50; // 기본값

        // 1. 메시지 수 비율 (30% 가중치)
        const totalMessages = this.userMessageCount + this.aiMessageCount;
        const messageRatio = totalMessages > 0 ? (this.userMessageCount / totalMessages) * 100 : 50;
        score += (messageRatio - 50) * 0.3;

        // 2. 메시지 길이 비율 (25% 가중치)
        const totalLength = this.userTotalLength + this.aiTotalLength;
        const lengthRatio = totalLength > 0 ? (this.userTotalLength / totalLength) * 100 : 50;
        score += (lengthRatio - 50) * 0.25;

        // 3. 질문 비율 (25% 가중치)
        const totalQuestions = this.userQuestionCount + this.aiQuestionCount;
        const questionRatio = totalQuestions > 0 ? (this.userQuestionCount / totalQuestions) * 100 : 50;
        score += (questionRatio - 50) * 0.25;

        // 4. 대화 시작 패턴 (20% 가중치)
        const conversationStartBonus = this.analyzeConversationStart();
        score += conversationStartBonus * 0.2;

        // 점수 범위 제한 (0-100)
        this.userInitiativeScore = Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * 대화 시작 패턴 분석
     */
    analyzeConversationStart() {
        if (this.chatHistory.length === 0) return 0;

        const firstMessage = this.chatHistory[0];
        let bonus = 0;

        if (firstMessage.role === 'user') {
            // 사용자가 먼저 대화를 시작한 경우 보너스
            bonus += 10;
            
            // 첫 메시지가 질문인 경우 추가 보너스
            if (this.countQuestions(firstMessage.content) > 0) {
                bonus += 5;
            }
        } else if (firstMessage.role === 'assistant') {
            // AI가 먼저 대화를 시작한 경우 페널티
            bonus -= 10;
        }

        return bonus;
    }

    /**
     * 현재 주도권 점수 반환
     */
    getInitiativeScore() {
        return this.userInitiativeScore;
    }

    /**
     * 주도권 상태 텍스트 반환
     */
    getInitiativeStatus() {
        const score = this.userInitiativeScore;
        
        if (score >= 80) return "매우 적극적";
        if (score >= 65) return "적극적";
        if (score >= 45) return "균형적";
        if (score >= 30) return "소극적";
        return "매우 소극적";
    }

    /**
     * 주도권 상태 색상 반환
     */
    getInitiativeColor() {
        const score = this.userInitiativeScore;
        
        if (score >= 80) return "#10b981"; // 초록색
        if (score >= 65) return "#3b82f6"; // 파란색
        if (score >= 45) return "#f59e0b"; // 주황색
        if (score >= 30) return "#ef4444"; // 빨간색
        return "#6b7280"; // 회색
    }

    /**
     * 상세 분석 결과 반환
     */
    getDetailedAnalysis() {
        return {
            userInitiativeScore: this.userInitiativeScore,
            status: this.getInitiativeStatus(),
            color: this.getInitiativeColor(),
            stats: {
                userMessageCount: this.userMessageCount,
                aiMessageCount: this.aiMessageCount,
                userTotalLength: this.userTotalLength,
                aiTotalLength: this.aiTotalLength,
                userQuestionCount: this.userQuestionCount,
                aiQuestionCount: this.aiQuestionCount,
                messageRatio: this.userMessageCount + this.aiMessageCount > 0 ? 
                    Math.round((this.userMessageCount / (this.userMessageCount + this.aiMessageCount)) * 100) : 50,
                lengthRatio: this.userTotalLength + this.aiTotalLength > 0 ? 
                    Math.round((this.userTotalLength / (this.userTotalLength + this.aiTotalLength)) * 100) : 50,
                questionRatio: this.userQuestionCount + this.aiQuestionCount > 0 ? 
                    Math.round((this.userQuestionCount / (this.userQuestionCount + this.aiQuestionCount)) * 100) : 50
            }
        };
    }
}

// 전역 인스턴스 생성
window.ConversationAnalyzer = new ConversationAnalyzer();
