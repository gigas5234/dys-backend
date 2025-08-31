/**
 * 팝업 관리자 모듈
 * 모든 상세 정보 팝업의 관리와 데이터 처리를 담당
 */

// 전역 데이터 변수들 (UI-only mode)
let currentExpressionData = null;
// MediaPipe-related data variables removed for UI-only mode

/**
 * 데이터 동기화 상태 확인
 */
function checkPopupDataSync() {
    const syncStatus = {
        expressionData: !!window.currentExpressionData,
        gazeData: !!window.currentGazeData,
        concentrationData: !!window.currentConcentrationData,
        blinkingData: !!window.currentBlinkingData,
        postureData: !!window.currentPostureData,
        mediaPipeScores: !!(window.mediaPipeAnalyzer && window.mediaPipeAnalyzer.currentMediaPipeScores)
    };
    
    console.log(`📊 [POPUP_SYNC] 팝업 데이터 동기화 상태:`, syncStatus);
    return syncStatus;
}

/**
 * 강제 팝업 데이터 동기화
 */
function forcePopupDataSync() {
    console.log("🔄 [POPUP_SYNC] 강제 팝업 데이터 동기화 시작");
    
    if (!window.mediaPipeAnalyzer || !window.mediaPipeAnalyzer.currentMediaPipeScores) {
        console.warn("⚠️ [POPUP_SYNC] MediaPipe 점수가 없음");
        return false;
    }
    
    // 모든 팝업 데이터 강제 업데이트
    window.mediaPipeAnalyzer.updateAllPopupData(window.mediaPipeAnalyzer.currentMediaPipeScores);
    
    console.log("✅ [POPUP_SYNC] 강제 팝업 데이터 동기화 완료");
    return true;
}

/**
 * DOM 요소 존재 확인 및 복구
 */
function checkAndRepairPopupDOM() {
    const requiredElements = [
        'expression-main-value', 'expression-confidence-value', 'expression-probabilities',
        'gaze-main-value', 'gaze-confidence-value', 'gaze-direction-info',
        'concentration-main-value', 'concentration-confidence-value', 'concentration-factors',
        'blinking-main-value', 'blinking-confidence-value', 'blinking-rate-info',
        'posture-main-value', 'posture-confidence-value', 'posture-stability-info'
    ];
    
    const missingElements = [];
    
    for (const elementId of requiredElements) {
        const element = document.getElementById(elementId);
        if (!element) {
            missingElements.push(elementId);
        }
    }
    
    if (missingElements.length > 0) {
        console.warn(`⚠️ [POPUP_DOM] 누락된 팝업 요소들:`, missingElements);
        return false;
    }
    
    console.log("✅ [POPUP_DOM] 모든 팝업 요소 존재 확인");
    return true;
}

// ===== 표정 상세 정보 팝업 (구버전 - simple-popup-manager.js로 대체됨) =====
function showExpressionDetails_OLD() {
    console.log("⚠️ [구팝업] 구버전 팝업 함수 호출됨 - simple-popup-manager.js 사용 권장");
    
    // 새로운 팝업 관리자가 있으면 그것을 사용
    if (window.showExpressionDetails && window.showExpressionDetails !== showExpressionDetails_OLD) {
        console.log("🔄 [구팝업] 새로운 팝업 관리자로 리다이렉트");
        window.showExpressionDetails();
        return;
    }
    
    const popup = document.getElementById('expression-details-popup');
    if (popup) {
        popup.classList.add('active');
        console.log("✅ [구팝업] 구버전 팝업 DOM 활성화");
        
        // 현재 데이터 상태 확인
        console.log("🔍 [구팝업] 현재 window.currentExpressionData:", window.currentExpressionData);
        
        // 팝업 내용 업데이트
        updateExpressionPopupContent();
        console.log("✅ [구팝업] 구버전 팝업 내용 업데이트 완료");
    } else {
        console.error("❌ [구팝업] expression-details-popup DOM 요소를 찾을 수 없음");
    }
}

