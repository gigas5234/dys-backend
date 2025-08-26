/**
 * 팝업 관리자 모듈
 * 모든 상세 정보 팝업의 관리와 데이터 처리를 담당
 */

// 전역 데이터 변수들
let currentExpressionData = null;
let currentGazeData = null;
let currentConcentrationData = null;
let currentPostureData = null;
let currentBlinkingData = null;

// ===== 표정 상세 정보 팝업 =====
function showExpressionDetails() {
    const popup = document.getElementById('expression-details-popup');
    if (popup) {
        popup.classList.add('active');
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
    if (!currentExpressionData) {
        document.getElementById('expression-main-value').textContent = '데이터 없음';
        document.getElementById('expression-confidence-value').textContent = '0%';
        document.getElementById('expression-probabilities').innerHTML = '<div class="no-data">표정 분석 데이터가 없습니다.</div>';
        document.getElementById('expression-explanation-text').innerHTML = '표정 분석 데이터가 없습니다.';
        return;
    }
    
    // 주요 정보 업데이트
    const expression = currentExpressionData.expression;
    const confidence = currentExpressionData.confidence;
    document.getElementById('expression-main-value').textContent = getExpressionKoreanName(expression);
    document.getElementById('expression-confidence-value').textContent = `${(confidence * 100).toFixed(0)}%`;
    
    // 확률 정보 업데이트
    updateExpressionProbabilities();
    
    // 설명 업데이트
    document.getElementById('expression-explanation-text').innerHTML = generateExpressionExplanation();
}

function updateExpressionProbabilities() {
    const probabilitiesDiv = document.getElementById('expression-probabilities');
    
    if (!currentExpressionData?.probabilities) {
        probabilitiesDiv.innerHTML = '<div class="no-data">확률 데이터가 없습니다.</div>';
        return;
    }
    
    const probabilities = currentExpressionData.probabilities;
    let html = '';
    
    Object.entries(probabilities).forEach(([expression, probability]) => {
        const koreanName = getExpressionKoreanName(expression);
        const percentage = (probability * 100).toFixed(1);
        const isHighest = probability === Math.max(...Object.values(probabilities));
        
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

function generateExpressionExplanation() {
    if (!currentExpressionData) {
        return '표정 분석 데이터가 없습니다.';
    }
    
    const { expression, confidence, score } = currentExpressionData;
    const koreanExpression = getExpressionKoreanName(expression);
    
    let explanation = `<div class="explanation-section">`;
    explanation += `<h4>📈 현재 분석 결과</h4>`;
    explanation += `<ul>`;
    explanation += `<li><strong>감지된 표정</strong>: ${koreanExpression}</li>`;
    explanation += `<li><strong>신뢰도</strong>: ${(confidence * 100).toFixed(1)}%</li>`;
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

// ===== 시선 안정성 상세 정보 팝업 =====
function showGazeDetails() {
    const popup = document.getElementById('gaze-details-popup');
    if (popup) {
        popup.classList.add('active');
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
    if (!currentGazeData) {
        document.getElementById('gaze-main-value').textContent = '데이터 없음';
        document.getElementById('gaze-stability-value').textContent = '0%';
        document.getElementById('gaze-landmarks').innerHTML = '<div class="no-data">시선 분석 데이터가 없습니다.</div>';
        document.getElementById('gaze-criteria-text').innerHTML = '시선 분석 데이터가 없습니다.';
        document.getElementById('gaze-explanation-text').innerHTML = '시선 분석 데이터가 없습니다.';
        return;
    }
    
    // 주요 정보 업데이트
    const isFocused = currentGazeData.isFocused;
    document.getElementById('gaze-main-value').textContent = isFocused ? '집중 중' : '분산됨';
    document.getElementById('gaze-stability-value').textContent = `${currentGazeData.score}%`;
    
    // 랜드마크 정보 업데이트
    updateGazeLandmarksInfo();
    
    // 평가 기준 업데이트
    updateGazeCriteriaInfo();
    
    // 점수 계산 근거 업데이트
    updateGazeExplanationInfo();
}

function updateGazeLandmarksInfo() {
    const landmarksDiv = document.getElementById('gaze-landmarks');
    
    // 시선 분석에만 사용되는 MediaPipe FaceMesh 랜드마크 정보
    const landmarkInfo = [
        { name: '왼쪽 눈 윤곽', value: '16개', description: '왼쪽 눈의 윤곽선을 구성하는 랜드마크' },
        { name: '오른쪽 눈 윤곽', value: '16개', description: '오른쪽 눈의 윤곽선을 구성하는 랜드마크' },
        { name: '왼쪽 눈썹', value: '10개', description: '왼쪽 눈썹의 윤곽선을 구성하는 랜드마크' },
        { name: '오른쪽 눈썹', value: '10개', description: '오른쪽 눈썹의 윤곽선을 구성하는 랜드마크' },
        { name: '눈동자 중심', value: '2개', description: '왼쪽/오른쪽 눈동자의 중심점' },
        { name: '시선 추적용', value: '54개', description: '시선 방향과 안정성 분석에 사용되는 총 랜드마크' }
    ];
    
    let html = '';
    landmarkInfo.forEach(item => {
        html += `
            <div class="landmark-item">
                <div class="landmark-name">${item.name}</div>
                <div class="landmark-value">${item.value}</div>
                <div class="landmark-description">${item.description}</div>
            </div>
        `;
    });
    
    landmarksDiv.innerHTML = html;
}

function updateGazeCriteriaInfo() {
    const criteriaDiv = document.getElementById('gaze-criteria-text');
    
    const criteria = `
        <div class="criteria-section">
            <h4>🎯 시선 안정성 평가 기준</h4>
            <ul>
                <li><strong>점프 거리 (40%)</strong>: 눈동자 중심점의 급격한 이동 거리</li>
                <li><strong>속도 (30%)</strong>: 눈동자 이동의 평균 속도 (픽셀/프레임)</li>
                <li><strong>안정성 (30%)</strong>: 눈동자가 한 영역에 머무는 정도</li>
            </ul>
            
            <h4>👁️ 시선 분석 방법</h4>
            <ul>
                <li><strong>눈 윤곽 추적</strong>: 32개 랜드마크로 눈의 위치와 크기 측정</li>
                <li><strong>눈동자 중심 계산</strong>: 눈 윤곽 내부의 중심점 추정</li>
                <li><strong>시선 방향 분석</strong>: 눈동자 중심의 화면 내 위치 변화 추적</li>
                <li><strong>안정성 판단</strong>: 일정 시간 동안의 시선 변화량 계산</li>
            </ul>
            
            <h4>📊 점수 기준</h4>
            <ul>
                <li><strong>90-100점</strong>: 매우 안정적인 시선 (집중력 우수)</li>
                <li><strong>70-89점</strong>: 안정적인 시선 (적절한 집중)</li>
                <li><strong>50-69점</strong>: 보통 수준의 시선 (일반적인 상태)</li>
                <li><strong>30-49점</strong>: 불안정한 시선 (집중력 저하)</li>
                <li><strong>0-29점</strong>: 매우 불안정한 시선 (심각한 집중력 문제)</li>
            </ul>
        </div>
    `;
    
    criteriaDiv.innerHTML = criteria;
}

function updateGazeExplanationInfo() {
    const explanationDiv = document.getElementById('gaze-explanation-text');
    
    if (!currentGazeData) {
        explanationDiv.innerHTML = '시선 분석 데이터가 없습니다.';
        return;
    }
    
    const { jumpDistance, velocity, isFocused, score } = currentGazeData;
    
    let explanation = `<div class="explanation-section">`;
    explanation += `<h4>📈 현재 분석 결과</h4>`;
    explanation += `<ul>`;
    explanation += `<li><strong>시선 상태</strong>: ${isFocused ? '집중 중' : '분산됨'}</li>`;
    explanation += `<li><strong>점프 거리</strong>: ${(jumpDistance * 100).toFixed(2)}% (화면 대비)</li>`;
    explanation += `<li><strong>이동 속도</strong>: ${velocity.toFixed(4)} (픽셀/프레임)</li>`;
    explanation += `<li><strong>최종 점수</strong>: ${score}점</li>`;
    explanation += `</ul>`;
    
    // 점수 해석
    if (score >= 90) {
        explanation += `<p>🎯 <strong>매우 우수한 시선 안정성</strong>: 시선이 매우 안정적으로 유지되고 있습니다.</p>`;
    } else if (score >= 70) {
        explanation += `<p>🎯 <strong>우수한 시선 안정성</strong>: 시선이 안정적으로 유지되고 있습니다.</p>`;
    } else if (score >= 50) {
        explanation += `<p>🎯 <strong>보통 수준의 시선 안정성</strong>: 시선이 어느 정도 안정적입니다.</p>`;
    } else if (score >= 30) {
        explanation += `<p>🎯 <strong>개선이 필요한 시선 안정성</strong>: 시선이 다소 불안정합니다.</p>`;
    } else {
        explanation += `<p>🎯 <strong>매우 개선이 필요한 시선 안정성</strong>: 시선이 매우 불안정합니다.</p>`;
    }
    
    explanation += `</div>`;
    
    explanationDiv.innerHTML = explanation;
}

// ===== 집중도 상세 정보 팝업 =====
function showConcentrationDetails() {
    const popup = document.getElementById('concentration-details-popup');
    if (popup) {
        popup.classList.add('active');
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
    if (!currentConcentrationData) {
        document.getElementById('concentration-main-value').textContent = '데이터 없음';
        document.getElementById('concentration-score-value').textContent = '0%';
        document.getElementById('concentration-factors').innerHTML = '<div class="no-data">집중도 분석 데이터가 없습니다.</div>';
        document.getElementById('concentration-criteria-text').innerHTML = '집중도 분석 데이터가 없습니다.';
        document.getElementById('concentration-explanation-text').innerHTML = '집중도 분석 데이터가 없습니다.';
        return;
    }
    
    // 주요 정보 업데이트
    const isFocused = currentConcentrationData.isFocused;
    document.getElementById('concentration-main-value').textContent = isFocused ? '집중 중' : '분산됨';
    document.getElementById('concentration-score-value').textContent = `${currentConcentrationData.score}%`;
    
    // 분석 요소 업데이트
    updateConcentrationFactorsInfo();
    
    // 평가 기준 업데이트
    updateConcentrationCriteriaInfo();
    
    // 점수 계산 근거 업데이트
    updateConcentrationExplanationInfo();
}

function updateConcentrationFactorsInfo() {
    const factorsDiv = document.getElementById('concentration-factors');
    
    // 집중도 분석에 사용되는 요소들
    const factorInfo = [
        { name: '시선 안정성', value: '35%', description: '시선이 한 곳에 머무는 정도' },
        { name: '시선 집중도', value: '35%', description: '시선이 화면 중앙에 집중되는 정도' },
        { name: '표정 따뜻함', value: '30%', description: '긍정적인 표정으로 집중력 표현' },
        { name: '눈동자 추적', value: '실시간', description: '눈동자 움직임으로 집중 상태 판단' },
        { name: '시선 이탈 시간', value: '2초 이내', description: '시선이 화면을 벗어나는 시간' },
        { name: '집중 지속성', value: '연속성', description: '지속적인 집중 상태 유지' }
    ];
    
    let html = '';
    factorInfo.forEach(item => {
        html += `
            <div class="factor-item">
                <div class="factor-name">${item.name}</div>
                <div class="factor-value">${item.value}</div>
                <div class="factor-description">${item.description}</div>
            </div>
        `;
    });
    
    factorsDiv.innerHTML = html;
}

function updateConcentrationCriteriaInfo() {
    const criteriaDiv = document.getElementById('concentration-criteria-text');
    
    const criteria = `
        <div class="criteria-section">
            <h4>🎯 집중도 평가 기준</h4>
            <ul>
                <li><strong>시선 안정성 (35%)</strong>: 시선이 한 곳에 머무는 정도</li>
                <li><strong>시선 집중도 (35%)</strong>: 시선이 화면 중앙에 집중되는 정도</li>
                <li><strong>표정 따뜻함 (30%)</strong>: 긍정적인 표정으로 집중력 표현</li>
            </ul>
            
            <h4>🧠 집중도 분석 방법</h4>
            <ul>
                <li><strong>눈동자 추적</strong>: 32개 랜드마크로 눈동자 위치 추적</li>
                <li><strong>시선 방향 분석</strong>: 화면 중앙 대비 시선 위치 계산</li>
                <li><strong>집중 지속성</strong>: 일정 시간 동안의 집중 상태 유지</li>
                <li><strong>시선 이탈 감지</strong>: 화면을 벗어나는 시선 감지</li>
            </ul>
            
            <h4>📊 점수 기준</h4>
            <ul>
                <li><strong>90-100점</strong>: 매우 높은 집중도 (완벽한 집중)</li>
                <li><strong>70-89점</strong>: 높은 집중도 (좋은 집중)</li>
                <li><strong>50-69점</strong>: 보통 집중도 (일반적인 집중)</li>
                <li><strong>30-49점</strong>: 낮은 집중도 (집중력 저하)</li>
                <li><strong>0-29점</strong>: 매우 낮은 집중도 (심각한 집중력 문제)</li>
            </ul>
        </div>
    `;
    
    criteriaDiv.innerHTML = criteria;
}

function updateConcentrationExplanationInfo() {
    const explanationDiv = document.getElementById('concentration-explanation-text');
    
    if (!currentConcentrationData) {
        explanationDiv.innerHTML = '집중도 분석 데이터가 없습니다.';
        return;
    }
    
    const { jumpDistance, velocity, isFocused, score } = currentConcentrationData;
    
    let explanation = `<div class="explanation-section">`;
    explanation += `<h4>📈 현재 분석 결과</h4>`;
    explanation += `<ul>`;
    explanation += `<li><strong>집중 상태</strong>: ${isFocused ? '집중 중' : '분산됨'}</li>`;
    explanation += `<li><strong>점프 거리</strong>: ${(jumpDistance * 100).toFixed(2)}% (화면 대비)</li>`;
    explanation += `<li><strong>이동 속도</strong>: ${velocity.toFixed(4)} (픽셀/프레임)</li>`;
    explanation += `<li><strong>최종 점수</strong>: ${score}점</li>`;
    explanation += `</ul>`;
    
    // 점수 해석
    if (score >= 90) {
        explanation += `<p>🎯 <strong>완벽한 집중도</strong>: 시선이 매우 안정적이고 화면에 완벽하게 집중하고 있습니다.</p>`;
    } else if (score >= 70) {
        explanation += `<p>🎯 <strong>우수한 집중도</strong>: 시선이 안정적이고 화면에 잘 집중하고 있습니다.</p>`;
    } else if (score >= 50) {
        explanation += `<p>🎯 <strong>보통 집중도</strong>: 시선이 어느 정도 안정적이고 적절히 집중하고 있습니다.</p>`;
    } else if (score >= 30) {
        explanation += `<p>🎯 <strong>개선이 필요한 집중도</strong>: 시선이 불안정하고 집중력이 저하되고 있습니다.</p>`;
    } else {
        explanation += `<p>🎯 <strong>매우 개선이 필요한 집중도</strong>: 시선이 매우 불안정하고 심각한 집중력 문제가 있습니다.</p>`;
    }
    
    explanation += `</div>`;
    
    explanationDiv.innerHTML = explanation;
}

// ===== 깜빡임 상세 정보 팝업 =====
function showBlinkingDetails() {
    const popup = document.getElementById('blinking-details-popup');
    if (popup) {
        popup.classList.add('active');
        updateBlinkingPopupContent();
    }
}

function closeBlinkingDetails() {
    const popup = document.getElementById('blinking-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

// ===== 대화 주도권 상세 정보 팝업 =====
function showInitiativeDetails() {
    const popup = document.getElementById('initiative-details-popup');
    if (popup) {
        popup.classList.add('active');
        updateInitiativePopupContent();
    }
}

function closeInitiativeDetails() {
    const popup = document.getElementById('initiative-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateInitiativePopupContent() {
    if (!window.ConversationAnalyzer) {
        console.warn('[PopupManager] ConversationAnalyzer not found');
        return;
    }

    const analysis = window.ConversationAnalyzer.getDetailedAnalysis();
    
    // 메인 값 업데이트
    document.getElementById('initiative-main-value').textContent = `${analysis.userInitiativeScore}%`;
    document.getElementById('initiative-status-text').textContent = analysis.status;
    document.getElementById('initiative-status-text').style.color = analysis.color;
    
    // 큰 바 업데이트
    document.getElementById('initiative-user-bar-large').style.width = `${analysis.userInitiativeScore}%`;
    document.getElementById('initiative-ai-bar-large').style.width = `${100 - analysis.userInitiativeScore}%`;
    
    // 통계 업데이트
    document.getElementById('user-message-count').textContent = analysis.stats.userMessageCount;
    document.getElementById('ai-message-count').textContent = analysis.stats.aiMessageCount;
    document.getElementById('user-length').textContent = analysis.stats.userTotalLength;
    document.getElementById('ai-length').textContent = analysis.stats.aiTotalLength;
    document.getElementById('user-questions').textContent = analysis.stats.userQuestionCount;
    document.getElementById('ai-questions').textContent = analysis.stats.aiQuestionCount;
    
    // 설명 업데이트
    const explanationText = generateInitiativeExplanation(analysis);
    document.getElementById('initiative-explanation-text').innerHTML = explanationText;
}

function generateInitiativeExplanation(analysis) {
    const { userInitiativeScore, status, stats } = analysis;
    
    let explanation = `<div class="explanation-section">`;
    explanation += `<h4>📈 현재 분석 결과</h4>`;
    explanation += `<ul>`;
    explanation += `<li><strong>주도권 점수</strong>: ${userInitiativeScore}%</li>`;
    explanation += `<li><strong>상태</strong>: ${status}</li>`;
    explanation += `<li><strong>메시지 수</strong>: ${stats.userMessageCount} : ${stats.aiMessageCount}</li>`;
    explanation += `<li><strong>메시지 길이</strong>: ${stats.userTotalLength} : ${stats.aiTotalLength}</li>`;
    explanation += `<li><strong>질문 수</strong>: ${stats.userQuestionCount} : ${stats.aiQuestionCount}</li>`;
    explanation += `</ul>`;
    
    // 주도권 해석
    if (userInitiativeScore >= 80) {
        explanation += `<p>🎯 <strong>매우 적극적인 대화</strong>: 대화를 주도적으로 이끌고 있습니다. 상대방에게 충분한 기회를 주는 것도 중요합니다.</p>`;
    } else if (userInitiativeScore >= 65) {
        explanation += `<p>🎯 <strong>적극적인 대화</strong>: 적절한 수준으로 대화를 이끌고 있습니다. 좋은 균형을 유지하고 있습니다.</p>`;
    } else if (userInitiativeScore >= 45) {
        explanation += `<p>🎯 <strong>균형적인 대화</strong>: 상대방과 균형잡힌 대화를 나누고 있습니다. 적절한 수준입니다.</p>`;
    } else if (userInitiativeScore >= 30) {
        explanation += `<p>🎯 <strong>소극적인 대화</strong>: 조금 더 적극적으로 대화에 참여해보세요. 질문을 던지거나 관심을 표현해보세요.</p>`;
    } else {
        explanation += `<p>🎯 <strong>매우 소극적인 대화</strong>: 대화에 더 적극적으로 참여해보세요. 질문을 하고 자신의 생각을 표현해보세요.</p>`;
    }
    
    explanation += `</div>`;
    
    return explanation;
}

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
    if (!currentBlinkingData) {
        document.getElementById('blinking-main-value').textContent = '데이터 없음';
        document.getElementById('blinking-rate-value').textContent = '0회/분';
        document.getElementById('blinking-factors').innerHTML = '<div class="no-data">깜빡임 분석 데이터가 없습니다.</div>';
        document.getElementById('blinking-criteria-text').innerHTML = '깜빡임 분석 데이터가 없습니다.';
        document.getElementById('blinking-explanation-text').innerHTML = '깜빡임 분석 데이터가 없습니다.';
        return;
    }
    
    // 주요 정보 업데이트
    const blinkStatus = currentBlinkingData.earResult.blinkStatus;
    const blinkRatePerMinute = currentBlinkingData.earResult.blinkRatePerMinute || 0;
    document.getElementById('blinking-main-value').textContent = getBlinkStatusKorean(blinkStatus);
    document.getElementById('blinking-rate-value').textContent = `${blinkRatePerMinute}회/분`;
    
    // 분석 요소 업데이트
    updateBlinkingFactorsInfo();
    
    // 평가 기준 업데이트
    updateBlinkingCriteriaInfo();
    
    // 점수 계산 근거 업데이트
    updateBlinkingExplanationInfo();
}

function getBlinkStatusKorean(status) {
    const statusMap = {
        'open': '눈 뜸',
        'blinking': '깜빡임',
        'closed': '눈 감음'
    };
    return statusMap[status] || status;
}

function updateBlinkingFactorsInfo() {
    const factorsDiv = document.getElementById('blinking-factors');
    
    // 깜빡임 분석에 사용되는 요소들
    const factorInfo = [
        { name: 'EAR 값', value: '실시간', description: 'Eye Aspect Ratio (눈 종횡비)' },
        { name: '왼쪽 눈', value: '6개 랜드마크', description: '왼쪽 눈 윤곽선 추적 (33, 7, 163, 144, 145, 153)' },
        { name: '오른쪽 눈', value: '6개 랜드마크', description: '오른쪽 눈 윤곽선 추적 (362, 382, 381, 380, 374, 373)' },
        { name: '깜빡임 임계값', value: '0.19', description: '깜빡임 감지 시작 임계값' },
        { name: '눈 감음 임계값', value: '0.22', description: '눈 완전 감음 임계값' },
        { name: '정상 빈도', value: '6~35회/분', description: '자연스러운 깜빡임 빈도' },
        { name: '깜빡임 지속시간', value: '50~500ms', description: '유효한 깜빡임 지속시간 범위' },
        { name: '분당 빈도', value: '실시간 계산', description: '최근 1분간 깜빡임 빈도' }
    ];
    
    let html = '';
    factorInfo.forEach(item => {
        html += `
            <div class="factor-item">
                <div class="factor-name">${item.name}</div>
                <div class="factor-value">${item.value}</div>
                <div class="factor-description">${item.description}</div>
            </div>
        `;
    });
    
    factorsDiv.innerHTML = html;
}

function updateBlinkingCriteriaInfo() {
    const criteriaDiv = document.getElementById('blinking-criteria-text');
    
    const criteria = `
        <div class="criteria-section">
            <h4>😉 깜빡임 평가 기준</h4>
            <ul>
                <li><strong>EAR 값 (40%)</strong>: Eye Aspect Ratio (눈 종횡비)</li>
                <li><strong>깜빡임 빈도 (35%)</strong>: 분당 깜빡임 횟수</li>
                <li><strong>눈 상태 (25%)</strong>: 눈 뜸/깜빡임/감음 상태</li>
            </ul>
            
            <h4>👁️ 깜빡임 분석 방법</h4>
            <ul>
                <li><strong>EAR 계산</strong>: 눈 윤곽선 6개 랜드마크로 종횡비 계산</li>
                <li><strong>임계값 판단</strong>: EAR < 0.19 (깜빡임), EAR < 0.22 (눈 감음)</li>
                <li><strong>빈도 측정</strong>: 10초 윈도우로 분당 깜빡임 수 계산</li>
                <li><strong>개인별 기준</strong>: 캘리브레이션으로 개인별 EAR 기준 설정</li>
            </ul>
            
            <h4>📊 점수 기준</h4>
            <ul>
                <li><strong>90-100점</strong>: 매우 자연스러운 깜빡임 (완벽한 이완)</li>
                <li><strong>70-89점</strong>: 자연스러운 깜빡임 (좋은 이완)</li>
                <li><strong>50-69점</strong>: 보통 깜빡임 (적절한 이완)</li>
                <li><strong>30-49점</strong>: 부족한 깜빡임 (이완 부족)</li>
                <li><strong>0-29점</strong>: 매우 부족한 깜빡임 (심각한 이완 부족)</li>
            </ul>
        </div>
    `;
    
    criteriaDiv.innerHTML = criteria;
}

function updateBlinkingExplanationInfo() {
    const explanationDiv = document.getElementById('blinking-explanation-text');
    
    if (!currentBlinkingData) {
        explanationDiv.innerHTML = '깜빡임 분석 데이터가 없습니다.';
        return;
    }
    
    const { earResult, score } = currentBlinkingData;
    const { ear, leftEAR, rightEAR, blinkStatus, blinkRatePerMinute, avgBlinkDuration, totalBlinkCount, thresholds } = earResult;
    
    let explanation = `<div class="explanation-section">`;
    explanation += `<h4>📈 현재 분석 결과</h4>`;
    explanation += `<ul>`;
    explanation += `<li><strong>깜빡임 상태</strong>: ${getBlinkStatusKorean(blinkStatus)}</li>`;
    explanation += `<li><strong>평균 EAR</strong>: ${ear.toFixed(3)}</li>`;
    explanation += `<li><strong>왼쪽 눈 EAR</strong>: ${leftEAR.toFixed(3)}</li>`;
    explanation += `<li><strong>오른쪽 눈 EAR</strong>: ${rightEAR.toFixed(3)}</li>`;
    explanation += `<li><strong>분당 깜빡임 수</strong>: ${blinkRatePerMinute || 0}회/분</li>`;
    explanation += `<li><strong>평균 지속시간</strong>: ${avgBlinkDuration ? Math.round(avgBlinkDuration) : 0}ms</li>`;
    explanation += `<li><strong>총 깜빡임 수</strong>: ${totalBlinkCount || 0}회</li>`;
    explanation += `<li><strong>최종 점수</strong>: ${score}점</li>`;
    explanation += `</ul>`;
    
    // 깜빡임 빈도 평가
    let frequencyAssessment = '';
    if (blinkRatePerMinute >= 6 && blinkRatePerMinute <= 35) {
        frequencyAssessment = '✅ <strong>적절한 빈도</strong>: 자연스러운 깜빡임 빈도입니다.';
    } else if (blinkRatePerMinute < 6) {
        frequencyAssessment = '⚠️ <strong>낮은 빈도</strong>: 깜빡임이 부족하여 눈이 건조할 수 있습니다.';
    } else {
        frequencyAssessment = '⚠️ <strong>높은 빈도</strong>: 과도한 깜빡임으로 긴장이 있을 수 있습니다.';
    }
    
    // 점수 해석
    let scoreAssessment = '';
    if (score >= 90) {
        scoreAssessment = `<p>🎯 <strong>완벽한 깜빡임</strong>: 매우 자연스럽고 적절한 깜빡임으로 이완이 완벽합니다.</p>`;
    } else if (score >= 70) {
        scoreAssessment = `<p>🎯 <strong>좋은 깜빡임</strong>: 자연스러운 깜빡임으로 이완이 잘 되어 있습니다.</p>`;
    } else if (score >= 50) {
        scoreAssessment = `<p>🎯 <strong>보통 깜빡임</strong>: 적절한 깜빡임으로 이완이 어느 정도 되어 있습니다.</p>`;
    } else if (score >= 30) {
        scoreAssessment = `<p>🎯 <strong>부족한 깜빡임</strong>: 깜빡임이 부족하여 이완이 필요합니다.</p>`;
    } else {
        scoreAssessment = `<p>🎯 <strong>매우 부족한 깜빡임</strong>: 깜빡임이 매우 부족하여 심각한 이완이 필요합니다.</p>`;
    }
    
    explanation += `<h4>📊 깜빡임 빈도 평가</h4>`;
    explanation += `<p>${frequencyAssessment}</p>`;
    explanation += scoreAssessment;
    explanation += `</div>`;
    
    explanationDiv.innerHTML = explanation;
}

// ===== 자세 상세 정보 팝업 =====
function showPostureDetails() {
    const popup = document.getElementById('posture-details-popup');
    if (popup) {
        popup.classList.add('active');
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
    if (!currentPostureData) {
        document.getElementById('posture-main-value').textContent = '데이터 없음';
        document.getElementById('posture-score-value').textContent = '0%';
        document.getElementById('posture-factors').innerHTML = '<div class="no-data">자세 분석 데이터가 없습니다.</div>';
        document.getElementById('posture-criteria-text').innerHTML = '자세 분석 데이터가 없습니다.';
        document.getElementById('posture-explanation-text').innerHTML = '자세 분석 데이터가 없습니다.';
        return;
    }
    
    // 주요 정보 업데이트
    const score = currentPostureData.score;
    let postureStatus = '보통';
    if (score >= 80) postureStatus = '우수';
    else if (score >= 60) postureStatus = '양호';
    else if (score < 40) postureStatus = '개선 필요';
    
    document.getElementById('posture-main-value').textContent = postureStatus;
    document.getElementById('posture-score-value').textContent = `${score}%`;
    
    // 분석 요소 업데이트
    updatePostureFactorsInfo();
    
    // 평가 기준 업데이트
    updatePostureCriteriaInfo();
    
    // 점수 계산 근거 업데이트
    updatePostureExplanationInfo();
}

function updatePostureFactorsInfo() {
    const factorsDiv = document.getElementById('posture-factors');
    
    // 자세 분석에 사용되는 요소들
    const factorInfo = [
        { name: '목 자세', value: '40%', description: '목의 각도와 거북목 정도' },
        { name: '어깨 균형', value: '30%', description: '어깨의 높이와 기울기' },
        { name: '정면 자세', value: '20%', description: '얼굴이 정면을 향하는 정도' },
        { name: '자세 안정성', value: '10%', description: '자세의 지속적 유지' },
        { name: '목 랜드마크', value: '6개', description: '목과 턱선을 구성하는 랜드마크' },
        { name: '어깨 랜드마크', value: '4개', description: '어깨 위치를 추정하는 랜드마크' }
    ];
    
    let html = '';
    factorInfo.forEach(item => {
        html += `
            <div class="factor-item">
                <div class="factor-name">${item.name}</div>
                <div class="factor-value">${item.value}</div>
                <div class="factor-description">${item.description}</div>
            </div>
        `;
    });
    
    factorsDiv.innerHTML = html;
}

function updatePostureCriteriaInfo() {
    const criteriaDiv = document.getElementById('posture-criteria-text');
    
    const criteria = `
        <div class="criteria-section">
            <h4>🎯 자세 평가 기준</h4>
            <ul>
                <li><strong>목 자세 (40%)</strong>: 목의 각도와 거북목 정도</li>
                <li><strong>어깨 균형 (30%)</strong>: 어깨의 높이와 기울기</li>
                <li><strong>정면 자세 (20%)</strong>: 얼굴이 정면을 향하는 정도</li>
                <li><strong>자세 안정성 (10%)</strong>: 자세의 지속적 유지</li>
            </ul>
            
            <h4>✨ 자세 분석 방법</h4>
            <ul>
                <li><strong>목 각도 측정</strong>: 코와 귀 중심점을 이용한 목 각도 계산</li>
                <li><strong>거북목 감지</strong>: 앞으로 내민 머리 비율 계산</li>
                <li><strong>어깨 기울기</strong>: 얼굴 측면 랜드마크로 어깨 위치 추정</li>
                <li><strong>정면성 판단</strong>: 얼굴이 화면 중앙을 향하는 정도</li>
            </ul>
            
            <h4>📊 점수 기준</h4>
            <ul>
                <li><strong>90-100점</strong>: 매우 우수한 자세 (완벽한 자세)</li>
                <li><strong>70-89점</strong>: 우수한 자세 (좋은 자세)</li>
                <li><strong>50-69점</strong>: 보통 자세 (일반적인 자세)</li>
                <li><strong>30-49점</strong>: 개선이 필요한 자세 (자세 교정 필요)</li>
                <li><strong>0-29점</strong>: 매우 개선이 필요한 자세 (심각한 자세 문제)</li>
            </ul>
        </div>
    `;
    
    criteriaDiv.innerHTML = criteria;
}

function updatePostureExplanationInfo() {
    const explanationDiv = document.getElementById('posture-explanation-text');
    
    if (!currentPostureData) {
        explanationDiv.innerHTML = '자세 분석 데이터가 없습니다.';
        return;
    }
    
    const { neckAnalysis, shoulderAnalysis, score } = currentPostureData;
    
    let explanation = `<div class="explanation-section">`;
    explanation += `<h4>📈 현재 분석 결과</h4>`;
    explanation += `<ul>`;
    
    if (neckAnalysis) {
        explanation += `<li><strong>목 각도</strong>: ${neckAnalysis.neckAngle?.toFixed(1) || 'N/A'}도</li>`;
        explanation += `<li><strong>거북목 비율</strong>: ${(neckAnalysis.forwardHeadRatio * 100).toFixed(1) || 'N/A'}%</li>`;
        explanation += `<li><strong>목 점수</strong>: ${neckAnalysis.postureScore || 'N/A'}점</li>`;
    }
    
    if (shoulderAnalysis) {
        explanation += `<li><strong>어깨 기울기</strong>: ${shoulderAnalysis.shoulderTilt?.toFixed(1) || 'N/A'}도</li>`;
        explanation += `<li><strong>어깨 점수</strong>: ${shoulderAnalysis.shoulderPostureScore || 'N/A'}점</li>`;
    }
    
    explanation += `<li><strong>최종 점수</strong>: ${score}점</li>`;
    explanation += `</ul>`;
    
    // 점수 해석
    if (score >= 90) {
        explanation += `<p>🎯 <strong>완벽한 자세</strong>: 목과 어깨가 매우 바르게 정렬되어 있습니다.</p>`;
    } else if (score >= 70) {
        explanation += `<p>🎯 <strong>우수한 자세</strong>: 목과 어깨가 바르게 정렬되어 있습니다.</p>`;
    } else if (score >= 50) {
        explanation += `<p>🎯 <strong>보통 자세</strong>: 목과 어깨가 어느 정도 바르게 정렬되어 있습니다.</p>`;
    } else if (score >= 30) {
        explanation += `<p>🎯 <strong>개선이 필요한 자세</strong>: 목이나 어깨 자세에 개선이 필요합니다.</p>`;
    } else {
        explanation += `<p>🎯 <strong>매우 개선이 필요한 자세</strong>: 목과 어깨 자세에 심각한 개선이 필요합니다.</p>`;
    }
    
    explanation += `</div>`;
    
    explanationDiv.innerHTML = explanation;
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
