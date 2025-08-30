/**
 * 팝업 관리자 모듈
 * 모든 상세 정보 팝업의 관리와 데이터 처리를 담당
 */

// 전역 데이터 변수들 (UI-only mode)
let currentExpressionData = null;
// MediaPipe-related data variables removed for UI-only mode

// ===== 표정 상세 정보 팝업 =====
function showExpressionDetails() {
    const popup = document.getElementById('expression-details-popup');
    if (popup) {
        popup.classList.add('active');
        
        // MediaPipe 데이터로 업데이트
        if (window.mediaPipeAnalyzer) {
            window.mediaPipeAnalyzer.updateExpressionPopupOnOpen();
        }
        
        updateExpressionPopupContent();
    }
}

function closeExpressionDetails() {
    const popup = document.getElementById('expression-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateExpressionPopupContent() {
    // MediaPipe 데이터가 있으면 사용, 없으면 기본 데이터 생성
    let expressionData = window.currentExpressionData || currentExpressionData;
    
    // MediaPipe 데이터가 없으면 현재 점수로 생성
    if (!expressionData && window.mediaPipeAnalyzer) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores || {};
        const expressionScore = currentScores.expression || 0;
        
        // 기본 표정 데이터 생성
        expressionData = {
            expression: 'neutral',
            confidence: expressionScore / 100,
            score: {
                score: expressionScore,
                label: getScoreLabel(expressionScore)
            },
            probabilities: {
                happy: Math.max(0, expressionScore - 20),
                sad: Math.max(0, 100 - expressionScore - 20),
                angry: Math.max(0, 50 - Math.abs(expressionScore - 50)),
                surprised: Math.max(0, 30 - Math.abs(expressionScore - 70)),
                fearful: Math.max(0, 20 - Math.abs(expressionScore - 30)),
                disgusted: Math.max(0, 15 - Math.abs(expressionScore - 40)),
                neutral: Math.max(0, 100 - Math.abs(expressionScore - 50)),
                contempt: Math.max(0, 10 - Math.abs(expressionScore - 20))
            },
            lastUpdate: new Date().toISOString()
        };
        
        // 전역 변수에 저장
        window.currentExpressionData = expressionData;
    }
    
    if (!expressionData) {
        document.getElementById('expression-main-value').textContent = '데이터 없음';
        document.getElementById('expression-confidence-value').textContent = '0%';
        document.getElementById('expression-probabilities').innerHTML = '<div class="no-data">표정 분석 데이터가 없습니다.</div>';
        document.getElementById('expression-explanation-text').innerHTML = '표정 분석 데이터가 없습니다.';
        return;
    }
    
    // 주요 정보 업데이트
    const expression = expressionData.expression;
    const confidence = expressionData.confidence;
    document.getElementById('expression-main-value').textContent = getExpressionKoreanName(expression);
    // 신뢰도: 0.xxx (xx.x%) 형식으로 표시 (0-1 범위로 정규화)
    let normalizedConfidence = confidence;
    if (typeof confidence === 'number') {
        // 0-100 범위인 경우 0-1로 정규화
        if (confidence > 1) {
            normalizedConfidence = confidence / 100;
        }
    } else {
        normalizedConfidence = 0;
    }
    
    const decimalText = normalizedConfidence.toFixed(3);
    const percentText = (normalizedConfidence * 100).toFixed(1) + '%';
    document.getElementById('expression-confidence-value').textContent = `${decimalText} (${percentText})`;
    
    // 확률 정보 업데이트
    updateExpressionProbabilities();
    
    // 설명 업데이트
    document.getElementById('expression-explanation-text').innerHTML = generateExpressionExplanation();
}