function closeExpressionDetails() {
    const popup = document.getElementById('expression-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateExpressionPopupContent() {
    // 서버 MLflow 모델 분석 결과 우선 사용
    let expressionData = window.currentExpressionData;
    
    if (!expressionData && window.mediaPipeAnalyzer && window.mediaPipeAnalyzer.currentMediaPipeScores) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores;
        const expressionScore = currentScores.expression || 0;
        
        // 서버 MLflow 모델의 8가지 감정 분석 결과 우선 사용
        if (expressionData?.serverAnalysis?.model_scores?.all_scores) {
            expressionData = {
                expression: expressionData.serverAnalysis.model_scores.emotion || 'neutral',
                confidence: expressionData.serverAnalysis.model_scores.confidence || 0.8,
                score: {
                    score: expressionData.weightedScore || expressionScore,
                    label: getScoreLabel(expressionData.weightedScore || expressionScore)
                },
                probabilities: expressionData.serverAnalysis.model_scores.all_scores,
                weightedScore: expressionData.weightedScore || expressionScore,
                lastUpdate: new Date().toISOString(),
                isRealTime: true,
                source: 'MLflow 모델'
            };
        } else {
            // 서버 분석 결과가 없으면 기본값 사용
            expressionData = {
                expression: 'neutral',
                confidence: 0.8,
                score: {
                    score: expressionScore,
                    label: getScoreLabel(expressionScore)
                },
                probabilities: {
                    happy: 0.125, sad: 0.125, angry: 0.125, surprised: 0.125,
                    fearful: 0.125, disgusted: 0.125, neutral: 0.125, contempt: 0.125
                },
                weightedScore: expressionScore,
                lastUpdate: new Date().toISOString(),
                isRealTime: true,
                source: '기본값'
            };
        }
        
        // 전역 변수에 저장
        window.currentExpressionData = expressionData;
        
        console.log("📊 [팝업] 표정 데이터 업데이트:", expressionData);
    }
    
    // 서버 MLflow 모델 결과가 없으면 대기 상태 표시
    if (!expressionData || !expressionData.weightedScore || expressionData.weightedScore <= 0) {
        document.getElementById('expression-main-value').textContent = '분석 대기 중...';
        document.getElementById('expression-confidence-value').textContent = '0.00000';
        document.getElementById('expression-probabilities').innerHTML = '<div class="no-data">서버 MLflow 모델 분석 대기 중...</div>';
        document.getElementById('expression-explanation-text').innerHTML = '서버 MLflow 모델 분석 대기 중...';
        console.log("⏳ [팝업] 서버 분석 결과 대기 중...");
        return;
    }
    
    // 주요 정보 업데이트
        const expression = expressionData.expression;
    const confidence = expressionData.confidence;
    const weightedScore = expressionData.weightedScore || expressionData.datingScore || expressionData.score?.score || 0;

    // 메인 값: 가중 평균 점수 표시 (서버 80% + MediaPipe 20%)
    document.getElementById('expression-main-value').textContent = `${weightedScore}점`;
    
    // 신뢰도: 실제 모델 값 표시 (소수점 5자리)
    let confidenceValue = confidence || 0;
    if (typeof confidenceValue === 'number') {
        // 0-100 범위인 경우 0-1로 정규화
        if (confidenceValue > 1) {
            confidenceValue = confidenceValue / 100;
        }
    } else {
        confidenceValue = 0;
    }
    
    const actualConfidence = confidenceValue.toFixed(5);  // 실제 모델 값
    document.getElementById('expression-confidence-value').textContent = actualConfidence;
    
    // 확률 정보 업데이트
    updateExpressionProbabilities();
    
    // 설명 업데이트
    document.getElementById('expression-explanation-text').innerHTML = generateExpressionExplanation();
    
    // 실시간 데이터 표시
    if (expressionData.isRealTime) {
        console.log("✅ [팝업] 실시간 표정 데이터 표시 완료");
    }
}

