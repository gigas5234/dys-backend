/**
 * 간단하고 명확한 팝업 관리 시스템
 * 복잡한 로직 없이 직접적으로 MLflow 모델 데이터를 표시
 */

// ===== 표정 상세 팝업 =====
function showExpressionDetails() {
    console.log("🔍 [새팝업] 표정 세부 팝업 열기");
    console.log("🔍 [새팝업] 함수 호출 스택:", new Error().stack);
    
    const popup = document.getElementById('expression-details-popup');
    if (!popup) {
        console.error("❌ [새팝업] expression-details-popup을 찾을 수 없음");
        return;
    }
    
    console.log("✅ [새팝업] 팝업 DOM 요소 발견:", popup);
    
    // 팝업 표시
    popup.classList.add('active');
    console.log("✅ [새팝업] 팝업 활성화됨");
    
    // 현재 전역 데이터 상태 확인
    console.log("🔍 [새팝업] 전역 데이터 상태:", {
        hasWindow: typeof window !== 'undefined',
        hasCurrentExpressionData: !!window.currentExpressionData,
        currentExpressionData: window.currentExpressionData
    });
    
    // 즉시 데이터 업데이트
    console.log("🔄 [새팝업] updateExpressionPopupNow 호출 시작");
    updateExpressionPopupNow();
    console.log("✅ [새팝업] updateExpressionPopupNow 호출 완료");
}