function updateExpressionProbabilities() {
    const probabilitiesDiv = document.getElementById('expression-probabilities');
    
    // 전역 변수에서 표정 데이터 가져오기
    const expressionData = window.currentExpressionData || currentExpressionData;
    
    if (!expressionData?.probabilities) {
        probabilitiesDiv.innerHTML = '<div class="no-data">확률 데이터가 없습니다.</div>';
        return;
    }
    
    const probabilities = expressionData.probabilities;
    let html = '';
    
    Object.entries(probabilities).forEach(([expression, probability]) => {
        const koreanName = getExpressionKoreanName(expression);
        // 확률값 정규화 (0-1 범위로)
        let normalizedProbability = probability;
        if (typeof probability === 'number' && probability > 1) {
            normalizedProbability = probability / 100;
        }
        const percentage = (normalizedProbability * 100).toFixed(1);
        const isHighest = normalizedProbability === Math.max(...Object.values(probabilities).map(p => p > 1 ? p / 100 : p));
        
        html += `
            <div class="probability-item ${isHighest ? 'highest' : ''}">
                <div class="probability-label">${koreanName}</div>
                <div class="probability-value">${percentage}%</div>
            </div>
        `;
    });
    
    probabilitiesDiv.innerHTML = html;
}

function getExpressionKoreanName(expression) {
    const koreanNames = {
        'happy': '웃음',
        'sad': '슬픔',
        'angry': '화남',
        'surprised': '놀람',
        'fearful': '두려움',
        'disgusted': '혐오',
        'neutral': '중립',
        'contempt': '경멸'
    };
    return koreanNames[expression] || expression;
}

function getScoreLabel(score) {
    if (score >= 85) return '매우 좋음';
    if (score >= 70) return '좋음';
    if (score >= 50) return '보통';
    if (score >= 30) return '나쁨';
    return '매우 나쁨';
}

function generateExpressionExplanation() {
    // 전역 변수에서 표정 데이터 가져오기
    const expressionData = window.currentExpressionData || currentExpressionData;
    
    if (!expressionData) {
        return '표정 분석 데이터가 없습니다.';
    }
    
    const { expression, confidence, score } = expressionData;
    const koreanExpression = getExpressionKoreanName(expression);
    
    // 신뢰도 정규화
    let normalizedConfidence = confidence;
    if (typeof confidence === 'number' && confidence > 1) {
        normalizedConfidence = confidence / 100;
    }
    
    let explanation = `<div class="explanation-section">`;
    explanation += `<h4>📈 현재 분석 결과</h4>`;
    explanation += `<ul>`;
    explanation += `<li><strong>감지된 표정</strong>: ${koreanExpression}</li>`;
    explanation += `<li><strong>신뢰도</strong>: ${(normalizedConfidence * 100).toFixed(1)}%</li>`;
    explanation += `<li><strong>최종 점수</strong>: ${score.score}점</li>`;
    explanation += `<li><strong>평가</strong>: ${score.label}</li>`;
    explanation += `</ul>`;
    
    // 점수 해석
    if (score.score >= 85) {
        explanation += `<p>🎯 <strong>매우 긍정적인 표정</strong>: 대화에 매우 좋은 영향을 주는 표정입니다.</p>`;
    } else if (score.score >= 70) {
        explanation += `<p>🎯 <strong>긍정적인 표정</strong>: 대화에 좋은 영향을 주는 표정입니다.</p>`;
    } else if (score.score >= 50) {
        explanation += `<p>🎯 <strong>중립적인 표정</strong>: 대화에 중립적인 영향을 주는 표정입니다.</p>`;
    } else if (score.score >= 30) {
        explanation += `<p>🎯 <strong>부정적인 표정</strong>: 대화에 부정적인 영향을 줄 수 있는 표정입니다.</p>`;
    } else {
        explanation += `<p>🎯 <strong>매우 부정적인 표정</strong>: 대화에 매우 부정적인 영향을 줄 수 있는 표정입니다.</p>`;
    }
    
    explanation += `</div>`;
    
    return explanation;
}

// ===== 시선 안정성 상세 정보 팝업 (UI-only mode) =====
function showGazeDetails() {
    const popup = document.getElementById('gaze-details-popup');
    if (popup) {
        popup.classList.add('active');
        
        // MediaPipe 데이터로 업데이트
        if (window.mediaPipeAnalyzer) {
            window.mediaPipeAnalyzer.updateGazePopupOnOpen();
        }
        
        updateGazePopupContent();
    }
}

