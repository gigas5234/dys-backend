/**
 * UI 유틸리티 함수들
 * UI 관련 공통 기능들을 모아놓은 모듈
 */

/**
 * 점수 색상 업데이트 함수
 * @param {HTMLElement} element - 색상을 변경할 요소
 * @param {number} score - 점수 (0-100)
 */
function updateScoreColor(element, score) {
    // 기존 색상 클래스 제거
    element.classList.remove('excellent', 'good', 'fair', 'poor');
    
    // 점수에 따른 색상 클래스 추가
    if (score >= 80) {
        element.classList.add('excellent');
        element.setAttribute('data-score', 'excellent');
    } else if (score >= 60) {
        element.classList.add('good');
        element.setAttribute('data-score', 'good');
    } else if (score >= 40) {
        element.classList.add('fair');
        element.setAttribute('data-score', 'fair');
    } else {
        element.classList.add('poor');
        element.setAttribute('data-score', 'poor');
    }
    
    // 업데이트 애니메이션 추가
    element.classList.add('updating');
    setTimeout(() => {
        element.classList.remove('updating');
    }, 300);
}

/**
 * 0-1 값을 0-100으로 변환하는 함수
 * @param {number} v - 변환할 값
 * @returns {number|null} 변환된 값 또는 null
 */
function clamp01To100(v) {
    if (v == null || isNaN(v)) return null;
    if (v <= 1) return Math.round(v * 100);
    return Math.round(Math.max(0, Math.min(100, v)));
}

/**
 * 개인화된 꿀팁 생성 함수
 * @param {Object} metrics - 메트릭 데이터
 * @returns {Array} 꿀팁 배열
 */
function generatePersonalizedTips(metrics) {
    const tips = [];
    
    // 자세 관련 (실제 UI 점수 사용)
    const postureElement = document.getElementById('posture-score');
    const postureScore = postureElement ? parseInt(postureElement.textContent) : 60;
    
    if (postureScore < 70) {
        if (postureScore < 50) {
            tips.push("자세가 많이 나빠졌어요. 목을 곧게 펴고 어깨를 내려보세요.");
        } else {
            tips.push("자세를 조금 더 개선해보세요. 목을 곧게 펴고 어깨를 내려보세요.");
        }
    }
    
    // 어깨 자세 관련
    if (metrics?.shoulderAnalysis) {
        const shoulder = metrics.shoulderAnalysis;
        
        // details가 있는지 확인 후 접근
        if (shoulder.details && shoulder.details.heightBalance < 70) {
            tips.push("어깨 높이를 맞춰 균형잡힌 자세를 유지하세요.");
        }
        
        if (shoulder.details && shoulder.details.slope < 70) {
            tips.push("어깨를 수평으로 맞춰 삐딱한 자세를 교정하세요.");
        }
        
        if (shoulder.details && shoulder.details.width < 70) {
            tips.push("어깨를 자연스럽게 펴고 올바른 자세를 취하세요.");
        }
        
        if (shoulder.details && shoulder.details.rotation < 70) {
            tips.push("한쪽 어깨가 앞으로 나오지 않도록 주의하세요.");
        }
        
        // details가 없으면 전체 점수로 판단
        if (!shoulder.details && shoulder.shoulderPostureScore < 70) {
            tips.push("어깨 자세를 개선해보세요.");
        }
    }
    
    // 시선 관련 (실제 UI 점수 사용)
    const gazeElement = document.getElementById('gaze-score');
    const gazeScore = gazeElement ? parseInt(gazeElement.textContent) : 60;
    
    if (gazeScore < 60) {
        tips.push("화면 중앙을 응시하며 집중해보세요.");
    }
    
    // 깜빡임 관련 (실제 UI 점수 사용)
    const blinkElement = document.getElementById('blinking-score');
    const blinkScore = blinkElement ? parseInt(blinkElement.textContent) : 80;
    
    if (blinkScore < 60) {
        tips.push("자연스럽게 깜빡여 눈을 보호하세요.");
    } else if (blinkScore < 80) {
        tips.push("깜빡임이 조금 부족해요. 편안하게 깜빡여보세요.");
    }
    
    // 미소 관련 (개인별 기준 적용)
    if (metrics?.smileIntensity !== undefined && metrics?.personalBaseSmile !== undefined) {
        const smileRatio = metrics.smileIntensity / metrics.personalBaseSmile;
        
        if (smileRatio < 0.7) {
            tips.push("😊 표정이 평소보다 많이 딱딱해 보여요. 입꼬리를 살짝 올려보세요!");
        } else if (smileRatio < 0.9) {
            tips.push("😊 표정이 평소보다 조금 딱딱해 보여요. 자연스러운 미소를 연습해보세요!");
        } else if (smileRatio > 1.3) {
            tips.push("😊 표정이 평소보다 많이 밝아 보여요. 너무 과하지 않게 자연스럽게 유지해보세요!");
        }
    } else if (metrics?.smileIntensity < 30) {
        // 개인별 기준이 없을 때 기존 방식 사용
        tips.push("편안한 미소로 대화를 시작해보세요.");
    }
    
    // 기본 꿀팁 (조건에 맞지 않을 때)
    if (tips.length === 0) {
        tips.push("훌륭한 자세입니다! 계속 유지해보세요.");
    }
    
    return tips.slice(0, 3); // 최대 3개까지만 표시
}

