/**
 * 표정 분석 모듈
 * 서버의 MLflow 모델을 사용하여 실시간 표정 분석을 수행합니다.
 */

class ExpressionAnalyzer {
    constructor() {
        this.isInitialized = false;
        this.baseUrl = window.location.origin;
        this.expressionCategories = [
            'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'neutral', 'contempt'
        ];
        this.analysisQueue = [];
        this.isProcessing = false;
        
        // 이벤트 리스너들
        this.onAnalysisComplete = null;
        this.onError = null;
        
        console.log('🎭 ExpressionAnalyzer 초기화됨');
    }

    /**
     * 표정 분석기 상태를 확인합니다.
     */
    async checkStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/api/expression/status`);
            const data = await response.json();
            
            if (data.success) {
                this.isInitialized = data.is_initialized;
                console.log('✅ 표정 분석기 상태 확인:', data);
                return data;
            } else {
                console.warn('⚠️ 표정 분석기 상태 확인 실패:', data.error);
                return data;
            }
        } catch (error) {
            console.error('❌ 표정 분석기 상태 확인 중 오류:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 단일 이미지의 표정을 분석합니다.
     * @param {string} imageData - Base64 인코딩된 이미지 데이터
     * @returns {Promise<Object>} 분석 결과
     */
    async analyzeExpression(imageData) {
        try {
            console.log('🎭 표정 분석 시작...');
            
            const response = await fetch(`${this.baseUrl}/api/expression/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image_data: imageData
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 표정 분석 완료:', result);
                
                // 점수 변환
                const score = this.convertToScore(result);
                
                // 팝업에서 사용할 수 있도록 전역 변수에 저장
                const popupData = {
                    expression: result.dominant_expression,
                    confidence: result.confidence,
                    probabilities: result.expressions,
                    score: score
                };
                
                // 전역 변수에 저장 (팝업 매니저에서 사용)
                window.currentExpressionData = popupData;
                
                // 콜백 호출
                if (this.onAnalysisComplete) {
                    this.onAnalysisComplete(result);
                }
                