function closeGazeDetails() {
    const popup = document.getElementById('gaze-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateGazePopupContent() {
    // MediaPipe 데이터가 있으면 사용, 없으면 기본 데이터 생성
    let gazeData = window.currentGazeData;
    
    // MediaPipe 데이터가 없으면 현재 점수로 생성
    if (!gazeData && window.mediaPipeAnalyzer) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores || {};
        const gazeScore = currentScores.gaze || 0;
        
        // 기본 시선 데이터 생성
        gazeData = {
            score: gazeScore,
            label: getScoreLabel(gazeScore),
            gazeDirection: {
                x: 0.5,
                y: 0.5,
                distance: 0.184,
                status: '중앙'
            },
            eyeCenter: {
                left: { x: 0.4, y: 0.5 },
                right: { x: 0.6, y: 0.5 }
            },
            lastUpdate: new Date().toISOString()
        };
        
        // 전역 변수에 저장
        window.currentGazeData = gazeData;
    }
    
    if (!gazeData) {
        document.getElementById('gaze-main-value').textContent = '데이터 없음';
        document.getElementById('gaze-direction-value').textContent = '측정 불가';
        return;
    }
    
    // 시선 상태 업데이트
    const mainValueEl = document.getElementById('gaze-main-value');
    if (mainValueEl) {
        mainValueEl.textContent = gazeData.label;
    }
    
    // 시선 방향 업데이트
    const directionEl = document.getElementById('gaze-direction-value');
    if (directionEl) {
        directionEl.textContent = gazeData.gazeDirection.status;
    }
}

// ===== 집중도 상세 정보 팝업 (UI-only mode) =====
function showConcentrationDetails() {
    const popup = document.getElementById('concentration-details-popup');
    if (popup) {
        popup.classList.add('active');
        
        // MediaPipe 데이터로 업데이트
        if (window.mediaPipeAnalyzer) {
            window.mediaPipeAnalyzer.updateConcentrationPopupOnOpen();
        }
        
        updateConcentrationPopupContent();
    }
}

function closeConcentrationDetails() {
    const popup = document.getElementById('concentration-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateConcentrationPopupContent() {
    // MediaPipe 데이터가 있으면 사용, 없으면 기본 데이터 생성
    let concentrationData = window.currentConcentrationData;
    
    // MediaPipe 데이터가 없으면 현재 점수로 생성
    if (!concentrationData && window.mediaPipeAnalyzer) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores || {};
        const concentrationScore = currentScores.concentration || 0;
        
        // 기본 집중도 데이터 생성
        concentrationData = {
            score: concentrationScore,
            label: getScoreLabel(concentrationScore),
            factors: {
                eyeOpenness: concentrationScore * 0.8,
                headStability: concentrationScore * 0.9,
                blinkRate: concentrationScore * 0.7
            },
            lastUpdate: new Date().toISOString()
        };
        
        // 전역 변수에 저장
        window.currentConcentrationData = concentrationData;
    }
    
    if (!concentrationData) {
        document.getElementById('concentration-main-value').textContent = '데이터 없음';
        document.getElementById('concentration-score-value').textContent = '0%';
        document.getElementById('concentration-factors').innerHTML = '<div class="no-data">집중도 분석 데이터가 없습니다.</div>';
        document.getElementById('concentration-criteria-text').innerHTML = '집중도 분석 데이터가 없습니다.';
        document.getElementById('concentration-explanation-text').innerHTML = '집중도 분석 데이터가 없습니다.';
        return;
    }
    
    // 집중도 상태 업데이트
    const mainValueEl = document.getElementById('concentration-main-value');
    if (mainValueEl) {
        mainValueEl.textContent = concentrationData.label;
    }
    
    // 집중도 점수 업데이트
    const scoreEl = document.getElementById('concentration-score-value');
    if (scoreEl) {
        scoreEl.textContent = `${concentrationData.score}%`;
    }
    
    // HTML 팝업 파일의 함수들 사용
    if (typeof window.updateConcentrationFactorsInfo === 'function') {
        window.updateConcentrationFactorsInfo();
    }
    if (typeof window.updateConcentrationCriteriaInfo === 'function') {
        window.updateConcentrationCriteriaInfo();
    }
    if (typeof window.updateConcentrationExplanationInfo === 'function') {
        window.updateConcentrationExplanationInfo();
    }
}

