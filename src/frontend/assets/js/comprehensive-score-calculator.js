/**
 * 종합 점수 계산 모듈
 * 시각적(55%), 청각적(38%), 대화(7%) 비율로 종합 점수를 계산합니다.
 */

class ComprehensiveScoreCalculator {
    constructor() {
        // 가중치 설정 (사용자 요청에 따라 수정: 55/38/7)
        this.weights = {
            visual: 0.55,      // 시각적 요소 55점 (55%)
            auditory: 0.38,    // 청각적 요소 38점 (38%)  
            conversation: 0.07 // 대화 요소 7점 (7%)
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
     * 모든 점수가 업데이트되었는지 확인
     */
    isAllScoresReady() {
        // 시각적 요소: 모든 4개 항목이 0이 아닌 값을 가져야 함
        const visualReady = Object.values(this.scores.visual).every(score => score > 0);
        
        // 청각적 요소: 모든 2개 항목이 0이 아닌 값을 가져야 함
        const auditoryReady = Object.values(this.scores.auditory).every(score => score > 0);
        
        // 대화 요소: 1개 항목이 0이 아닌 값을 가져야 함
        const conversationReady = this.scores.conversation.initiative > 0;
        
        const allReady = visualReady && auditoryReady && conversationReady;
        
        console.log(`[ScoreCalculator] 점수 준비 상태:`, {
            visual: { ready: visualReady, scores: this.scores.visual },
            auditory: { ready: auditoryReady, scores: this.scores.auditory },
            conversation: { ready: conversationReady, score: this.scores.conversation.initiative },
            allReady
        });
        
        return allReady;
    }

    /**
     * 종합 점수 계산
     */
    calculateComprehensiveScore() {
        // 모든 점수가 준비되지 않으면 계산하지 않음
        if (!this.isAllScoresReady()) {
            console.log('[ScoreCalculator] ⏳ 모든 점수가 준비되지 않음 - 종합 점수 계산 대기');
            this.hideComprehensiveScore();
            return;
        }
        
        // 시각적 점수 계산 (4개 항목 평균)
        const visualScores = Object.values(this.scores.visual);
        const visualAverage = visualScores.reduce((sum, score) => sum + score, 0) / visualScores.length;
        
        // 청각적 점수 계산 (2개 항목 평균)
        const auditoryScores = Object.values(this.scores.auditory);
        const auditoryAverage = auditoryScores.reduce((sum, score) => sum + score, 0) / auditoryScores.length;
        
        // 대화 점수 (1개 항목)
        const conversationScore = this.scores.conversation.initiative;
        
        // 가중 평균 계산 (55/38/7 비율)
        const visualContribution = visualAverage * this.weights.visual;      // 55점 만점
        const auditoryContribution = auditoryAverage * this.weights.auditory; // 38점 만점  
        const conversationContribution = conversationScore * this.weights.conversation; // 7점 만점
        
        this.comprehensiveScore = Math.round(
            visualContribution + auditoryContribution + conversationContribution
        );
        
        this.lastUpdateTime = Date.now();
        
        console.log(`[ScoreCalculator] ✅ 종합 점수 계산 완료:`, {
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
     * 종합 점수 수집 상태 표시
     */
    hideComprehensiveScore() {
        const totalScoreElement = document.getElementById('total-score');
        
        // 현재 수집된 데이터 확인
        const visualReady = this.updateStatus.expression && this.updateStatus.gaze_stability && 
                           this.updateStatus.posture && this.updateStatus.blinking;
        const auditoryReady = this.updateStatus.tone && this.updateStatus.concentration;
        const conversationReady = this.updateStatus.initiative;
        
        let statusText = '수집중';
        let statusDetails = [];
        
        if (!visualReady) statusDetails.push('시각화');
        if (!auditoryReady) statusDetails.push('청각');
        if (!conversationReady) statusDetails.push('대화');
        
        if (statusDetails.length > 0) {
            statusText = `수집중 (${statusDetails.join('/')})`;
        }
        
        if (totalScoreElement) {
            totalScoreElement.textContent = statusText;
            totalScoreElement.style.color = '#d97706'; // 주황색
            totalScoreElement.style.fontSize = '11px';
            totalScoreElement.style.opacity = '1';
        }
        
        // 종합 점수 행은 계속 표시 (숨기지 않음)
        const totalScoreRow = document.querySelector('.total-score-row');
        if (totalScoreRow) {
            totalScoreRow.style.opacity = '1';
            totalScoreRow.style.pointerEvents = 'auto';
        }
        
        console.log('[ScoreCalculator] 종합 점수 수집 상태 표시:', statusText);
    }
    
    /**
     * 종합 점수 표시
     */
    showComprehensiveScore() {
        const totalScoreElement = document.getElementById('total-score');
        if (totalScoreElement) {
            totalScoreElement.style.opacity = '1';
        }
        
        // 종합 점수 행 표시
        const totalScoreRow = document.querySelector('.total-score-row');
        if (totalScoreRow) {
            totalScoreRow.style.opacity = '1';
            totalScoreRow.style.pointerEvents = 'auto';
        }
    }

    /**
     * UI 업데이트
     */
    updateUI() {
        // 종합 점수 표시
        this.showComprehensiveScore();
        
        const totalScoreElement = document.getElementById('total-score');
        if (totalScoreElement) {
            totalScoreElement.textContent = `${this.comprehensiveScore}/100`;
            totalScoreElement.style.color = this.getScoreColor(this.comprehensiveScore);
            totalScoreElement.style.fontWeight = 'bold';
            totalScoreElement.style.fontSize = '14px';
            totalScoreElement.style.opacity = '1';
        }
        
        console.log(`[ScoreCalculator] ✅ UI 업데이트 완료: ${this.comprehensiveScore}%`);
        
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