/**
 * 초기 안내 팝업 제어 함수들
 */
function showInitialGuidePopup() {
    document.getElementById('initial-guide-overlay').classList.add('visible');
}

function hideInitialGuidePopup() {
    document.getElementById('initial-guide-overlay').classList.remove('visible');
}

/**
 * 카메라 경고 메시지 제어 함수들
 */
function showCameraWarning() {
    // 상단 바 스타일 경고 메시지 표시
    document.getElementById('camera-warning').classList.remove('hidden');
    document.getElementById('main-content').classList.add('with-warning');
}

function hideCameraWarning() {
    document.getElementById('camera-warning').classList.add('hidden');
    document.getElementById('main-content').classList.remove('with-warning');
}

/**
 * 인라인 카메라 경고 메시지 제어 함수들
 */
function showCameraWarningInline() {
    document.getElementById('camera-warning-inline').style.display = 'block';
}

function hideCameraWarningInline() {
    document.getElementById('camera-warning-inline').style.display = 'none';
}

/**
 * 카메라 토스트 경고 메시지 제어 함수들
 */
function showCameraToast() {
    document.getElementById('camera-toast').classList.remove('hidden');
    // 5초 후 자동으로 숨기기
    setTimeout(() => {
        hideCameraToast();
    }, 5000);
}

function hideCameraToast() {
    document.getElementById('camera-toast').classList.add('hidden');
}

/**
 * 확인 팝업 제어 함수들
 */
function showConfirmDialog() {
    document.getElementById('confirm-overlay').classList.add('visible');
}

function hideConfirmDialog() {
    document.getElementById('confirm-overlay').classList.remove('visible');
}

/**
 * 피드백 패널 제어 함수
 */
function toggleFeedbackPanel() { 
    const feedbackPanel = document.getElementById('feedbackPanel');
    if (feedbackPanel) {
        feedbackPanel.classList.toggle('visible'); 
    }
}

/**
 * 프레임 결과를 메트릭으로 매핑하는 함수
 * @param {Object} result - 프레임 분석 결과
 * @returns {Object} 매핑된 메트릭 데이터
 */