function closeExpressionDetails() {
    const popup = document.getElementById('expression-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateExpressionPopupNow() {
    console.log("🔄 [새팝업] 표정 데이터 업데이트 시작");
    
    // 현재 표정 데이터 확인
    const expressionData = window.currentExpressionData;
    console.log("🔍 [새팝업] 현재 expressionData:", expressionData);
    
    // 서버 분석 결과 직접 확인
    const serverResults = window.mediaPipeAnalyzer?.serverAnalysisResults;
    console.log("🔍 [새팝업] 서버 분석 결과:", serverResults);
    
    // DOM 요소들 확인
    const mainValue = document.getElementById('expression-main-value');
    const confidenceValue = document.getElementById('expression-confidence-value');
    const probabilities = document.getElementById('expression-probabilities');
    const explanation = document.getElementById('expression-explanation-text');
    
    if (!mainValue || !confidenceValue || !probabilities || !explanation) {
        console.error("❌ [새팝업] 필수 DOM 요소들을 찾을 수 없음");
        return;
    }
    
                // 서버 MLflow 모델 데이터가 있는지 확인
    console.log("🔍 [새팝업] 데이터 상세 분석:", {
        hasExpressionData: !!expressionData,
        weightedScore: expressionData?.weightedScore,
        confidence: expressionData?.confidence,
        hasExpressionProbabilities: !!expressionData?.expressionProbabilities,
        hasServerAnalysis: !!expressionData?.serverAnalysis,
        hasModelScores: !!expressionData?.serverAnalysis?.model_scores,
        hasAllScores: !!expressionData?.serverAnalysis?.model_scores?.all_scores
    });
    
    // 서버 분석 결과 직접 사용 (가중치 계산 우회)
    if (serverResults && serverResults.success && serverResults.model_scores) {
        console.log("✅ [새팝업] 서버 분석 결과 직접 사용");
        
        const modelScores = serverResults.model_scores;
        const confidence = modelScores.confidence || 0;
        const expression = modelScores.expression || (confidence * 100);
        
        // 메인 점수 표시 (서버 결과 직접 사용)
        mainValue.textContent = `${Math.round(expression)}점`;
        
        // 신뢰도 표시 (실제 값)
        confidenceValue.textContent = confidence.toFixed(5);
        
        // 8가지 감정 확률 표시 (서버 결과 직접 사용)
        if (modelScores.all_scores) {
            displayEmotionProbabilities(modelScores.all_scores, probabilities);
        } else {
            probabilities.innerHTML = '<div class="no-data">감정 확률 데이터 없음</div>';
        }
        
        // 설명 텍스트 (서버 결과 기반)
        const mockExpressionData = {
            weightedScore: Math.round(expression),
            confidence: confidence,
            emotion: serverResults.model_emotion || 'neutral'
        };
        explanation.innerHTML = generateSimpleExplanation(mockExpressionData);
        
    } else if (expressionData && (expressionData.weightedScore > 0 || expressionData.confidence > 0)) {
        console.log("✅ [새팝업] 전역 변수 데이터 사용");
        
        // 메인 점수 표시
        mainValue.textContent = `${expressionData.weightedScore}점`;
        
        // 신뢰도 표시 (실제 값)
        const confidence = expressionData.confidence || 0;
        confidenceValue.textContent = confidence.toFixed(5);
        
        // 8가지 감정 확률 표시
        if (expressionData.expressionProbabilities) {
            displayEmotionProbabilities(expressionData.expressionProbabilities, probabilities);
        } else if (expressionData.serverAnalysis?.model_scores?.all_scores) {
            displayEmotionProbabilities(expressionData.serverAnalysis.model_scores.all_scores, probabilities);
        } else {
            probabilities.innerHTML = '<div class="no-data">감정 확률 데이터 없음</div>';
        }
        
        // 설명 텍스트
        explanation.innerHTML = generateSimpleExplanation(expressionData);
        
    } else {
        console.log("⏳ [새팝업] 서버 분석 대기 중");
        
        // 대기 상태 표시
        mainValue.textContent = '분석 대기 중...';
        confidenceValue.textContent = '0.00000';
        probabilities.innerHTML = '<div class="no-data">서버 MLflow 모델 분석 대기 중...</div>';
        explanation.innerHTML = '서버에서 AI 모델 분석 중입니다. 잠시만 기다려주세요.';
    }
}

function displayEmotionProbabilities(emotions, container) {
    console.log("🎭 [새팝업] 감정 확률 표시:", emotions);
    
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
    
    let html = '';
    
    // 감정 확률을 높은 순으로 정렬
    const sortedEmotions = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
    
    sortedEmotions.forEach(([emotion, probability]) => {
        const koreanName = koreanNames[emotion] || emotion;
        const actualValue = probability.toFixed(5);
        const isHighest = probability === Math.max(...Object.values(emotions));
        const weight = datingWeights[emotion] || 0.5;
        const weightText = weight === 1.0 ? '최고' : weight >= 0.8 ? '높음' : weight >= 0.6 ? '중간' : weight >= 0.4 ? '낮음' : '최저';
        const weightColor = weight >= 0.8 ? '#22c55e' : weight >= 0.6 ? '#eab308' : weight >= 0.4 ? '#f97316' : '#ef4444';
        
        html += `
            <div class="probability-item ${isHighest ? 'highest' : ''}" style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; border-radius: 4px; background: ${isHighest ? '#f0f9ff' : '#f9fafb'};">
                <div class="probability-label" style="font-weight: ${isHighest ? 'bold' : 'normal'};">
                    ${koreanName}
                    <span style="font-size: 10px; color: ${weightColor}; margin-left: 4px;">(${weightText})</span>
                </div>
                <div class="probability-value" style="font-family: monospace; font-size: 12px; color: ${isHighest ? '#1e40af' : '#6b7280'};">
                    ${actualValue}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log("✅ [새팝업] 감정 확률 표시 완료");
}

function generateSimpleExplanation(expressionData) {
    const score = expressionData.weightedScore || 0;
    const emotion = expressionData.emotion || 'neutral';
    const confidence = expressionData.confidence || 0;
    
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
    
    const emotionKorean = koreanNames[emotion] || emotion;
    
    let explanation = `<div style="line-height: 1.6;">`;
    explanation += `<h4 style="margin: 0 0 12px 0; color: #1f2937;">📊 AI 모델 분석 결과</h4>`;
    
    explanation += `<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px;">`;
    explanation += `<p style="margin: 4px 0;"><strong>감지된 감정:</strong> ${emotionKorean}</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>신뢰도:</strong> ${confidence.toFixed(3)}</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>최종 점수:</strong> ${score}점</p>`;
    explanation += `</div>`;
    
    // 점수 해석
    if (score >= 80) {
        explanation += `<p style="color: #059669; margin: 8px 0;">🎯 <strong>매우 좋은 표정!</strong> 데이팅에 매우 긍정적인 인상을 줍니다.</p>`;
    } else if (score >= 60) {
        explanation += `<p style="color: #0891b2; margin: 8px 0;">😊 <strong>좋은 표정!</strong> 데이팅에 좋은 인상을 줍니다.</p>`;
    } else if (score >= 40) {
        explanation += `<p style="color: #d97706; margin: 8px 0;">😐 <strong>보통 표정</strong> 조금 더 밝은 표정을 지어보세요.</p>`;
    } else {
        explanation += `<p style="color: #dc2626; margin: 8px 0;">😔 <strong>개선이 필요한 표정</strong> 더 밝고 긍정적인 표정을 지어보세요.</p>`;
    }
    
    explanation += `<div style="background: #fef3c7; padding: 8px; border-radius: 6px; margin-top: 12px; font-size: 13px;">`;
    explanation += `<strong>💡 분석 방식:</strong> 구글 스토리지의 MLflow AI 모델을 사용한 실시간 감정 분석`;
    explanation += `</div>`;
    
    explanation += `</div>`;
    
    return explanation;
}

// ===== 시선 안정성 상세 팝업 =====
function showGazeDetails() {
    console.log("🔍 [새팝업] 시선 안정성 세부 팝업 열기");
    
    const popup = document.getElementById('gaze-details-popup');
    if (!popup) {
        console.error("❌ [새팝업] gaze-details-popup을 찾을 수 없음");
        return;
    }
    
    popup.classList.add('active');
    updateGazePopupNow();
}

function closeGazeDetails() {
    const popup = document.getElementById('gaze-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateGazePopupNow() {
    console.log("🔄 [새팝업] 시선 데이터 업데이트 시작");
    
    const gazeData = window.currentGazeData;
    console.log("🔍 [새팝업] 현재 gazeData:", gazeData);
    
    const mainValue = document.getElementById('gaze-main-value');
    const statusValue = document.getElementById('gaze-status-value');
    const positionValue = document.getElementById('gaze-position-value');
    const explanationText = document.getElementById('gaze-explanation-text');
    
    if (!mainValue) {
        console.error("❌ [새팝업] 시선 팝업 DOM 요소들을 찾을 수 없음");
        return;
    }
    
    if (gazeData && gazeData.weightedScore > 0) {
        console.log("✅ [새팝업] 시선 데이터 사용");
        
        mainValue.textContent = `${gazeData.weightedScore}%`;
        
        if (statusValue) {
            const status = gazeData.gazeDirection?.status || '중간';
            statusValue.textContent = status;
        }
        
        if (positionValue) {
            const x = gazeData.gazeDirection?.x || 0.5;
            const y = gazeData.gazeDirection?.y || 0.5;
            const distance = gazeData.gazeDirection?.distance || 0.1;
            positionValue.textContent = `(${x.toFixed(3)}, ${y.toFixed(3)}) 거리: ${distance.toFixed(3)}`;
        }
        
        if (explanationText) {
            explanationText.innerHTML = generateGazeExplanation(gazeData);
        }
        
    } else {
        console.log("⏳ [새팝업] 시선 분석 대기 중");
        
        if (mainValue) mainValue.textContent = '분석 대기 중...';
        if (statusValue) statusValue.textContent = '-';
        if (positionValue) positionValue.textContent = '-';
        if (explanationText) explanationText.innerHTML = '시선 분석이 비활성화되어 있습니다.';
    }
}

function generateGazeExplanation(gazeData) {
    const score = gazeData.weightedScore || 0;
    const status = gazeData.gazeDirection?.status || '중간';
    const distance = gazeData.gazeDirection?.distance || 0.1;
    
    let explanation = `<div style="line-height: 1.6;">`;
    explanation += `<h4 style="margin: 0 0 12px 0; color: #1f2937;">👀 시선 안정성 분석</h4>`;
    
    explanation += `<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px;">`;
    explanation += `<p style="margin: 4px 0;"><strong>시선 상태:</strong> ${status}</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>중앙 거리:</strong> ${distance.toFixed(3)}</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>안정성 점수:</strong> ${score}%</p>`;
    explanation += `</div>`;
    
    if (score >= 85) {
        explanation += `<p style="color: #059669; margin: 8px 0;">👁️ <strong>매우 안정적인 시선!</strong> 상대방에게 집중하고 있어 좋은 인상을 줍니다.</p>`;
    } else if (score >= 70) {
        explanation += `<p style="color: #0891b2; margin: 8px 0;">😊 <strong>좋은 시선!</strong> 대체로 안정적인 시선을 유지하고 있습니다.</p>`;
    } else if (score >= 50) {
        explanation += `<p style="color: #d97706; margin: 8px 0;">😐 <strong>보통 시선</strong> 조금 더 집중해서 상대방을 바라보세요.</p>`;
    } else {
        explanation += `<p style="color: #dc2626; margin: 8px 0;">😔 <strong>불안정한 시선</strong> 상대방의 눈을 보며 대화하는 것이 좋습니다.</p>`;
    }
    
    explanation += `<div style="background: #fef3c7; padding: 8px; border-radius: 6px; margin-top: 12px; font-size: 13px;">`;
    explanation += `<strong>💡 개선 팁:</strong> 화면 중앙을 자연스럽게 응시하면 높은 점수를 받을 수 있습니다.`;
    explanation += `</div>`;
    
    explanation += `</div>`;
    return explanation;
}

// ===== 집중도 상세 팝업 =====
function showConcentrationDetails() {
    console.log("🔍 [새팝업] 집중도 세부 팝업 열기");
    
    const popup = document.getElementById('concentration-details-popup');
    if (!popup) {
        console.error("❌ [새팝업] concentration-details-popup을 찾을 수 없음");
        return;
    }
    
    popup.classList.add('active');
    updateConcentrationPopupNow();
}

function closeConcentrationDetails() {
    const popup = document.getElementById('concentration-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateConcentrationPopupNow() {
    console.log("🔄 [새팝업] 집중도 데이터 업데이트 시작");
    
    const concentrationData = window.currentConcentrationData;
    console.log("🔍 [새팝업] 현재 concentrationData:", concentrationData);
    
    const mainValue = document.getElementById('concentration-main-value');
    const factorsDiv = document.getElementById('concentration-factors');
    const explanationText = document.getElementById('concentration-explanation-text');
    
    if (!mainValue) {
        console.error("❌ [새팝업] 집중도 팝업 DOM 요소들을 찾을 수 없음");
        return;
    }
    
    if (concentrationData && concentrationData.weightedScore > 0) {
        console.log("✅ [새팝업] 집중도 데이터 사용");
        
        mainValue.textContent = `${concentrationData.weightedScore}%`;
        
        if (factorsDiv) {
            const factors = concentrationData.factors || {
                gazeStability: 70,
                blinkingPattern: 80,
                headPosture: 75
            };
            
            let factorsHtml = '';
            factorsHtml += `<div style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; background: #f9fafb; border-radius: 4px;">`;
            factorsHtml += `<span>시선 안정성:</span><span style="font-weight: bold;">${factors.gazeStability}%</span>`;
            factorsHtml += `</div>`;
            factorsHtml += `<div style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; background: #f9fafb; border-radius: 4px;">`;
            factorsHtml += `<span>깜빡임 패턴:</span><span style="font-weight: bold;">${factors.blinkingPattern}%</span>`;
            factorsHtml += `</div>`;
            factorsHtml += `<div style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; background: #f9fafb; border-radius: 4px;">`;
            factorsHtml += `<span>머리 자세:</span><span style="font-weight: bold;">${factors.headPosture}%</span>`;
            factorsHtml += `</div>`;
            
            factorsDiv.innerHTML = factorsHtml;
        }
        
        if (explanationText) {
            explanationText.innerHTML = generateConcentrationExplanation(concentrationData);
        }
        
    } else {
        console.log("⏳ [새팝업] 집중도 분석 대기 중");
        
        if (mainValue) mainValue.textContent = '분석 대기 중...';
        if (factorsDiv) factorsDiv.innerHTML = '<div class="no-data">분석 대기 중...</div>';
        if (explanationText) explanationText.innerHTML = '집중도 분석이 비활성화되어 있습니다.';
    }
}

function generateConcentrationExplanation(concentrationData) {
    const score = concentrationData.weightedScore || 0;
    
    let explanation = `<div style="line-height: 1.6;">`;
    explanation += `<h4 style="margin: 0 0 12px 0; color: #1f2937;">🧠 집중도 분석 결과</h4>`;
    
    explanation += `<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px;">`;
    explanation += `<p style="margin: 4px 0;"><strong>종합 집중도:</strong> ${score}%</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>분석 방식:</strong> 시선(50%) + 깜빡임(30%) + 머리자세(20%)</p>`;
    explanation += `</div>`;
    
    if (score >= 85) {
        explanation += `<p style="color: #059669; margin: 8px 0;">🎯 <strong>매우 높은 집중도!</strong> 상대방에게 완전히 집중하고 있어 매우 좋은 인상을 줍니다.</p>`;
    } else if (score >= 70) {
        explanation += `<p style="color: #0891b2; margin: 8px 0;">😊 <strong>좋은 집중도!</strong> 대화에 집중하고 있어 좋은 인상을 줍니다.</p>`;
    } else if (score >= 50) {
        explanation += `<p style="color: #d97706; margin: 8px 0;">😐 <strong>보통 집중도</strong> 조금 더 상대방에게 집중해보세요.</p>`;
    } else {
        explanation += `<p style="color: #dc2626; margin: 8px 0;">😔 <strong>집중도 부족</strong> 상대방을 바라보며 대화에 더 집중해보세요.</p>`;
    }
    
    explanation += `</div>`;
    return explanation;
}

// ===== 깜빡임 상세 팝업 =====
function showBlinkingDetails() {
    console.log("🔍 [새팝업] 깜빡임 세부 팝업 열기");
    
    const popup = document.getElementById('blinking-details-popup');
    if (!popup) {
        console.error("❌ [새팝업] blinking-details-popup을 찾을 수 없음");
        return;
    }
    
    popup.classList.add('active');
    updateBlinkingPopupNow();
}

function closeBlinkingDetails() {
    const popup = document.getElementById('blinking-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateBlinkingPopupNow() {
    console.log("🔄 [새팝업] 깜빡임 데이터 업데이트 시작");
    
    const blinkingData = window.currentBlinkingData;
    console.log("🔍 [새팝업] 현재 blinkingData:", blinkingData);
    
    const mainValue = document.getElementById('blinking-main-value');
    const statusValue = document.getElementById('blinking-status-value');
    const rateValue = document.getElementById('blinking-rate-value');
    const explanationText = document.getElementById('blinking-explanation-text');
    
    if (!mainValue) {
        console.error("❌ [새팝업] 깜빡임 팝업 DOM 요소들을 찾을 수 없음");
        return;
    }
    
    if (blinkingData && blinkingData.weightedScore > 0) {
        console.log("✅ [새팝업] 깜빡임 데이터 사용");
        
        mainValue.textContent = `${blinkingData.weightedScore}%`;
        
        if (statusValue) {
            const status = blinkingData.blinkStatus || 'open';
            statusValue.textContent = status === 'open' ? '뜸' : status === 'closed' ? '감음' : '깜빡임';
        }
        
        if (rateValue) {
            const rate = blinkingData.rate?.current || blinkingData.blinkRatePerMinute || 0;
            rateValue.textContent = `분당 ${rate}회`;
        }
        
        if (explanationText) {
            explanationText.innerHTML = generateBlinkingExplanation(blinkingData);
        }
        
    } else {
        console.log("⏳ [새팝업] 깜빡임 분석 대기 중");
        
        if (mainValue) mainValue.textContent = '분석 대기 중...';
        if (statusValue) statusValue.textContent = '-';
        if (rateValue) rateValue.textContent = '-';
        if (explanationText) explanationText.innerHTML = '깜빡임 분석이 비활성화되어 있습니다.';
    }
}

function generateBlinkingExplanation(blinkingData) {
    const score = blinkingData.weightedScore || 0;
    const rate = blinkingData.rate?.current || blinkingData.blinkRatePerMinute || 0;
    
    let explanation = `<div style="line-height: 1.6;">`;
    explanation += `<h4 style="margin: 0 0 12px 0; color: #1f2937;">👁️ 깜빡임 분석 결과</h4>`;
    
    explanation += `<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px;">`;
    explanation += `<p style="margin: 4px 0;"><strong>깜빡임 점수:</strong> ${score}%</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>분당 횟수:</strong> ${rate}회</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>이상적 범위:</strong> 15-25회/분</p>`;
    explanation += `</div>`;
    
    if (score >= 85) {
        explanation += `<p style="color: #059669; margin: 8px 0;">✨ <strong>완벽한 깜빡임!</strong> 자연스럽고 건강한 깜빡임 패턴입니다.</p>`;
    } else if (score >= 70) {
        explanation += `<p style="color: #0891b2; margin: 8px 0;">😊 <strong>좋은 깜빡임!</strong> 적절한 깜빡임 패턴을 유지하고 있습니다.</p>`;
    } else if (score >= 50) {
        explanation += `<p style="color: #d97706; margin: 8px 0;">😐 <strong>보통 깜빡임</strong> 조금 더 자연스러운 깜빡임을 해보세요.</p>`;
    } else {
        explanation += `<p style="color: #dc2626; margin: 8px 0;">😔 <strong>개선 필요</strong> 너무 자주 깜빡이거나 거의 깜빡이지 않고 있습니다.</p>`;
    }
    
    explanation += `</div>`;
    return explanation;
}

// ===== 자세 상세 팝업 =====
function showPostureDetails() {
    console.log("🔍 [새팝업] 자세 세부 팝업 열기");
    
    const popup = document.getElementById('posture-details-popup');
    if (!popup) {
        console.error("❌ [새팝업] posture-details-popup을 찾을 수 없음");
        return;
    }
    
    popup.classList.add('active');
    updatePosturePopupNow();
}

function closePostureDetails() {
    const popup = document.getElementById('posture-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updatePosturePopupNow() {
    console.log("🔄 [새팝업] 자세 데이터 업데이트 시작");
    
    const postureData = window.currentPostureData;
    console.log("🔍 [새팝업] 현재 postureData:", postureData);
    
    const mainValue = document.getElementById('posture-main-value');
    const componentsDiv = document.getElementById('posture-components');
    const explanationText = document.getElementById('posture-explanation-text');
    
    if (!mainValue) {
        console.error("❌ [새팝업] 자세 팝업 DOM 요소들을 찾을 수 없음");
        return;
    }
    
    if (postureData && postureData.weightedScore > 0) {
        console.log("✅ [새팝업] 자세 데이터 사용");
        
        mainValue.textContent = `${postureData.weightedScore}%`;
        
        if (componentsDiv) {
            const components = postureData.components || {
                facePosture: 75,
                shoulderBalance: 70,
                neckAlignment: 80
            };
            
            let componentsHtml = '';
            componentsHtml += `<div style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; background: #f9fafb; border-radius: 4px;">`;
            componentsHtml += `<span>얼굴 자세 (50%):</span><span style="font-weight: bold;">${components.facePosture}%</span>`;
            componentsHtml += `</div>`;
            componentsHtml += `<div style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; background: #f9fafb; border-radius: 4px;">`;
            componentsHtml += `<span>어깨 균형 (30%):</span><span style="font-weight: bold;">${components.shoulderBalance}%</span>`;
            componentsHtml += `</div>`;
            componentsHtml += `<div style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; background: #f9fafb; border-radius: 4px;">`;
            componentsHtml += `<span>목 정렬 (20%):</span><span style="font-weight: bold;">${components.neckAlignment}%</span>`;
            componentsHtml += `</div>`;
            
            componentsDiv.innerHTML = componentsHtml;
        }
        
        if (explanationText) {
            explanationText.innerHTML = generatePostureExplanation(postureData);
        }
        
    } else {
        console.log("⏳ [새팝업] 자세 분석 대기 중");
        
        if (mainValue) mainValue.textContent = '분석 대기 중...';
        if (componentsDiv) componentsDiv.innerHTML = '<div class="no-data">분석 대기 중...</div>';
        if (explanationText) explanationText.innerHTML = '자세 분석이 비활성화되어 있습니다.';
    }
}

function generatePostureExplanation(postureData) {
    const score = postureData.weightedScore || 0;
    
    let explanation = `<div style="line-height: 1.6;">`;
    explanation += `<h4 style="margin: 0 0 12px 0; color: #1f2937;">🏃‍♂️ 자세 분석 결과</h4>`;
    
    explanation += `<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px;">`;
    explanation += `<p style="margin: 4px 0;"><strong>종합 자세:</strong> ${score}%</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>분석 요소:</strong> 12개 얼굴 랜드마크 기반</p>`;
    explanation += `</div>`;
    
    if (score >= 85) {
        explanation += `<p style="color: #059669; margin: 8px 0;">💪 <strong>완벽한 자세!</strong> 매우 당당하고 매력적인 자세입니다.</p>`;
    } else if (score >= 70) {
        explanation += `<p style="color: #0891b2; margin: 8px 0;">😊 <strong>좋은 자세!</strong> 안정적이고 좋은 인상을 주는 자세입니다.</p>`;
    } else if (score >= 50) {
        explanation += `<p style="color: #d97706; margin: 8px 0;">😐 <strong>보통 자세</strong> 어깨를 펴고 더 당당한 자세를 취해보세요.</p>`;
    } else {
        explanation += `<p style="color: #dc2626; margin: 8px 0;">😔 <strong>자세 개선 필요</strong> 등을 곧게 펴고 당당한 자세를 취해보세요.</p>`;
    }
    
    explanation += `<div style="background: #fef3c7; padding: 8px; border-radius: 6px; margin-top: 12px; font-size: 13px;">`;
    explanation += `<strong>💡 개선 팁:</strong> 어깨를 펴고 고개를 곧게 세우면 더 매력적인 인상을 줄 수 있습니다.`;
    explanation += `</div>`;
    
    explanation += `</div>`;
    return explanation;
}

// ===== 대화 주도권 상세 팝업 =====
function showInitiativeDetails() {
    console.log("🔍 [새팝업] 대화 주도권 세부 팝업 열기");
    
    const popup = document.getElementById('initiative-details-popup');
    if (!popup) {
        console.error("❌ [새팝업] initiative-details-popup을 찾을 수 없음");
        return;
    }
    
    popup.classList.add('active');
    updateInitiativePopupNow();
}

function closeInitiativeDetails() {
    const popup = document.getElementById('initiative-details-popup');
    if (popup) {
        popup.classList.remove('active');
    }
}

function updateInitiativePopupNow() {
    console.log("🔄 [새팝업] 대화 주도권 데이터 업데이트 시작");
    
    const initiativeData = window.currentInitiativeData;
    console.log("🔍 [새팝업] 현재 initiativeData:", initiativeData);
    
    const mainValue = document.getElementById('initiative-main-value');
    const balanceDiv = document.getElementById('initiative-balance');
    const statsDiv = document.getElementById('initiative-stats');
    const explanationText = document.getElementById('initiative-explanation-text');
    
    if (!mainValue) {
        console.error("❌ [새팝업] 대화 주도권 팝업 DOM 요소들을 찾을 수 없음");
        return;
    }
    
    if (initiativeData && initiativeData.weightedScore > 0) {
        console.log("✅ [새팝업] 대화 주도권 데이터 사용");
        
        mainValue.textContent = `${initiativeData.weightedScore}%`;
        
        if (balanceDiv) {
            const userRatio = initiativeData.userRatio || 50;
            const aiRatio = 100 - userRatio;
            
            let balanceHtml = `<div style="display: flex; align-items: center; margin: 12px 0;">`;
            balanceHtml += `<div style="flex: 1; text-align: center;">`;
            balanceHtml += `<div style="font-size: 14px; font-weight: bold; color: #3b82f6;">나</div>`;
            balanceHtml += `<div style="font-size: 18px; color: #1e40af;">${userRatio}%</div>`;
            balanceHtml += `</div>`;
            balanceHtml += `<div style="width: 2px; height: 40px; background: #e5e7eb; margin: 0 20px;"></div>`;
            balanceHtml += `<div style="flex: 1; text-align: center;">`;
            balanceHtml += `<div style="font-size: 14px; font-weight: bold; color: #ef4444;">AI</div>`;
            balanceHtml += `<div style="font-size: 18px; color: #dc2626;">${aiRatio}%</div>`;
            balanceHtml += `</div>`;
            balanceHtml += `</div>`;
            
            balanceDiv.innerHTML = balanceHtml;
        }
        
        if (statsDiv) {
            const stats = initiativeData.stats || {
                messageCount: 0,
                questionCount: 0,
                responseTime: 0
            };
            
            let statsHtml = '';
            statsHtml += `<div style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; background: #f9fafb; border-radius: 4px;">`;
            statsHtml += `<span>메시지 수:</span><span style="font-weight: bold;">${stats.messageCount}개</span>`;
            statsHtml += `</div>`;
            statsHtml += `<div style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; background: #f9fafb; border-radius: 4px;">`;
            statsHtml += `<span>질문 수:</span><span style="font-weight: bold;">${stats.questionCount}개</span>`;
            statsHtml += `</div>`;
            statsHtml += `<div style="display: flex; justify-content: space-between; padding: 8px; margin: 4px 0; background: #f9fafb; border-radius: 4px;">`;
            statsHtml += `<span>평균 응답시간:</span><span style="font-weight: bold;">${stats.responseTime}초</span>`;
            statsHtml += `</div>`;
            
            statsDiv.innerHTML = statsHtml;
        }
        
        if (explanationText) {
            explanationText.innerHTML = generateInitiativeExplanation(initiativeData);
        }
        
    } else {
        console.log("⏳ [새팝업] 대화 주도권 분석 대기 중");
        
        if (mainValue) mainValue.textContent = '분석 대기 중...';
        if (balanceDiv) balanceDiv.innerHTML = '<div class="no-data">분석 대기 중...</div>';
        if (statsDiv) statsDiv.innerHTML = '<div class="no-data">분석 대기 중...</div>';
        if (explanationText) explanationText.innerHTML = '대화 주도권 분석이 비활성화되어 있습니다.';
    }
}

function generateInitiativeExplanation(initiativeData) {
    const score = initiativeData.weightedScore || 0;
    const userRatio = initiativeData.userRatio || 50;
    
    let explanation = `<div style="line-height: 1.6;">`;
    explanation += `<h4 style="margin: 0 0 12px 0; color: #1f2937;">🗣️ 대화 주도권 분석</h4>`;
    
    explanation += `<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px;">`;
    explanation += `<p style="margin: 4px 0;"><strong>주도권 점수:</strong> ${score}%</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>사용자 비율:</strong> ${userRatio}%</p>`;
    explanation += `<p style="margin: 4px 0;"><strong>분석 방식:</strong> 표정(40%) + 시선(40%) + 자세(20%)</p>`;
    explanation += `</div>`;
    
    if (score >= 85) {
        explanation += `<p style="color: #059669; margin: 8px 0;">🎯 <strong>완벽한 주도권!</strong> 대화를 매우 잘 이끌어가고 있습니다.</p>`;
    } else if (score >= 70) {
        explanation += `<p style="color: #0891b2; margin: 8px 0;">😊 <strong>좋은 주도권!</strong> 대화에 적극적으로 참여하고 있습니다.</p>`;
    } else if (score >= 50) {
        explanation += `<p style="color: #d97706; margin: 8px 0;">😐 <strong>보통 주도권</strong> 조금 더 적극적으로 대화에 참여해보세요.</p>`;
    } else {
        explanation += `<p style="color: #dc2626; margin: 8px 0;">😔 <strong>주도권 부족</strong> 더 적극적으로 대화를 이끌어보세요.</p>`;
    }
    
    explanation += `</div>`;
    return explanation;
}

// 전역 함수로 노출
window.showExpressionDetails = showExpressionDetails;
window.closeExpressionDetails = closeExpressionDetails;
window.updateExpressionPopupNow = updateExpressionPopupNow;

window.showGazeDetails = showGazeDetails;
window.closeGazeDetails = closeGazeDetails;

window.showConcentrationDetails = showConcentrationDetails;
window.closeConcentrationDetails = closeConcentrationDetails;

window.showBlinkingDetails = showBlinkingDetails;
window.closeBlinkingDetails = closeBlinkingDetails;

window.showPostureDetails = showPostureDetails;
window.closePostureDetails = closePostureDetails;

window.showInitiativeDetails = showInitiativeDetails;
window.closeInitiativeDetails = closeInitiativeDetails;

// 기존 popup-manager.js 함수들 덮어쓰기 방지
console.log("✅ [새팝업] 간단한 팝업 관리자 로드됨 - 모든 팝업 지원");