// ===== 깜빡임 상세 정보 팝업 (UI-only mode) =====
function showBlinkingDetails() {
    const popup = document.getElementById('blinking-details-popup');
    if (popup) {
        popup.classList.add('active');
        
        // MediaPipe 데이터로 업데이트
        if (window.mediaPipeAnalyzer) {
            window.mediaPipeAnalyzer.updateBlinkingPopupOnOpen();
        }
        
        updateBlinkingPopupContent();
    }
}

function closeBlinkingDetails() {
    const popup = document.getElementById('blinking-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function generateBlinkingExplanation(score) {
    if (score >= 80) return "적절한 깜빡임으로 눈이 건강합니다.";
    if (score >= 60) return "깜빡임이 다소 적습니다.";
    return "깜빡임이 너무 적어 눈이 건조할 수 있습니다.";
}

// 대화 주도권 관련 함수들은 initiative-details-popup.html에서 관리

// ===== 종합 점수 상세 정보 팝업 =====
function showComprehensiveScoreDetails() {
    const popup = document.getElementById('comprehensive-score-details-popup');
    if (popup) {
        popup.classList.add('active');
        updateComprehensiveScorePopupContent();
    }
}

function closeComprehensiveScoreDetails() {
    const popup = document.getElementById('comprehensive-score-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateComprehensiveScorePopupContent() {
    if (!window.ComprehensiveScoreCalculator) {
        console.warn('[PopupManager] ComprehensiveScoreCalculator not found');
        return;
    }

    const analysis = window.ComprehensiveScoreCalculator.getDetailedAnalysis();
    
    // 메인 값 업데이트
    document.getElementById('comprehensive-main-value').textContent = `${analysis.comprehensiveScore}%`;
    
    // 상태 텍스트 업데이트
    const statusText = getComprehensiveScoreStatus(analysis.comprehensiveScore);
    document.getElementById('comprehensive-status-text').textContent = statusText;
    
    // 시각적 요소 업데이트
    const visual = analysis.categories.visual;
    document.getElementById('visual-average').textContent = `${visual.average.toFixed(1)}%`;
    document.getElementById('visual-contribution').textContent = `${visual.contribution.toFixed(1)}%`;
    document.getElementById('visual-expression').textContent = `${visual.scores.expression}%`;
    document.getElementById('visual-gaze').textContent = `${visual.scores.gaze_stability}%`;
    document.getElementById('visual-posture').textContent = `${visual.scores.posture}%`;
    document.getElementById('visual-blinking').textContent = `${visual.scores.blinking}%`;
    
    // 청각적 요소 업데이트
    const auditory = analysis.categories.auditory;
    document.getElementById('auditory-average').textContent = `${auditory.average.toFixed(1)}%`;
    document.getElementById('auditory-contribution').textContent = `${auditory.contribution.toFixed(1)}%`;
    document.getElementById('auditory-tone').textContent = `${auditory.scores.tone}%`;
    document.getElementById('auditory-concentration').textContent = `${auditory.scores.concentration}%`;
    
    // 대화 요소 업데이트
    const conversation = analysis.categories.conversation;
    document.getElementById('conversation-score').textContent = `${conversation.score.toFixed(1)}%`;
    document.getElementById('conversation-contribution').textContent = `${conversation.contribution.toFixed(1)}%`;
    document.getElementById('conversation-initiative').textContent = `${conversation.scores.initiative}%`;
    
    // 설명 업데이트
    const explanationText = generateComprehensiveScoreExplanation(analysis);
    document.getElementById('comprehensive-explanation-text').innerHTML = explanationText;
}

function getComprehensiveScoreStatus(score) {
    if (score >= 90) return "매우 우수";
    if (score >= 80) return "우수";
    if (score >= 70) return "양호";
    if (score >= 60) return "보통";
    if (score >= 50) return "개선 필요";
    return "매우 개선 필요";
}

function generateComprehensiveScoreExplanation(analysis) {
    const { comprehensiveScore, categories } = analysis;
    
    let explanation = `<div class="explanation-section">`;
    explanation += `<h4>📈 종합 점수 분석</h4>`;
    explanation += `<ul>`;
    explanation += `<li><strong>종합 점수</strong>: ${comprehensiveScore}%</li>`;
    explanation += `<li><strong>시각적 요소</strong>: ${categories.visual.average.toFixed(1)}% (기여도: ${categories.visual.contribution.toFixed(1)}%)</li>`;
    explanation += `<li><strong>청각적 요소</strong>: ${categories.auditory.average.toFixed(1)}% (기여도: ${categories.auditory.contribution.toFixed(1)}%)</li>`;
    explanation += `<li><strong>대화 요소</strong>: ${categories.conversation.score.toFixed(1)}% (기여도: ${categories.conversation.contribution.toFixed(1)}%)</li>`;
    explanation += `</ul>`;
    
    // 점수 해석
    if (comprehensiveScore >= 90) {
        explanation += `<p>🎯 <strong>매우 우수한 대화 품질</strong>: 모든 요소에서 뛰어난 성과를 보이고 있습니다. 이 수준을 유지하세요!</p>`;
    } else if (comprehensiveScore >= 80) {
        explanation += `<p>🎯 <strong>우수한 대화 품질</strong>: 전반적으로 좋은 대화를 하고 있습니다. 약간의 개선으로 더욱 완벽해질 수 있습니다.</p>`;
    } else if (comprehensiveScore >= 70) {
        explanation += `<p>🎯 <strong>양호한 대화 품질</strong>: 적절한 수준의 대화를 하고 있습니다. 지속적인 개선으로 더 나은 결과를 얻을 수 있습니다.</p>`;
    } else if (comprehensiveScore >= 60) {
        explanation += `<p>🎯 <strong>보통 수준의 대화 품질</strong>: 기본적인 대화는 가능하지만 개선의 여지가 있습니다. 각 요소별로 점검해보세요.</p>`;
    } else if (comprehensiveScore >= 50) {
        explanation += `<p>🎯 <strong>개선이 필요한 대화 품질</strong>: 여러 요소에서 개선이 필요합니다. 구체적인 피드백을 참고하여 연습해보세요.</p>`;
    } else {
        explanation += `<p>🎯 <strong>매우 개선이 필요한 대화 품질</strong>: 전반적인 개선이 필요합니다. 단계별로 연습하여 점진적으로 향상시켜보세요.</p>`;
    }
    
    // 개선 제안
    explanation += `<h4>💡 개선 제안</h4>`;
    const lowestCategory = getLowestCategory(categories);
    explanation += `<p>가장 개선이 필요한 영역: <strong>${lowestCategory.name}</strong> (${lowestCategory.score.toFixed(1)}%)</p>`;
    explanation += `<p>${lowestCategory.suggestion}</p>`;
    
    explanation += `</div>`;
    
    return explanation;
}

function getLowestCategory(categories) {
    const categoryScores = [
        { name: '시각적 요소', score: categories.visual.average, suggestion: '표정, 시선, 자세, 깜빡임을 더 자연스럽게 조절해보세요.' },
        { name: '청각적 요소', score: categories.auditory.average, suggestion: '음성 톤과 집중도를 개선하여 더 명확한 소통을 해보세요.' },
        { name: '대화 요소', score: categories.conversation.score, suggestion: '대화 주도권을 적절히 조절하여 균형잡힌 대화를 해보세요.' }
    ];
    
    return categoryScores.reduce((lowest, current) => 
        current.score < lowest.score ? current : lowest
    );
}

function updateBlinkingPopupContent() {
    // MediaPipe 데이터가 있으면 사용, 없으면 기본 데이터 생성
    let blinkingData = window.currentBlinkingData;
    
    // MediaPipe 데이터가 없으면 현재 점수로 생성
    if (!blinkingData && window.mediaPipeAnalyzer) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores || {};
        const blinkingScore = currentScores.blinking || 0;
        
        // 기본 깜빡임 데이터 생성
        blinkingData = {
            score: blinkingScore,
            label: getScoreLabel(blinkingScore),
            blinkRate: blinkingScore * 0.01, // 분당 깜빡임 횟수
            explanation: generateBlinkingExplanation(blinkingScore),
            lastUpdate: new Date().toISOString()
        };
        
        // 전역 변수에 저장
        window.currentBlinkingData = blinkingData;
    }
    
    if (!blinkingData) {
        document.getElementById('blinking-main-value').textContent = '데이터 없음';
        document.getElementById('blinking-rate-value').textContent = '0회/분';
        document.getElementById('blinking-factors').innerHTML = '<div class="no-data">깜빡임 분석 데이터가 없습니다.</div>';
        document.getElementById('blinking-criteria-text').innerHTML = '깜빡임 분석 데이터가 없습니다.';
        document.getElementById('blinking-explanation-text').innerHTML = '깜빡임 분석 데이터가 없습니다.';
        return;
    }
    
    // 깜빡임 상태 업데이트
    const mainValueEl = document.getElementById('blinking-main-value');
    if (mainValueEl) {
        mainValueEl.textContent = blinkingData.label;
    }
    
    // 깜빡임 속도 업데이트
    const rateEl = document.getElementById('blinking-rate-value');
    if (rateEl) {
        rateEl.textContent = `${blinkingData.blinkRate.toFixed(1)}회/분`;
    }
    
    // HTML 팝업 파일의 함수들 사용
    if (typeof window.updateBlinkingFactorsInfo === 'function') {
        window.updateBlinkingFactorsInfo();
    }
    if (typeof window.updateBlinkingCriteriaInfo === 'function') {
        window.updateBlinkingCriteriaInfo();
    }
    if (typeof window.updateBlinkingExplanationInfo === 'function') {
        window.updateBlinkingExplanationInfo();
    }
}

// ===== 자세 상세 정보 팝업 (UI-only mode) =====
function showPostureDetails() {
    const popup = document.getElementById('posture-details-popup');
    if (popup) {
        popup.classList.add('active');
        
        // MediaPipe 데이터로 업데이트
        if (window.mediaPipeAnalyzer) {
            window.mediaPipeAnalyzer.updatePosturePopupOnOpen();
        }
        
        updatePosturePopupContent();
    }
}

function closePostureDetails() {
    const popup = document.getElementById('posture-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updatePosturePopupContent() {
    // MediaPipe 데이터가 있으면 사용, 없으면 기본 데이터 생성
    let postureData = window.currentPostureData;
    
    // MediaPipe 데이터가 없으면 현재 점수로 생성
    if (!postureData && window.mediaPipeAnalyzer) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores || {};
        const postureScore = currentScores.posture || 0;
        
        // 기본 자세 데이터 생성
        postureData = {
            score: postureScore,
            label: getScoreLabel(postureScore),
            headTilt: {
                angle: 0.5,
                direction: '중앙',
                stability: postureScore / 100
            },
            stability: postureScore,
            lastUpdate: new Date().toISOString()
        };
        
        // 전역 변수에 저장
        window.currentPostureData = postureData;
    }
    
    if (!postureData) {
        document.getElementById('posture-main-value').textContent = '데이터 없음';
        document.getElementById('posture-score-value').textContent = '0%';
        document.getElementById('posture-factors').innerHTML = '<div class="no-data">자세 분석 데이터가 없습니다.</div>';
        document.getElementById('posture-criteria-text').innerHTML = '자세 분석 데이터가 없습니다.';
        document.getElementById('posture-explanation-text').innerHTML = '자세 분석 데이터가 없습니다.';
        return;
    }
    
    // 자세 상태 업데이트
    const mainValueEl = document.getElementById('posture-main-value');
    if (mainValueEl) {
        mainValueEl.textContent = postureData.label;
    }
    
    // 자세 점수 업데이트
    const scoreEl = document.getElementById('posture-score-value');
    if (scoreEl) {
        scoreEl.textContent = `${postureData.score}%`;
    }
    
    // HTML 팝업 파일의 함수들 사용
    if (typeof window.updatePostureFactorsInfo === 'function') {
        window.updatePostureFactorsInfo();
    }
    if (typeof window.updatePostureCriteriaInfo === 'function') {
        window.updatePostureCriteriaInfo();
    }
    if (typeof window.updatePostureExplanationInfo === 'function') {
        window.updatePostureExplanationInfo();
    }
}

// ===== 팝업 외부 클릭 시 닫기 =====
document.addEventListener('click', function(event) {
    const popups = [
        'expression-details-popup',
        'gaze-details-popup', 
        'concentration-details-popup',
        'posture-details-popup',
        'blinking-details-popup',
        'initiative-details-popup',
        'comprehensive-score-details-popup'
    ];
    
    popups.forEach(popupId => {
        const popup = document.getElementById(popupId);
        if (popup && event.target === popup) {
            const closeFunction = popupId.replace('-details-popup', 'Details');
            if (typeof window[`close${closeFunction.charAt(0).toUpperCase() + closeFunction.slice(1)}`] === 'function') {
                window[`close${closeFunction.charAt(0).toUpperCase() + closeFunction.slice(1)}`]();
            }
        }
    });
});

// 전역 스코프에 노출
window.PopupManager = {
    showExpressionDetails,
    closeExpressionDetails,
    showGazeDetails,
    closeGazeDetails,
    showConcentrationDetails,
    closeConcentrationDetails,
    showPostureDetails,
    closePostureDetails,
    showBlinkingDetails,
    closeBlinkingDetails,
    updateExpressionPopupContent,
    updateGazePopupContent,
    updateConcentrationPopupContent,
    updatePosturePopupContent,
    updateBlinkingPopupContent
};

// 깜빡임 함수들을 전역 스코프에 직접 노출
window.showBlinkingDetails = showBlinkingDetails;
window.closeBlinkingDetails = closeBlinkingDetails;

// 누락된 함수들 추가 (팝업 HTML에서 정의됨)
function showInitiativeDetails() {
    const popup = document.getElementById('initiative-details-popup');
    if (popup) {
        popup.classList.add('active');
        if (typeof updateInitiativePopupContent === 'function') {
            updateInitiativePopupContent();
        }
    }
}

function closeInitiativeDetails() {
    const popup = document.getElementById('initiative-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function showComprehensiveScoreDetails() {
    const popup = document.getElementById('comprehensive-score-details-popup');
    if (popup) {
        popup.classList.add('active');
        if (typeof updateComprehensiveScorePopupContent === 'function') {
            updateComprehensiveScorePopupContent();
        }
    }
}

function closeComprehensiveScoreDetails() {
    const popup = document.getElementById('comprehensive-score-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

// 전역 스코프에 노출
window.showInitiativeDetails = showInitiativeDetails;
window.closeInitiativeDetails = closeInitiativeDetails;
window.showComprehensiveScoreDetails = showComprehensiveScoreDetails;
window.closeComprehensiveScoreDetails = closeComprehensiveScoreDetails;

// ===== 종합 점수 탭 관리 =====
function showComprehensiveTab(tabName) {
    // 모든 탭 버튼에서 active 클래스 제거
    document.querySelectorAll('#comprehensive-score-details-popup .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 모든 탭 패널 숨기기
    document.querySelectorAll('#comprehensive-score-details-popup .tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    // 선택된 탭 버튼 활성화
    const activeBtn = document.querySelector(`#comprehensive-score-details-popup .tab-btn[onclick="showComprehensiveTab('${tabName}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // 선택된 탭 패널 표시
    const activePane = document.getElementById(`comprehensive-${tabName}-tab`);
    if (activePane) {
        activePane.classList.add('active');
    }
    
    console.log(`[PopupManager] 종합 점수 탭 전환: ${tabName}`);
}

// 전역 함수로 등록
window.showComprehensiveTab = showComprehensiveTab;

console.log('[POPUP-MANAGER] 팝업 관리자 모듈 로드 완료');
