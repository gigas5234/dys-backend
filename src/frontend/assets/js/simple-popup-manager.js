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
    
    if (expressionData && (expressionData.weightedScore > 0 || expressionData.confidence > 0)) {
        console.log("✅ [새팝업] 서버 MLflow 데이터 사용");
        
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

// 전역 함수로 노출
window.showExpressionDetails = showExpressionDetails;
window.closeExpressionDetails = closeExpressionDetails;
window.updateExpressionPopupNow = updateExpressionPopupNow;

// 기존 popup-manager.js 함수들 덮어쓰기 방지
console.log("✅ [새팝업] 간단한 팝업 관리자 로드됨");