function updateExpressionProbabilities() {
    const probabilitiesDiv = document.getElementById('expression-probabilities');
    
    // 서버 MLflow 모델 분석 결과 우선 사용
    let expressionData = window.currentExpressionData;
    
    if (!expressionData && window.mediaPipeAnalyzer && window.mediaPipeAnalyzer.currentMediaPipeScores) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores;
        
        // 기본값 사용 (서버 분석 결과가 없는 경우)
        expressionData = {
            expression: 'neutral',
            confidence: 0.8,
            score: { score: currentScores.expression || 0, label: getScoreLabel(currentScores.expression || 0) },
            probabilities: {
                happy: 0.125, sad: 0.125, angry: 0.125, surprised: 0.125,
                fearful: 0.125, disgusted: 0.125, neutral: 0.125, contempt: 0.125
            },
            weightedScore: currentScores.expression || 0,
            isRealTime: true,
            source: '기본값'
        };
        
        window.currentExpressionData = expressionData;
        console.log("📊 [팝업] 표정 확률 데이터 업데이트:", expressionData);
    }
    
    // 서버 MLflow 모델의 8가지 감정 분석 결과 사용
    console.log("🔍 [팝업] expressionData 구조:", expressionData);
    
    if (expressionData?.serverAnalysis?.model_scores?.all_scores) {
        expressionData.probabilities = expressionData.serverAnalysis.model_scores.all_scores;
        expressionData.source = 'MLflow 모델';
        expressionData.expression = expressionData.serverAnalysis.model_scores.emotion || expressionData.emotion || 'neutral';
        expressionData.confidence = expressionData.serverAnalysis.model_scores.confidence || expressionData.confidence || 0.8;
        console.log("✅ [팝업] serverAnalysis.model_scores.all_scores 사용");
    } else if (expressionData?.expressionProbabilities) {
        // 전역 변수에 저장된 8가지 감정 분석 결과 사용
        expressionData.probabilities = expressionData.expressionProbabilities;
        expressionData.source = 'MLflow 모델';
        console.log("✅ [팝업] expressionProbabilities 사용");
    } else {
        console.log("❌ [팝업] 감정 확률 데이터를 찾을 수 없음");
        console.log("🔍 [팝업] 사용 가능한 데이터:", {
            hasServerAnalysis: !!expressionData?.serverAnalysis,
            hasModelScores: !!expressionData?.serverAnalysis?.model_scores,
            hasAllScores: !!expressionData?.serverAnalysis?.model_scores?.all_scores,
            hasExpressionProbabilities: !!expressionData?.expressionProbabilities
        });
    }
    
    if (!expressionData?.probabilities) {
        probabilitiesDiv.innerHTML = '<div class="no-data">서버 MLflow 모델 분석 대기 중...</div>';
        return;
    }
    
    const probabilities = expressionData.probabilities;
    let html = '';
    
    // 데이팅 친화적 가중치 정보
    const datingWeights = {
        happy: 1.0,      // 웃음 - 가장 높은 점수
        neutral: 0.8,    // 중립 - 좋은 점수
        surprised: 0.6,  // 놀람 - 중간 점수
        contempt: 0.4,   // 경멸 - 낮은 점수
        fearful: 0.3,    // 두려움 - 낮은 점수
        sad: 0.2,        // 슬픔 - 낮은 점수
        disgusted: 0.1,  // 혐오 - 매우 낮은 점수
        angry: 0.0       // 분노 - 최저 점수
    };
    
    Object.entries(probabilities).forEach(([expression, probability]) => {
        const koreanName = getExpressionKoreanName(expression);
        const actualValue = probability.toFixed(5);  // 실제 모델 값 (소수점 5자리)
        const isHighest = probability === Math.max(...Object.values(probabilities));
        const weight = datingWeights[expression] || 0.5;
        const weightText = weight === 1.0 ? '최고' : weight >= 0.8 ? '높음' : weight >= 0.6 ? '중간' : weight >= 0.4 ? '낮음' : '최저';
        
        html += `
            <div class="probability-item ${isHighest ? 'highest' : ''}">
                <div class="probability-label">
                    ${koreanName}
                    <span class="weight-badge" style="font-size: 10px; color: ${weight >= 0.8 ? '#22c55e' : weight >= 0.6 ? '#eab308' : weight >= 0.4 ? '#f97316' : '#ef4444'};">
                        (${weightText})
                    </span>
                </div>
                <div class="probability-value" style="font-family: monospace; font-size: 12px;">${actualValue}</div>
            </div>
        `;
    });
    
    probabilitiesDiv.innerHTML = html;
    
    if (expressionData.isRealTime) {
        console.log("✅ [팝업] 실시간 표정 확률 표시 완료");
    }
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
    
    const { expression, confidence, score, datingScore } = expressionData;
    const koreanExpression = getExpressionKoreanName(expression);
    
    // 신뢰도 정규화
    let normalizedConfidence = confidence;
    if (typeof confidence === 'number' && confidence > 1) {
        normalizedConfidence = confidence / 100;
    }
    
    // 데이팅 친화적 점수 사용
    const finalScore = datingScore || score?.score || 0;
    
    let explanation = `<div class="explanation-section">`;
    explanation += `<h4>💕 데이팅 친화적 표정 분석</h4>`;
    explanation += `<ul>`;
    explanation += `<li><strong>감지된 표정</strong>: ${koreanExpression}</li>`;
    explanation += `<li><strong>신뢰도</strong>: ${(normalizedConfidence * 100).toFixed(1)}%</li>`;
    explanation += `<li><strong>데이팅 점수</strong>: ${finalScore}점</li>`;
    explanation += `<li><strong>평가</strong>: ${getScoreLabel(finalScore)}</li>`;
    explanation += `</ul>`;
    
    // 가중 평균 점수 해석 (서버 80% + MediaPipe 20%)
    if (finalScore >= 85) {
        explanation += `<p>💖 <strong>매우 매력적인 표정</strong>: 상대방이 매우 좋아할 만한 표정입니다. 웃음과 긍정적인 에너지가 넘칩니다!</p>`;
    } else if (finalScore >= 70) {
        explanation += `<p>😊 <strong>매력적인 표정</strong>: 상대방이 좋아할 만한 표정입니다. 자연스럽고 친근한 느낌을 줍니다.</p>`;
    } else if (finalScore >= 50) {
        explanation += `<p>😐 <strong>중립적인 표정</strong>: 특별히 매력적이지는 않지만 부정적이지도 않은 표정입니다.</p>`;
    } else if (finalScore >= 30) {
        explanation += `<p>😟 <strong>개선이 필요한 표정</strong>: 상대방이 부담스러워할 수 있는 표정입니다. 더 긍정적인 표정을 연습해보세요.</p>`;
    } else {
        explanation += `<p>😞 <strong>매우 부정적인 표정</strong>: 상대방이 기피할 수 있는 표정입니다. 즉시 표정을 개선하는 것이 좋겠습니다.</p>`;
    }
    
    // 분석 방식 설명 추가
    const source = expressionData.source || 'MLflow 모델';
    explanation += `<p><small>💡 <strong>분석 방식</strong>: ${source}을 사용한 정확한 감정 분석 결과입니다.</small></p>`;
    
    // 8가지 표정별 조언
    explanation += `<h4>🎭 표정별 데이팅 조언</h4>`;
    if (expressionData.probabilities) {
        const topExpressions = Object.entries(expressionData.probabilities)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);
        
        explanation += `<ul>`;
        topExpressions.forEach(([exp, prob]) => {
            const koreanName = getExpressionKoreanName(exp);
            const percentage = (prob * 100).toFixed(1);
            const advice = getExpressionAdvice(exp);
            explanation += `<li><strong>${koreanName} (${percentage}%)</strong>: ${advice}</li>`;
        });
        explanation += `</ul>`;
    }
    
    explanation += `</div>`;
    
    return explanation;
}