function mapFrameResultToMetrics(result) {
    // 얼굴 인식 상태 확인 (완화: ear_value 조건 제거)
    const cameraBlocked = result?.coaching_message === '카메라가 보이지 않아서 피드백을 할 수 없습니다.';
    const noFace = result?.status === 'no-face';
    const isFaceDetected = !(cameraBlocked || noFace);
    
    // 얼굴이 전혀 감지되지 않는 명시적 경우만 0으로
    if (!isFaceDetected) {
        return {
            scores: { attention: 0, stability: 0, blink: 0, posture: 0 },
            labels: { expression: '-' },
            status: result?.status || 'no-face',
            coaching_message: result?.coaching_message,
            ear_value: result?.ear_value,
            frame_processed: result?.frame_processed === true
        };
    }
    
    // 다양한 결과 포맷을 5개 지표로 적응 매핑
    const scores = {};
    const labels = {};

    // 우선순위 1: result.scores에 A,S,R,P,W 등이 존재하는 경우
    const s = result?.scores || {};
    if (typeof s.A !== 'undefined') scores.attention = clamp01To100(s.A);
    if (typeof s.S !== 'undefined') scores.stability = clamp01To100(s.S);
    if (typeof s.R !== 'undefined') scores.blink = clamp01To100(s.R); // Relax≈Blink proxy
    // P는 백업으로만 사용 (개별 점수들이 우선)
    if (typeof s.P !== 'undefined' && s.P > 0) {
        scores.posture_backup = clamp01To100(s.P);
    }
    if (typeof s.W !== 'undefined') {
        const w = clamp01To100(s.W);
        labels.expression = w != null ? (w >= 66 ? '긍정적' : w >= 40 ? '중립적' : '개선 필요') : undefined;
    }

    // 우선순위 2: 개별 필드 명시적 값
    if (scores.attention == null && typeof result.attention === 'number') scores.attention = clamp01To100(result.attention);
    if (scores.stability == null && typeof result.stability_score === 'number') scores.stability = clamp01To100(result.stability_score);
    if (scores.stability == null && typeof result.stability === 'number') scores.stability = clamp01To100(result.stability);
    if (scores.blink == null && typeof result.blink === 'number') scores.blink = clamp01To100(result.blink);
    
    // 자세 점수 우선순위: 개별 점수들 > enhanced_posture_score > posture_score > posture > scores.P 백업
    
    // 1. 개별 자세 점수들을 우선적으로 계산
    const individualScores = [];
    if (typeof result.chin_forward_score === 'number') individualScores.push(result.chin_forward_score);
    if (typeof result.neck_tilt_score === 'number') individualScores.push(result.neck_tilt_score);
    if (typeof result.neck_score === 'number') individualScores.push(result.neck_score);
    if (typeof result.back_score === 'number') individualScores.push(result.back_score);
    if (typeof result.shoulder_blade_score === 'number') individualScores.push(result.shoulder_blade_score);
    if (typeof result.shoulder_width_score === 'number') individualScores.push(result.shoulder_width_score);
    if (typeof result.torso_height_score === 'number') individualScores.push(result.torso_height_score);
    if (typeof result.neck_length_score === 'number') individualScores.push(result.neck_length_score);
    if (typeof result.neck_angle_score === 'number') individualScores.push(result.neck_angle_score);
    
    if (individualScores.length > 0) {
        const avgIndividualScore = individualScores.reduce((a, b) => a + b, 0) / individualScores.length;
        scores.posture = clamp01To100(avgIndividualScore);
    }
    
    // 2. 백업 점수들
    if (scores.posture == null && typeof result.enhanced_posture_score === 'number') {
        scores.posture = clamp01To100(result.enhanced_posture_score);
    }
    if (scores.posture == null && typeof result.posture_score === 'number') {
        scores.posture = clamp01To100(result.posture_score);
    }
    if (scores.posture == null && typeof result.posture === 'number') {
        scores.posture = clamp01To100(result.posture);
    }

    // 추가 후보 키들
    if (scores.attention == null && typeof result.attention_score === 'number') scores.attention = clamp01To100(result.attention_score);
    if (scores.attention == null && typeof result.focus === 'number') scores.attention = clamp01To100(result.focus);
    if (scores.attention == null && typeof result.focus_score === 'number') scores.attention = clamp01To100(result.focus_score);
    if (scores.attention == null && typeof result.gaze_attention === 'number') scores.attention = clamp01To100(result.gaze_attention);
    if (scores.blink == null && typeof result.blink_score === 'number') scores.blink = clamp01To100(result.blink_score);
    if (scores.blink == null && typeof result.blinking === 'number') scores.blink = clamp01To100(result.blinking);

    // 3. 기하학적 측정값 기반 점수 (개별 점수보다 우선)
    if (scores.posture == null) {
        // 3a. 상태 문자열 기반 점수 (개별 점수들이 없을 때만 사용)
        const hasIndividualScores = individualScores.length > 0;
        
        if (!hasIndividualScores) {
            const status = typeof result.posture_status === 'string' ? result.posture_status.toLowerCase() : '';
            const enhancedStatus = typeof result.enhanced_posture_status === 'string' ? result.enhanced_posture_status.toLowerCase() : '';
            const backStatus = typeof result.back_status === 'string' ? result.back_status.toLowerCase() : '';
            const neckStatus = typeof result.neck_status === 'string' ? result.neck_status.toLowerCase() : '';
            
            if (status || enhancedStatus || backStatus || neckStatus) {
                const allStatuses = [status, enhancedStatus, backStatus, neckStatus].filter(s => s);
                let maxScore = 0;
                
                for (const s of allStatuses) {
                    if (s.includes('매우 좋') || s.includes('excellent') || s.includes('best')) maxScore = Math.max(maxScore, 95);
                    else if (s.includes('좋') || s.includes('good')) maxScore = Math.max(maxScore, 85);
                    else if (s.includes('보통') || s.includes('ok') || s.includes('neutral')) maxScore = Math.max(maxScore, 70);
                    else if (s.includes('개선') || s.includes('나쁨') || s.includes('bad')) maxScore = Math.max(maxScore, 50); // 35 → 50으로 완화
                    else if (s.includes('데이터없음') || s.includes('no data')) maxScore = Math.max(maxScore, 0);
                }
                
                if (maxScore > 0) scores.posture = maxScore;
            }
        }
        
        // 3b. 기하학적 측정값 기반 점수 (더 정교한 계산)
        if (scores.posture == null) {
            const fwd = typeof result.forward_head === 'number' ? Math.abs(result.forward_head) : null;
            const tilt = typeof result.shoulder_tilt === 'number' ? Math.abs(result.shoulder_tilt) : null;
            const fwdRatio = typeof result.forward_head_ratio === 'number' ? Math.abs(result.forward_head_ratio) : null;
            const shoulderOpen = typeof result.shoulder_open_deg === 'number' ? result.shoulder_open_deg : null;
            const torsoLean = typeof result.torso_lean_deg === 'number' ? result.torso_lean_deg : null;
            // 골반 각도 제거 요청에 따라 제외
            const pelvisOpen = null;
            
            if (fwd != null || tilt != null || fwdRatio != null || shoulderOpen != null || torsoLean != null) {
                let totalPenalty = 0;
                let factorCount = 0;
                
                // 전방두 페널티 (0.35 이하가 좋음)
                if (fwd != null) {
                    const nf = Math.min(1, fwd / 0.35);
                    totalPenalty += nf * 30;
                    factorCount++;
                }
                
                // 어깨 기울임 페널티 (가중치 상향)
                if (tilt != null) {
                    const nt = Math.min(1, tilt / 0.25);
                    totalPenalty += nt * 35; // 25 → 35
                    factorCount++;
                }
                
                // 전방두 비율 페널티 (0.5 이하가 좋음)
                if (fwdRatio != null) {
                    const nfr = Math.min(1, fwdRatio / 0.5);
                    totalPenalty += nfr * 20;
                    factorCount++;
                }
                
                // 어깨 각도 페널티 (가중치 상향, 170-180도가 좋음)
                if (shoulderOpen != null) {
                    const so = Math.abs(shoulderOpen - 175) / 10; // 175도 기준
                    const nso = Math.min(1, so);
                    totalPenalty += nso * 25; // 15 → 25
                    factorCount++;
                }
                
                // 몸통 기울임 페널티 (175-185도가 좋음)
                if (torsoLean != null) {
                    const tl = Math.abs(torsoLean - 180) / 10; // 180도 기준
                    const ntl = Math.min(1, tl);
                    totalPenalty += ntl * 10;
                    factorCount++;
                }
                
                // 골반 각도는 평가에서 제외
                
                // 평균 페널티 계산
                const avgPenalty = factorCount > 0 ? totalPenalty / factorCount : 0;
                const base = 100;
                scores.posture = Math.round(Math.max(0, Math.min(100, base - avgPenalty)));
            }
        }
        
        // 4. 백업 점수들 (scores.P 등)
        if (scores.posture == null && scores.posture_backup != null) {
            scores.posture = scores.posture_backup;
        }
    }

    // 자세 디버그 로깅 활성화
    if (window.__ANALYZER_DEBUG_POSTURE__ && window.__ANALYZER_DEBUG_POSTURE__ < 20) {
        console.log('[ANALYZER][POSTURE]', {
            // 직접 점수
            from_scores_P: result?.scores?.P,
            enhanced_posture_score: result?.enhanced_posture_score,
            posture_score: result?.posture_score,
            posture: result?.posture,
            
            // 상태 문자열
            posture_status: result?.posture_status,
            enhanced_posture_status: result?.enhanced_posture_status,
            back_status: result?.back_status,
            neck_status: result?.neck_status,
            
            // 기하학적 측정값
            forward_head: result?.forward_head,
            forward_head_ratio: result?.forward_head_ratio,
            shoulder_tilt: result?.shoulder_tilt,
            shoulder_open_deg: result?.shoulder_open_deg,
            torso_lean_deg: result?.torso_lean_deg,
            pelvis_open_deg: result?.pelvis_open_deg,
            
            // 개별 점수
            back_score: result?.back_score,
            neck_score: result?.neck_score,
            chin_forward_score: result?.chin_forward_score,
            neck_tilt_score: result?.neck_tilt_score,
            shoulder_blade_score: result?.shoulder_blade_score,
            shoulder_width_score: result?.shoulder_width_score,
            torso_height_score: result?.torso_height_score,
            neck_length_score: result?.neck_length_score,
            neck_angle_score: result?.neck_angle_score,
            
            // 최종 결과
            mapped: scores.posture,
            individual_scores_count: individualScores.length,
            individual_scores_avg: individualScores.length > 0 ? individualScores.reduce((a, b) => a + b, 0) / individualScores.length : null,
            
            // 계산 방식
            calculation: {
                direct_score: (result?.scores?.P != null || result?.enhanced_posture_score != null || result?.posture_score != null || result?.posture != null) ? 'yes' : 'no',
                status_based: (result?.posture_status || result?.enhanced_posture_status || result?.back_status || result?.neck_status) ? 'yes' : 'no',
                geometry_based: (result?.forward_head != null || result?.shoulder_tilt != null || result?.forward_head_ratio != null || result?.shoulder_open_deg != null || result?.torso_lean_deg != null || result?.pelvis_open_deg != null) ? 'yes' : 'no',
                individual_scores: (result?.back_score != null || result?.neck_score != null) ? 'yes' : 'no'
            }
        });
        window.__ANALYZER_DEBUG_POSTURE__ += 1;
    }

    // 우선순위 3: 서버에서 기존 피드백 스타일 키 사용 시
    if (scores.stability == null && typeof result.gaze_stability === 'number') scores.stability = clamp01To100(result.gaze_stability);
    if (scores.attention == null && typeof result.concentration === 'number') scores.attention = clamp01To100(result.concentration);
    if (scores.posture == null && typeof result.posture === 'number') scores.posture = clamp01To100(result.posture);
    if (scores.blink == null && typeof result.blinking === 'number') scores.blink = clamp01To100(result.blinking);

    // 보조: blink_rate(Hz/min)를 0-100으로 근사 맵핑
    if (scores.blink == null && typeof result.blink_rate === 'number') {
        // 10~25 범위를 70~30으로 뒤집어 맵핑 (낮을수록 안정)
        const br = result.blink_rate;
        const norm = 100 - Math.max(0, Math.min(100, (br - 10) * 5));
        scores.blink = Math.round(norm);
    }

    // 표정/미소
    if (!labels.expression) {
        if (typeof result.smile_score === 'number') {
            const w = clamp01To100(result.smile_score);
            labels.expression = w != null ? (w >= 66 ? '긍정적' : w >= 40 ? '중립적' : '개선 필요') : undefined;
        } else if (typeof result.warmth_label === 'string') {
            labels.expression = result.warmth_label;
        } else if (typeof result.expression === 'string') {
            labels.expression = result.expression;
        }
    }

    // 최종 보정: null 채우기 + 원본 상태 전달
    const out = {
        scores: {
            attention: scores.attention ?? 0,
            stability: scores.stability ?? 0,
            blink: scores.blink ?? 0,
            posture: scores.posture ?? 0
        },
        labels: { expression: labels.expression ?? '-' },
        status: result?.status,
        coaching_message: result?.coaching_message,
        ear_value: result?.ear_value,
        frame_processed: result?.frame_processed === true
    };
    return out;
}

// 전역 함수로 노출
window.updateScoreColor = updateScoreColor;
window.clamp01To100 = clamp01To100;
window.generatePersonalizedTips = generatePersonalizedTips;
window.showInitialGuidePopup = showInitialGuidePopup;
window.hideInitialGuidePopup = hideInitialGuidePopup;
window.showCameraWarning = showCameraWarning;
window.hideCameraWarning = hideCameraWarning;
window.showCameraWarningInline = showCameraWarningInline;
window.hideCameraWarningInline = hideCameraWarningInline;
window.showCameraToast = showCameraToast;
window.hideCameraToast = hideCameraToast;
window.showConfirmDialog = showConfirmDialog;
window.hideConfirmDialog = hideConfirmDialog;
window.toggleFeedbackPanel = toggleFeedbackPanel;
window.mapFrameResultToMetrics = mapFrameResultToMetrics;