                return result;
            } else {
                console.error('❌ 표정 분석 실패:', result.error);
                
                // 에러 콜백 호출
                if (this.onError) {
                    this.onError(result.error);
                }
                
                return result;
            }
        } catch (error) {
            console.error('❌ 표정 분석 중 오류:', error);
            
            // 에러 콜백 호출
            if (this.onError) {
                this.onError(error.message);
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 여러 이미지의 표정을 일괄 분석합니다.
     * @param {Array<string>} imageDataList - Base64 인코딩된 이미지 데이터 배열
     * @returns {Promise<Object>} 일괄 분석 결과
     */
    async analyzeExpressionBatch(imageDataList) {
        try {
            console.log(`🎭 일괄 표정 분석 시작 (${imageDataList.length}개 이미지)...`);
            
            const response = await fetch(`${this.baseUrl}/api/expression/analyze-batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image_data_list: imageDataList
                })
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 일괄 표정 분석 완료:', result);
                
                // 콜백 호출
                if (this.onAnalysisComplete) {
                    this.onAnalysisComplete(result);
                }
                
                return result;
            } else {
                console.error('❌ 일괄 표정 분석 실패:', result.error);
                
                // 에러 콜백 호출
                if (this.onError) {
                    this.onError(result.error);
                }
                
                return result;
            }
        } catch (error) {
            console.error('❌ 일괄 표정 분석 중 오류:', error);
            
            // 에러 콜백 호출
            if (this.onError) {
                this.onError(error.message);
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 표정 분석 결과를 점수로 변환합니다.
     * @param {Object} analysisResult - 표정 분석 결과
     * @returns {Object} 점수 결과
     */
    convertToScore(analysisResult) {
        if (!analysisResult.success) {
            return {
                score: 0,
                label: '분석 실패',
                details: analysisResult.error || 'Unknown error'
            };
        }

        const dominantExpression = analysisResult.dominant_expression;
        const confidence = analysisResult.confidence;

        // 표정별 점수 매핑
        const expressionScores = {
            'happy': 95,      // 매우 높은 점수
            'neutral': 85,    // 높은 점수 (중립적이지만 긍정적)
            'surprised': 75,  // 긍정적 점수
            'sad': 45,        // 중간 점수
            'angry': 25,      // 낮은 점수
            'fearful': 30,    // 낮은 점수
            'disgusted': 20,  // 매우 낮은 점수
            'contempt': 35    // 낮은 점수
        };

        // 기본 점수
        const baseScore = expressionScores[dominantExpression] || 60;

        // 신뢰도에 따른 점수 조정 (신뢰도가 높을수록 점수 보너스)
        const confidenceBonus = 1.0 + (confidence - 0.5) * 0.4;  // 신뢰도 50% 이상에서 보너스
        const adjustedScore = Math.round(baseScore * confidenceBonus);

        // 점수 범위 제한 (최소 20점 보장)
        const finalScore = Math.max(20, Math.min(100, adjustedScore));

        // 라벨 생성
        let label;
        if (finalScore >= 85) {
            label = "매우 긍정적";
        } else if (finalScore >= 70) {
            label = "긍정적";
        } else if (finalScore >= 50) {
            label = "중립적";
        } else if (finalScore >= 30) {
            label = "부정적";
        } else {
            label = "매우 부정적";
        }

        return {
            score: finalScore,
            label: label,
            expression: dominantExpression,
            confidence: confidence,
            baseScore: baseScore,
            confidenceBonus: confidenceBonus,
            expressionScores: expressionScores,
            details: `${dominantExpression} 표정 (신뢰도: ${confidence.toFixed(2)}, 기본점수: ${baseScore}, 최종점수: ${finalScore})`
        };
    }

    /**
     * 표정 분석 결과를 시각화합니다.
     * @param {Object} analysisResult - 표정 분석 결과
     * @returns {string} HTML 문자열
     */
    visualizeResult(analysisResult) {
        if (!analysisResult.success) {
            return `
                <div class="expression-result error">
                    <h4>❌ 분석 실패</h4>
                    <p>${analysisResult.error || 'Unknown error'}</p>
                </div>
            `;
        }

        const expressions = analysisResult.expressions;
        const dominantExpression = analysisResult.dominant_expression;
        const confidence = analysisResult.confidence;

        // 표정별 이모지 매핑
        const expressionEmojis = {
            'happy': '😊',
            'sad': '😢',
            'angry': '😠',
            'surprised': '😲',
            'fearful': '😨',
            'disgusted': '🤢',
            'neutral': '😐',
            'contempt': '😏'
        };

        // 결과 HTML 생성
        let html = `
            <div class="expression-result">
                <h4>🎭 표정 분석 결과</h4>
                <div class="dominant-expression">
                    <span class="emoji">${expressionEmojis[dominantExpression] || '❓'}</span>
                    <span class="expression-name">${dominantExpression}</span>
                    <span class="confidence">(${(confidence * 100).toFixed(1)}%)</span>
                </div>
                <div class="expression-breakdown">
                    <h5>전체 표정 분포:</h5>
                    <div class="expression-bars">
        `;

        // 각 표정별 확률 바 생성
        this.expressionCategories.forEach(category => {
            const probability = expressions[category] || 0;
            const percentage = (probability * 100).toFixed(1);
            const isDominant = category === dominantExpression;
            
            html += `
                <div class="expression-bar ${isDominant ? 'dominant' : ''}">
                    <span class="emoji">${expressionEmojis[category] || '❓'}</span>
                    <span class="category">${category}</span>
                    <div class="bar-container">
                        <div class="bar" style="width: ${percentage}%"></div>
                    </div>
                    <span class="percentage">${percentage}%</span>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * 실시간 표정 분석을 시작합니다.
     * @param {Function} onFrame - 각 프레임 분석 완료 시 호출될 콜백
     * @param {Function} onError - 에러 발생 시 호출될 콜백
     */
    startRealTimeAnalysis(onFrame, onError) {
        this.onAnalysisComplete = onFrame;
        this.onError = onError;
        
        console.log('🎭 실시간 표정 분석 시작');
    }

    /**
     * 실시간 표정 분석을 중지합니다.
     */
    stopRealTimeAnalysis() {
        this.onAnalysisComplete = null;
        this.onError = null;
        
        console.log('🎭 실시간 표정 분석 중지');
    }

    /**
     * 이미지 데이터를 Base64로 변환합니다.
     * @param {HTMLCanvasElement|HTMLImageElement} element - 변환할 요소
     * @returns {string} Base64 인코딩된 이미지 데이터
     */
    convertToBase64(element) {
        try {
            if (element instanceof HTMLCanvasElement) {
                return element.toDataURL('image/jpeg', 0.8);
            } else if (element instanceof HTMLImageElement) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = element.naturalWidth;
                canvas.height = element.naturalHeight;
                ctx.drawImage(element, 0, 0);
                return canvas.toDataURL('image/jpeg', 0.8);
            } else {
                throw new Error('지원되지 않는 요소 타입');
            }
        } catch (error) {
            console.error('❌ Base64 변환 실패:', error);
            throw error;
        }
    }


}

// 전역 인스턴스 생성
window.expressionAnalyzer = new ExpressionAnalyzer();

// 모듈 내보내기 (ES6 모듈 지원)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExpressionAnalyzer;
}