function getExpressionAdvice(expression) {
    const advice = {
        happy: "완벽합니다! 웃음은 가장 매력적인 표정입니다. 이 상태를 유지하세요.",
        neutral: "괜찮습니다. 하지만 약간의 미소를 더하면 더 매력적일 것입니다.",
        surprised: "놀란 표정은 귀여울 수 있지만, 너무 과하면 부자연스러워 보일 수 있습니다.",
        contempt: "경멸적인 표정은 피하는 것이 좋습니다. 더 친근한 표정을 연습해보세요.",
        fearful: "두려운 표정은 상대방에게 부담을 줄 수 있습니다. 안정감을 표현해보세요.",
        sad: "슬픈 표정은 상대방을 우울하게 만들 수 있습니다. 긍정적인 생각을 해보세요.",
        disgusted: "혐오스러운 표정은 절대 피해야 합니다. 즉시 표정을 바꿔주세요.",
        angry: "화난 표정은 상대방을 겁주거나 기피하게 만듭니다. 진정하고 긍정적인 표정을 연습하세요."
    };
    return advice[expression] || "표정을 개선해보세요.";
}

// ===== 시선 안정성 상세 정보 팝업 (UI-only mode) =====
function showGazeDetails() {
    const popup = document.getElementById('gaze-details-popup');
    if (popup) {
        popup.classList.add('active');
        
        // DOM 상태 확인
        const domOk = checkAndRepairPopupDOM();
        if (!domOk) {
            console.warn("⚠️ [POPUP] DOM 상태 문제로 팝업 업데이트 제한");
        }
        
        // 데이터 동기화 확인
        const syncOk = checkPopupDataSync();
        if (!syncOk.gazeData) {
            console.warn("⚠️ [POPUP] 시선 데이터가 없어서 강제 동기화 시도");
            forcePopupDataSync();
        }
        
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
    // 실제 MediaPipe 데이터 사용
    let gazeData = window.currentGazeData;
    
    // MediaPipe 분석기에서 실시간 데이터 가져오기
    if (window.mediaPipeAnalyzer && window.mediaPipeAnalyzer.currentMediaPipeScores) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores;
        const gazeScore = currentScores.gaze || 0;
        
        // 실제 MediaPipe 시선 데이터 사용
        if (window.currentGazeData && window.currentGazeData.isRealTime) {
            gazeData = window.currentGazeData;
        } else {
            // 폴백 데이터 생성
            gazeData = {
                score: gazeScore,
                label: getScoreLabel(gazeScore),
                gazeDirection: {
                    x: 0.5,
                    y: 0.53,
                    distance: 0.184,
                    status: gazeScore >= 85 ? '중앙' : gazeScore >= 70 ? '중간' : '외곽'
                },
                eyeCenter: {
                    left: { x: 0.4, y: 0.5 },
                    right: { x: 0.6, y: 0.5 }
                },
                lastUpdate: new Date().toISOString(),
                isRealTime: true
            };
            
            // 전역 변수에 저장
            window.currentGazeData = gazeData;
        }
        
        console.log("📊 [팝업] 실제 MediaPipe 시선 데이터 사용:", gazeData);
    }
    
    if (!gazeData) {
        document.getElementById('gaze-main-value').textContent = '분석 대기 중...';
        document.getElementById('gaze-stability-value').textContent = '0%';
        return;
    }
    
    // 시선 상태 업데이트
    const mainValueEl = document.getElementById('gaze-main-value');
    if (mainValueEl) {
        mainValueEl.textContent = gazeData.label;
    }
    
    // 시선 안정성 점수 업데이트
    const stabilityEl = document.getElementById('gaze-stability-value');
    if (stabilityEl) {
        stabilityEl.textContent = `${gazeData.score}%`;
    }
    
    // 시선 방향 업데이트 (있는 경우)
    const directionEl = document.getElementById('gaze-direction-value');
    if (directionEl) {
        directionEl.textContent = gazeData.gazeDirection.status;
    }
    
    // 실시간 데이터 표시
    if (gazeData.isRealTime) {
        console.log("✅ [팝업] 실시간 시선 데이터 표시 완료");
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
    // 실제 MediaPipe 데이터 사용
    let concentrationData = window.currentConcentrationData;
    
    if (!concentrationData && window.mediaPipeAnalyzer && window.mediaPipeAnalyzer.currentMediaPipeScores) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores;
        const concentrationScore = currentScores.concentration || 0;
        
        // 실제 MediaPipe 집중도 데이터 사용
        if (window.currentConcentrationData && window.currentConcentrationData.isRealTime) {
            concentrationData = window.currentConcentrationData;
        } else {
            // 폴백 데이터 생성
            concentrationData = {
                score: concentrationScore,
                label: getScoreLabel(concentrationScore),
                factors: {
                    eyeOpenness: concentrationScore * 0.8,
                    headStability: concentrationScore * 0.9,
                    blinkRate: concentrationScore * 0.7
                },
                lastUpdate: new Date().toISOString(),
                isRealTime: true
            };
            
            // 전역 변수에 저장
            window.currentConcentrationData = concentrationData;
        }
        
        console.log("📊 [팝업] 실제 MediaPipe 집중도 데이터 사용:", concentrationData);
    }
    
    if (!concentrationData) {
        document.getElementById('concentration-main-value').textContent = '분석 대기 중...';
        document.getElementById('concentration-score-value').textContent = '0%';
        document.getElementById('concentration-factors').innerHTML = '<div class="no-data">분석 대기 중...</div>';
        document.getElementById('concentration-criteria-text').innerHTML = '분석 대기 중...';
        document.getElementById('concentration-explanation-text').innerHTML = '분석 대기 중...';
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
    
    // 실시간 데이터 표시
    if (concentrationData.isRealTime) {
        console.log("✅ [팝업] 실시간 집중도 데이터 표시 완료");
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
        { name: '시각적 요소', score: categories.visual.average, suggestion: '표정, 시선, 자세, 깜빡임을 개선해보세요.' },
        { name: '청각적 요소', score: categories.auditory.average, suggestion: '톤과 집중도를 개선해보세요.' },
        { name: '대화 요소', score: categories.conversation.score, suggestion: '대화 주도권을 개선해보세요.' }
    ];
    
    return categoryScores.reduce((lowest, current) => 
        current.score < lowest.score ? current : lowest
    );
}

// ===== 자세 상세 정보 팝업 =====
function showPostureDetails() {
    const popup = document.getElementById('posture-details-popup');
    if (popup) {
        popup.classList.add('active');
        
        // DOM 상태 확인
        const domOk = checkAndRepairPopupDOM();
        if (!domOk) {
            console.warn("⚠️ [POPUP] DOM 상태 문제로 팝업 업데이트 제한");
        }
        
        // 데이터 동기화 확인
        const syncOk = checkPopupDataSync();
        if (!syncOk.postureData) {
            console.warn("⚠️ [POPUP] 자세 데이터가 없어서 강제 동기화 시도");
            forcePopupDataSync();
        }
        
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
    // 실제 MediaPipe 데이터 사용
    let postureData = window.currentPostureData;
    
    if (!postureData && window.mediaPipeAnalyzer && window.mediaPipeAnalyzer.currentMediaPipeScores) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores;
        const postureScore = currentScores.posture || 0;
        
        // 실제 MediaPipe 자세 데이터 사용
        if (window.currentPostureData && window.currentPostureData.isRealTime) {
            postureData = window.currentPostureData;
        } else {
            // 폴백 데이터 생성
            postureData = {
                score: postureScore,
                label: getScoreLabel(postureScore),
                stability: {
                    neckAngle: postureScore * 0.8,
                    shoulderLevel: postureScore * 0.9,
                    backCurve: postureScore * 0.7
                },
                lastUpdate: new Date().toISOString(),
                isRealTime: true
            };
            
            // 전역 변수에 저장
            window.currentPostureData = postureData;
        }
        
        console.log("📊 [팝업] 실제 MediaPipe 자세 데이터 사용:", postureData);
    }
    
    if (!postureData) {
        document.getElementById('posture-main-value').textContent = '분석 대기 중...';
        document.getElementById('posture-stability-value').textContent = '측정 중';
        return;
    }
    
    // 자세 상태 업데이트
    const mainValueEl = document.getElementById('posture-main-value');
    if (mainValueEl) {
        mainValueEl.textContent = postureData.label;
    }
    
    // 자세 안정성 업데이트
    const stabilityEl = document.getElementById('posture-stability-value');
    if (stabilityEl) {
        stabilityEl.textContent = `${postureData.score}%`;
    }
}

function updateBlinkingPopupContent() {
    // 실제 MediaPipe 데이터 사용
    let blinkingData = window.currentBlinkingData;
    
    // MediaPipe 분석기에서 실시간 데이터 가져오기
    if (window.mediaPipeAnalyzer && window.mediaPipeAnalyzer.currentMediaPipeScores) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores;
        const blinkingScore = currentScores.blinking || 0;
        
        // 실제 MediaPipe 깜빡임 데이터 사용
        if (window.currentBlinkingData && window.currentBlinkingData.isRealTime) {
            blinkingData = window.currentBlinkingData;
        } else {
            // 깜빡임 통계 데이터 가져오기 (EAR 기반)
            let blinkRate = 15; // 기본값
            let blinkStatus = '정상';
            
            if (window.mediaPipeAnalyzer.blinkHistory && window.mediaPipeAnalyzer.blinkHistory.length > 0) {
                const recentBlinks = window.mediaPipeAnalyzer.blinkHistory.filter(blink => 
                    Date.now() - blink.time < 60000
                );
                blinkRate = recentBlinks.length;
                blinkStatus = blinkRate >= 10 && blinkRate <= 20 ? '정상' : blinkRate < 10 ? '부족' : '과다';
            }
            
            // 폴백 데이터 생성
            blinkingData = {
                score: blinkingScore,
                label: getScoreLabel(blinkingScore),
                rate: {
                    current: blinkRate,
                    normal: 15,
                    status: blinkStatus
                },
                lastUpdate: new Date().toISOString(),
                isRealTime: true
            };
            
            // 전역 변수에 저장
            window.currentBlinkingData = blinkingData;
        }
        
        console.log("📊 [팝업] 실제 MediaPipe 깜빡임 데이터 사용:", blinkingData);
    }
    
    if (!blinkingData) {
        document.getElementById('blinking-main-value').textContent = '분석 대기 중...';
        document.getElementById('blinking-rate-value').textContent = '0회/분';
        return;
    }
    
    // 깜빡임 상태 업데이트
    const mainValueEl = document.getElementById('blinking-main-value');
    if (mainValueEl) {
        mainValueEl.textContent = blinkingData.label;
    }
    
    // 깜빡임 비율 업데이트
    const rateEl = document.getElementById('blinking-rate-value');
    if (rateEl) {
        if (blinkingData.rate && blinkingData.rate.current !== undefined) {
            rateEl.textContent = `${blinkingData.rate.current}회/분 (${blinkingData.rate.status || '정상'})`;
        } else {
            // 가중 평균 점수로 깜빡임 빈도 추정
            const estimatedRate = blinkingData.weightedScore ? Math.round(blinkingData.weightedScore / 5) : 15;
            rateEl.textContent = `${estimatedRate}회/분 (추정)`;
        }
    }
    
    // 실시간 데이터 표시
    if (blinkingData.isRealTime) {
        console.log("✅ [팝업] 실시간 깜빡임 데이터 표시 완료");
    }
}

