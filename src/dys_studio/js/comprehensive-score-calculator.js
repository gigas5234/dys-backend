/**
 * 종합 점수 계산 모듈
 * 시각적(55%), 청각적(38%), 대화(7%) 비율로 종합 점수를 계산합니다.
 */

class ComprehensiveScoreCalculator {
    constructor() {
        // 가중치 설정
        this.weights = {
            visual: 0.55,      // 시각적 요소 55%
            auditory: 0.38,    // 청각적 요소 38%
            conversation: 0.07 // 대화 요소 7%
        };
        
        // 각 카테고리별 점수
        this.scores = {
            visual: {
                expression: 0,      // 표정
                gaze_stability: 0,  // 시선 안정성
                posture: 0,         // 자세
                blinking: 0         // 깜빡임
            },
            auditory: {
                tone: 0,            // 음성 톤
                concentration: 0    // 집중도
            },
            conversation: {
                initiative: 0       // 대화 주도권
            }
        };
        
        // 점수 업데이트 상태
        this.updateStatus = {
            expression: false,
            gaze_stability: false,
            posture: false,
            blinking: false,
            tone: false,
            concentration: false,
            initiative: false
        };
        
        this.comprehensiveScore = 0;
        this.lastUpdateTime = 0;
    }

    /**
     * 시각적 점수 업데이트
     */
    updateVisualScore(type, score) {
        if (this.scores.visual.hasOwnProperty(type)) {
            this.scores.visual[type] = score;
            this.updateStatus[type] = true;
            console.log(`[ScoreCalculator] 시각적 점수 업데이트 - ${type}: ${score}%`);
            this.calculateComprehensiveScore();
        }
    }

    /**
     * 청각적 점수 업데이트
     */
    updateAuditoryScore(type, score) {
        if (this.scores.auditory.hasOwnProperty(type)) {
            this.scores.auditory[type] = score;
            this.updateStatus[type] = true;
            console.log(`[ScoreCalculator] 청각적 점수 업데이트 - ${type}: ${score}%`);
            this.calculateComprehensiveScore();
        }
    }

    /**
     * 대화 점수 업데이트
     */
    updateConversationScore(type, score) {
        if (this.scores.conversation.hasOwnProperty(type)) {
            this.scores.conversation[type] = score;
            this.updateStatus[type] = true;
            console.log(`[ScoreCalculator] 대화 점수 업데이트 - ${type}: ${score}%`);
            this.calculateComprehensiveScore();
        }
    }

    /**
     * 종합 점수 계산
     */
    calculateComprehensiveScore() {
        // 시각적 점수 계산 (4개 항목 평균)
        const visualScores = Object.values(this.scores.visual);
        const visualAverage = visualScores.reduce((sum, score) => sum + score, 0) / visualScores.length;
        
        // 청각적 점수 계산 (2개 항목 평균)
        const auditoryScores = Object.values(this.scores.auditory);
        const auditoryAverage = auditoryScores.reduce((sum, score) => sum + score, 0) / auditoryScores.length;
        
        // 대화 점수 (1개 항목)
        const conversationScore = this.scores.conversation.initiative;
        
        // 가중 평균 계산
        this.comprehensiveScore = Math.round(
            (visualAverage * this.weights.visual) +
            (auditoryAverage * this.weights.auditory) +
            (conversationScore * this.weights.conversation)
        );
        
        this.lastUpdateTime = Date.now();
        
        console.log(`[ScoreCalculator] 종합 점수 계산 완료:`, {
            visual: {
                average: visualAverage,
                weight: this.weights.visual,
                contribution: visualAverage * this.weights.visual
            },
            auditory: {
                average: auditoryAverage,
                weight: this.weights.auditory,
                contribution: auditoryAverage * this.weights.auditory
            },
            conversation: {
                score: conversationScore,
                weight: this.weights.conversation,
                contribution: conversationScore * this.weights.conversation
            },
            comprehensiveScore: this.comprehensiveScore
        });
        
        // UI 업데이트
        this.updateUI();
    }