// ===== 대화 주도권 상세 정보 팝업 =====
function showInitiativeDetails() {
    const popup = document.getElementById('initiative-details-popup');
    if (popup) {
        popup.classList.add('active');
        
        // DOM 상태 확인
        const domOk = checkAndRepairPopupDOM();
        if (!domOk) {
            console.warn("⚠️ [POPUP] DOM 상태 문제로 팝업 업데이트 제한");
        }
        
        // 데이터 동기화 확인
        const syncOk = checkPopupDataSync();
        if (!syncOk.initiativeData) {
            console.warn("⚠️ [POPUP] 대화 주도권 데이터가 없어서 강제 동기화 시도");
            forcePopupDataSync();
        }
        
        // MediaPipe 데이터로 업데이트 (함수가 없을 수 있으므로 안전하게 처리)
        if (window.mediaPipeAnalyzer && typeof window.mediaPipeAnalyzer.updateInitiativePopupOnOpen === 'function') {
            window.mediaPipeAnalyzer.updateInitiativePopupOnOpen();
        } else {
            console.log("⚠️ [팝업] updateInitiativePopupOnOpen 함수를 찾을 수 없습니다");
        }
        
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
    // 실제 MediaPipe 데이터 사용
    let initiativeData = window.currentInitiativeData;
    
    // MediaPipe 분석기에서 실시간 데이터 가져오기
    if (window.mediaPipeAnalyzer && window.mediaPipeAnalyzer.currentMediaPipeScores) {
        const currentScores = window.mediaPipeAnalyzer.currentMediaPipeScores;
        const initiativeScore = currentScores.initiative || 0;
        
        // 가중 평균 점수 우선 사용
        if (initiativeData?.weightedScore !== undefined) {
            initiativeData.score = initiativeData.weightedScore;
        }
        
        // 폴백 데이터 생성
        if (!initiativeData) {
            initiativeData = {
                score: initiativeScore,
                label: getScoreLabel(initiativeScore),
                lastUpdate: new Date().toISOString(),
                isRealTime: true
            };
            
            // 전역 변수에 저장
            window.currentInitiativeData = initiativeData;
        }
        
        console.log("📊 [팝업] 실제 MediaPipe 대화 주도권 데이터 사용:", initiativeData);
    }
    
    if (!initiativeData) {
        document.getElementById('initiative-main-value').textContent = '분석 대기 중...';
        document.getElementById('initiative-status-text').textContent = '대기 중';
        return;
    }
    
    // 대화 주도권 상태 업데이트
    const mainValueEl = document.getElementById('initiative-main-value');
    if (mainValueEl) {
        mainValueEl.textContent = `${initiativeData.score}%`;
    }
    
    // 상태 텍스트 업데이트
    const statusEl = document.getElementById('initiative-status-text');
    if (statusEl) {
        if (initiativeData.isRealTime) {
            statusEl.textContent = '실시간 분석';
            statusEl.style.color = '#22c55e';
        } else {
            statusEl.textContent = 'UI 모드';
            statusEl.style.color = '#ef4444';
        }
    }
    
    // 실시간 데이터 표시
    if (initiativeData.isRealTime) {
        console.log("✅ [팝업] 실시간 대화 주도권 데이터 표시 완료");
    }
}

// 전역 함수로 노출 (HTML에서 직접 호출 가능하도록)
window.showExpressionDetails = showExpressionDetails;
window.closeExpressionDetails = closeExpressionDetails;
window.showGazeDetails = showGazeDetails;
window.closeGazeDetails = closeGazeDetails;
window.showConcentrationDetails = showConcentrationDetails;
window.closeConcentrationDetails = closeConcentrationDetails;
window.showBlinkingDetails = showBlinkingDetails;
window.closeBlinkingDetails = closeBlinkingDetails;
window.showPostureDetails = showPostureDetails;
window.closePostureDetails = closePostureDetails;
window.showComprehensiveScoreDetails = showComprehensiveScoreDetails;
window.closeComprehensiveScoreDetails = closeComprehensiveScoreDetails;
window.showInitiativeDetails = showInitiativeDetails;
window.closeInitiativeDetails = closeInitiativeDetails;