    /**
     * UI 업데이트
     */
    updateUI() {
        // 종합 점수 표시
        const totalScoreElement = document.getElementById('total-score');
        if (totalScoreElement) {
            totalScoreElement.textContent = `${this.comprehensiveScore}%`;
        }
        
        // 상세 점수 표시 (옵션)
        this.updateDetailedScores();
    }

    /**
     * 상세 점수 표시 업데이트
     */
    updateDetailedScores() {
        // 시각적 점수
        const visualScores = Object.values(this.scores.visual);
        const visualAverage = visualScores.reduce((sum, score) => sum + score, 0) / visualScores.length;
        
        // 청각적 점수
        const auditoryScores = Object.values(this.scores.auditory);
        const auditoryAverage = auditoryScores.reduce((sum, score) => sum + score, 0) / auditoryScores.length;
        
        // 대화 점수
        const conversationScore = this.scores.conversation.initiative;
        
        // 콘솔에 상세 정보 출력 (디버깅용)
        console.log(`[ScoreCalculator] 상세 점수:`, {
            시각적: `${visualAverage.toFixed(1)}% (가중치: 55%)`,
            청각적: `${auditoryAverage.toFixed(1)}% (가중치: 38%)`,
            대화: `${conversationScore.toFixed(1)}% (가중치: 7%)`,
            종합: `${this.comprehensiveScore}%`
        });
    }

    /**
     * 모든 점수 초기화
     */
    resetAllScores() {
        // 점수 초기화
        Object.keys(this.scores.visual).forEach(key => {
            this.scores.visual[key] = 0;
        });
        Object.keys(this.scores.auditory).forEach(key => {
            this.scores.auditory[key] = 0;
        });
        Object.keys(this.scores.conversation).forEach(key => {
            this.scores.conversation[key] = 0;
        });
        
        // 상태 초기화
        Object.keys(this.updateStatus).forEach(key => {
            this.updateStatus[key] = false;
        });
        
        this.comprehensiveScore = 0;
        this.lastUpdateTime = 0;
        
        console.log('[ScoreCalculator] 모든 점수 초기화 완료');
        this.updateUI();
    }

    /**
     * 현재 종합 점수 반환
     */
    getComprehensiveScore() {
        return this.comprehensiveScore;
    }

    /**
     * 상세 분석 결과 반환
     */
    getDetailedAnalysis() {
        const visualScores = Object.values(this.scores.visual);
        const visualAverage = visualScores.reduce((sum, score) => sum + score, 0) / visualScores.length;
        
        const auditoryScores = Object.values(this.scores.auditory);
        const auditoryAverage = auditoryScores.reduce((sum, score) => sum + score, 0) / auditoryScores.length;
        
        const conversationScore = this.scores.conversation.initiative;
        
        return {
            comprehensiveScore: this.comprehensiveScore,
            categories: {
                visual: {
                    average: visualAverage,
                    weight: this.weights.visual,
                    contribution: visualAverage * this.weights.visual,
                    scores: this.scores.visual
                },
                auditory: {
                    average: auditoryAverage,
                    weight: this.weights.auditory,
                    contribution: auditoryAverage * this.weights.auditory,
                    scores: this.scores.auditory
                },
                conversation: {
                    score: conversationScore,
                    weight: this.weights.conversation,
                    contribution: conversationScore * this.weights.conversation,
                    scores: this.scores.conversation
                }
            },
            updateStatus: this.updateStatus,
            lastUpdateTime: this.lastUpdateTime
        };
    }

    /**
     * 점수 상태 확인
     */
    getScoreStatus() {
        const allUpdated = Object.values(this.updateStatus).every(status => status === true);
        return {
            allUpdated,
            updatedCount: Object.values(this.updateStatus).filter(status => status === true).length,
            totalCount: Object.keys(this.updateStatus).length
        };
    }
}

// 전역 인스턴스 생성
window.ComprehensiveScoreCalculator = new ComprehensiveScoreCalculator();
