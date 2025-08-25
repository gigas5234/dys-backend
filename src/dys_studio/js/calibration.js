/**
 * 캘리브레이션 관리 모듈
 * 사용자 자세 측정 및 캘리브레이션 데이터 처리를 담당
 */

// --- 캘리브레이션 관련 전역 변수 ---
let calibrationOverlay = null;
let calibrationInitialView = null;
let calibrationProgressView = null;
let calibrationStartBtn = null;
let calibrationSkipBtn = null;
let calibrationProgressBarFill = null;
let calibrationCountdownText = null;
let calibrationMainContent = null;
let calibrationInstructionText = null;

/**
 * 캘리브레이션 DOM 요소 초기화
 */
function initializeCalibrationElements() {
    calibrationOverlay = document.getElementById('calibration-overlay');
    calibrationInitialView = document.getElementById('initial-view');
    calibrationProgressView = document.getElementById('progress-view');
    calibrationStartBtn = document.getElementById('start-calibration-btn');
    calibrationSkipBtn = document.getElementById('skip-calibration-btn');
    calibrationProgressBarFill = document.getElementById('progress-bar-fill');
    calibrationCountdownText = document.getElementById('countdown-text');
    calibrationMainContent = document.getElementById('main-content');
    calibrationInstructionText = document.getElementById('instruction-text');
}

/**
 * 사용자 캘리브레이션 상태 확인 (Supabase users 테이블의 cam_calibration 필드 확인)
 * @returns {Promise<boolean>} 캘리브레이션 존재 여부
 */
async function checkUserCalibration() {
    try {
        const response = await fetch(window.apiEndpoints?.user_check || `${window.serverUrl || 'http://34.64.136.237'}/api/user/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: window.userId, 
                email: window.email, 
                token: window.token 
            })
        });

        if (!response.ok) {
            throw new Error(`서버 응답 오류: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Supabase users 테이블의 cam_calibration 필드 확인
        const hasCalibration = result.cam_calibration || result.has_calibration || false;
        
        console.log("사용자 캘리브레이션 상태 확인:", {
            user_id: window.userId,
            email: window.email,
            cam_calibration: hasCalibration,
            raw_response: result
        });
        
        return hasCalibration;
    } catch (error) {
        console.error("사용자 상태 확인 실패:", error);
        return false;
    }
}

/**
 * 개인 캘리브레이션 데이터 로드 (Supabase에서)
 * @returns {Promise<Object|null>} 개인 캘리브레이션 데이터 또는 null
 */
async function loadPersonalCalibration() {
    try {
        const response = await fetch(`${window.serverUrl || 'http://34.64.136.237'}/api/calibration/user/${window.userId}`);
        if (!response.ok) {
            throw new Error(`개인 캘리브레이션 로드 실패: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.calibration_data) {
            console.log("개인 캘리브레이션 로드 완료:", result.calibration_data);
            return result.calibration_data;
        } else {
            console.log("개인 캘리브레이션 데이터 없음:", result.message);
            return null;
        }
    } catch (error) {
        console.error("개인 캘리브레이션 로드 오류:", error);
        return null;
    }
}

/**
 * 기본 캘리브레이션 데이터 로드 (별도 모듈에서 관리)
 * @returns {Promise<Object>} 기본 캘리브레이션 데이터
 */
async function loadDefaultCalibration() {
    // DefaultCalibration 모듈에서 기본값 가져오기
    if (window.DefaultCalibration && window.DefaultCalibration.getDefaultCalibration) {
        const defaultCalibration = window.DefaultCalibration.getDefaultCalibration();
        
        // 기본 캘리브레이션 정보 로깅
        window.DefaultCalibration.logDefaultCalibration();
        
        console.log("기본 캘리브레이션 로드 완료 (모듈에서):", defaultCalibration);
        return defaultCalibration;
    } else {
        // 폴백: 기본값이 정의되지 않은 경우
        console.warn("DefaultCalibration 모듈을 찾을 수 없음 - 폴백 값 사용");
        const fallbackCalibration = {
            center_h: 0.5,
            center_v: 0.53,
            center_ear: 0.22,
            band_center_half: 0.08,
            band_mid_half: 0.18,
            blink_ear_threshold: 0.19,
            blink_closed_threshold: 0.22,
            saccade_threshold: 0.045,
            focus_drift_seconds: 2.0,
            neck_length_baseline: 0.18,
            neck_angle_baseline: 12.0,
            chin_forward_baseline: 0.02,
            neck_tilt_baseline: 0.005,
            shoulder_width_baseline: 0.28,
            torso_height_baseline: 0.38,
            back_curve_baseline: 8.0,
            shoulder_blade_position: 4.0,
            quality_score: 0.85,
            description: "기본 캘리브레이션 (폴백 - 모듈 로드 실패)",
            version: 1
        };
        
        console.log("폴백 기본 캘리브레이션 사용:", fallbackCalibration);
        return fallbackCalibration;
    }
}

/**
 * 캘리브레이션 데이터 설정 (전역 변수로 저장)
 * @param {Object} calibrationData - 캘리브레이션 데이터
 */
function setCalibrationData(calibrationData, type = 'default') {
    window.currentCalibration = calibrationData;
    
    // 캘리브레이션 타입 정보 추가
    window.calibrationInfo = {
        type: type, // 'personal', 'default', 'fallback'
        source: type === 'personal' ? 'database' : 'local',
        timestamp: new Date().toISOString(),
        quality_score: calibrationData.quality_score || 0,
        description: calibrationData.description || '캘리브레이션 데이터'
    };
    
    console.log("캘리브레이션 데이터 설정 완료:", {
        type: type,
        data: calibrationData,
        info: window.calibrationInfo
    });
}

/**
 * 현재 캘리브레이션 데이터 가져오기
 * @returns {Object} 현재 캘리브레이션 데이터
 */
function getCurrentCalibration() {
    return window.currentCalibration || null;
}

/**
 * 캘리브레이션 정보 가져오기
 * @returns {Object} 캘리브레이션 타입 및 메타데이터
 */
function getCalibrationInfo() {
    return window.calibrationInfo || null;
}

/**
 * 캘리브레이션 타입 확인
 * @returns {string} 'personal', 'default', 'fallback', 'none'
 */
function getCalibrationType() {
    return window.calibrationInfo?.type || 'none';
}

/**
 * 캘리브레이션 상태 요약
 * @returns {Object} 캘리브레이션 상태 정보
 */
function getCalibrationStatus() {
    const hasPersonal = window.__hasCalibrationInDb || false;
    const hasCurrent = !!window.currentCalibration;
    const type = getCalibrationType();
    const skipped = window.__skippedCalibration || false;
    
    return {
        hasPersonalCalibration: hasPersonal,
        hasCurrentCalibration: hasCurrent,
        calibrationType: type,
        skippedCalibration: skipped,
        qualityScore: window.calibrationInfo?.quality_score || 0,
        description: window.calibrationInfo?.description || '캘리브레이션 없음',
        supabaseStatus: {
            cam_calibration: hasPersonal, // Supabase users 테이블의 cam_calibration 필드
            user_id: window.userId,
            email: window.email
        },
        // 측정에 사용되는 캘리브레이션 정보
        measurementInfo: {
            center_h: window.currentCalibration?.center_h || 0.5,
            center_v: window.currentCalibration?.center_v || 0.53,
            blink_ear_threshold: window.currentCalibration?.blink_ear_threshold || 0.19,
            blink_closed_threshold: window.currentCalibration?.blink_closed_threshold || 0.22,
            band_center_half: window.currentCalibration?.band_center_half || 0.08,
            band_mid_half: window.currentCalibration?.band_mid_half || 0.18,
            neck_angle_baseline: window.currentCalibration?.neck_angle_baseline || 12.0,
            shoulder_width_baseline: window.currentCalibration?.shoulder_width_baseline || 0.28
        }
    };
}

/**
 * 캘리브레이션 상태를 콘솔에 출력 (디버깅용)
 */
function logCalibrationStatus() {
    const status = getCalibrationStatus();
    console.log('📊 [CALIBRATION STATUS]', {
        '개인 캘리브레이션': status.hasPersonalCalibration ? '✅ 있음' : '❌ 없음',
        '현재 캘리브레이션': status.hasCurrentCalibration ? '✅ 로드됨' : '❌ 없음',
        '캘리브레이션 타입': status.calibrationType,
        '건너뛰기 여부': status.skippedCalibration ? '✅ 건너뜀' : '❌ 완료',
        '품질 점수': status.qualityScore,
        '설명': status.description,
        'Supabase 상태': status.supabaseStatus.cam_calibration ? '✅ 완료' : '❌ 미완료'
    });
    
    if (status.hasCurrentCalibration) {
        console.log('🎯 [MEASUREMENT CALIBRATION]', status.measurementInfo);
    }
}

/**
 * Supabase users 테이블의 cam_calibration 필드 업데이트
 * @param {boolean} hasCalibration - 캘리브레이션 완료 여부
 * @returns {Promise<Object>} 서버 응답 결과
 */
async function updateUserCalibrationStatus(hasCalibration = true) {
    try {
        const response = await fetch(window.apiEndpoints?.user_update || `${window.serverUrl || 'http://34.64.136.237'}/api/user/update-calibration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: window.userId,
                email: window.email,
                token: window.token,
                cam_calibration: hasCalibration
            })
        });

        if (!response.ok) {
            throw new Error(`사용자 캘리브레이션 상태 업데이트 실패: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("사용자 캘리브레이션 상태 업데이트 완료:", result);
        return result;
    } catch (error) {
        console.error("사용자 캘리브레이션 상태 업데이트 오류:", error);
        throw error;
    }
}

/**
 * 캘리브레이션 데이터 서버 전송
 * @param {Object} calibrationData - 캘리브레이션 데이터
 * @returns {Promise<Object>} 서버 응답 결과
 */
async function sendCalibrationData(calibrationData) {
    try {
        // 1. 캘리브레이션 데이터 저장
        const response = await fetch(window.apiEndpoints?.calibration || `${window.serverUrl || 'http://34.64.136.237'}/api/calibration`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: window.userId,
                email: window.email,
                token: window.token,
                calibration_data: calibrationData
            })
        });

        if (!response.ok) {
            throw new Error(`캘리브레이션 저장 실패: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("캘리브레이션 데이터 저장 완료:", result);
        
        // 2. Supabase users 테이블의 cam_calibration 필드를 true로 업데이트
        try {
            await updateUserCalibrationStatus(true);
            console.log("Supabase users 테이블 캘리브레이션 상태 업데이트 완료");
        } catch (updateError) {
            console.error("Supabase 업데이트 실패 (캘리브레이션 데이터는 저장됨):", updateError);
            // Supabase 업데이트 실패해도 캘리브레이션 데이터는 저장되었으므로 계속 진행
        }
        
        return result;
    } catch (error) {
        console.error("캘리브레이션 저장 오류:", error);
        throw error;
    }
}

/**
 * UI 전환 함수 (캘리브레이션 완료 시)
 */
function startApp() {
    console.log("[UI] 캘리브레이션 완료 - UI 전환");
    
    // 앱 시작 플래그 설정
    window.__readyToStartApp = true;
    
    // UI 전환만 처리 (앱 초기화는 메인 HTML에서 처리)
    calibrationOverlay.classList.add('hidden');
    calibrationMainContent.classList.add('visible');
}

/**
 * 카메라 경고와 함께 UI 전환 함수
 */
function startAppWithCameraWarning() {
    console.log("[UI] 캘리브레이션 완료 - UI 전환 (카메라 경고)");
    
    // UI 전환만 처리 (앱 초기화는 메인 HTML에서 처리)
    calibrationOverlay.classList.add('hidden');
    calibrationMainContent.classList.add('visible');
    showCameraWarning();
}

/**
 * 캘리브레이션 건너뛰기 알림 표시
 */
function showCalibrationSkipNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">ℹ️</span>
            <span>캘리브레이션을 건너뛰고 바로 시작합니다</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 3초 후 알림 제거
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

/**
 * 캘리브레이션 초기화 및 상태 확인
 */
async function initializeCalibration() {
    // 전역 스코프에서 사용자 정보 가져오기
    const userId = window.userId;
    const email = window.email;
    const token = window.token;
    
    console.log("🔍 사용자 정보 확인:", { userId, email, token });
    
    // 사용자 정보 유효성 검사
    if (!userId || !email) {
        console.error("사용자 정보가 없습니다.");
        console.error("userId:", userId);
        console.error("email:", email);
        console.error("token:", token);
        // 사용자 정보가 없으면 메인 HTML에서 처리하도록 함
        return;
    }

    // 캘리브레이션 건너뛰기 플래그 체크 (URL 파라미터와 함께 확인)
    const skipCalibration = sessionStorage.getItem('skipCalibration');
    const urlSkipCalibration = new URLSearchParams(window.location.search).get('skip_calibration');
    
    if (skipCalibration === 'true' && urlSkipCalibration === 'true') {
        console.log("캘리브레이션 건너뛰기 플래그 발견");
        sessionStorage.removeItem('skipCalibration'); // 플래그 제거
        // 메인 HTML에서 앱 시작하도록 플래그 설정
        window.__readyToStartApp = true;
        return;
    } else if (skipCalibration === 'true' && urlSkipCalibration !== 'true') {
        // URL에 skip_calibration 파라미터가 없으면 플래그 제거하고 정상 진행
        console.log("잘못된 캘리브레이션 건너뛰기 플래그 제거");
        sessionStorage.removeItem('skipCalibration');
    }

    try {
        const hasCalibration = await checkUserCalibration();
        window.__hasCalibrationInDb = !!hasCalibration;
        
        if (hasCalibration) {
            console.log("기존 개인 캘리브레이션 발견");
            // 개인 캘리브레이션이 있으면 로드 시도
            try {
                const personalCalibration = await loadPersonalCalibration();
                if (personalCalibration) {
                    setCalibrationData(personalCalibration, 'personal');
                    console.log("개인 캘리브레이션 로드 완료");
                } else {
                    // 개인 캘리브레이션 로드 실패 시 기본값 사용
                    const defaultCalibration = await loadDefaultCalibration();
                    setCalibrationData(defaultCalibration, 'default');
                    console.log("개인 캘리브레이션 로드 실패, 기본 캘리브레이션 설정");
                }
            } catch (error) {
                console.error("개인 캘리브레이션 로드 실패:", error);
                // 에러 발생 시 기본 캘리브레이션 사용
                const defaultCalibration = await loadDefaultCalibration();
                setCalibrationData(defaultCalibration, 'default');
                console.log("개인 캘리브레이션 로드 에러, 기본 캘리브레이션 설정");
            }
            // 기존 캘리브레이션이 있어도 사용자가 선택하도록 캘리브레이션 팝업 표시
            console.log("캘리브레이션 팝업 표시 (사용자 선택 대기)");
        } else {
            console.log("캘리브레이션 필요, 기본 캘리브레이션 로드");
            // 개인 캘리브레이션이 없으면 기본 캘리브레이션 로드
            try {
                const defaultCalibration = await loadDefaultCalibration();
                setCalibrationData(defaultCalibration, 'default');
                console.log("기본 캘리브레이션 설정 완료");
            } catch (error) {
                console.error("기본 캘리브레이션 로드 실패:", error);
            }
        }
        
        // 자동으로 앱을 시작하지 않고 사용자 선택을 기다림
        // 사용자가 "건너뛰기"를 누르거나 캘리브레이션을 완료한 후에만 앱 시작
    } catch (error) {
        console.error("사용자 상태 확인 실패:", error);
        // 에러 발생 시에도 기본 캘리브레이션 로드 시도
        try {
            const defaultCalibration = await loadDefaultCalibration();
            setCalibrationData(defaultCalibration);
            console.log("에러 발생, 기본 캘리브레이션 설정 완료");
        } catch (defaultError) {
            console.error("기본 캘리브레이션 로드도 실패:", defaultError);
        }
        console.log("에러 발생, 사용자 선택 대기");
    }
}

/**
 * 캘리브레이션 데이터 수집
 * @param {MediaStream} stream - 카메라 스트림
 * @returns {Promise<Object>} 수집된 캘리브레이션 데이터
 */
async function collectCalibrationData(stream) {
    return new Promise((resolve) => {
        let countdown = 5;
        const samples = {
            // 시선 관련
            center_h: [], center_v: [], center_ear: [],
            band_center_half: [], band_mid_half: [],
            
            // 깜빡임 관련
            blink_ear_threshold: [], blink_closed_threshold: [],
            
            // 시선 이동 관련
            saccade_threshold: [], focus_drift_seconds: [],
            
            // 자세 관련
            neck_length_baseline: [], neck_angle_baseline: [], 
            chin_forward_baseline: [], neck_tilt_baseline: [],
            shoulder_width_baseline: [], torso_height_baseline: [], 
            back_curve_baseline: [], shoulder_blade_position: []
        };

        calibrationCountdownText.textContent = `측정 완료까지 ${countdown}초...`;

        const interval = setInterval(() => {
            countdown--;
            calibrationCountdownText.textContent = `측정 완료까지 ${countdown}초...`;
            
            const progress = (5 - countdown) / 5 * 100;
            calibrationProgressBarFill.style.width = `${progress}%`;

            const mockData = generateMockCalibrationData();
            Object.keys(mockData).forEach(key => {
                if (samples[key]) {
                    samples[key].push(mockData[key]);
                }
            });

            if (countdown <= 0) {
                clearInterval(interval);
                calibrationCountdownText.textContent = '자세 측정이 완료되었습니다!';
                
                const calibrationData = processCalibrationData(samples);
                resolve(calibrationData);
            }
        }, 1000);
    });
}

/**
 * 모의 캘리브레이션 데이터 생성
 * @returns {Object} 모의 캘리브레이션 데이터
 */
function generateMockCalibrationData() {
    return {
        // 시선 관련 - 화면 중앙 기준
        center_h: 0.5 + (Math.random() - 0.5) * 0.05,  // 화면 중앙 수평 위치
        center_v: 0.53 + (Math.random() - 0.5) * 0.05, // 화면 중앙 수직 위치 (약간 아래)
        center_ear: 0.22 + (Math.random() - 0.5) * 0.02, // EAR 기준값
        
        // 시선 안정성 밴드
        band_center_half: 0.08 + (Math.random() - 0.5) * 0.01, // 중앙 밴드 반값
        band_mid_half: 0.18 + (Math.random() - 0.5) * 0.02,   // 중간 밴드 반값
        
        // 깜빡임 임계값
        blink_ear_threshold: 0.19 + (Math.random() - 0.5) * 0.01, // 깜빡임 EAR 임계값
        blink_closed_threshold: 0.22 + (Math.random() - 0.5) * 0.01, // 눈 감음 임계값
        
        // 시선 이동 임계값
        saccade_threshold: 0.045 + (Math.random() - 0.5) * 0.005, // 사카드 임계값
        focus_drift_seconds: 2.0 + (Math.random() - 0.5) * 0.2,   // 집중 이탈 시간
        
        // 자세 관련 - 일반적인 사람 기준
        neck_length_baseline: 0.18 + (Math.random() - 0.5) * 0.02, // 목 길이 기준
        neck_angle_baseline: 12.0 + (Math.random() - 0.5) * 2.0,   // 목 각도 기준 (도)
        chin_forward_baseline: 0.02 + (Math.random() - 0.5) * 0.01, // 턱 앞으로 내밀기
        neck_tilt_baseline: 0.005 + (Math.random() - 0.5) * 0.002, // 목 기울기
        
        // 어깨 및 몸통 관련
        shoulder_width_baseline: 0.28 + (Math.random() - 0.5) * 0.03, // 어깨 너비 기준
        torso_height_baseline: 0.38 + (Math.random() - 0.5) * 0.02,   // 몸통 높이 기준
        back_curve_baseline: 8.0 + (Math.random() - 0.5) * 1.0,      // 등 굽힘 기준 (도)
        shoulder_blade_position: 4.0 + (Math.random() - 0.5) * 0.5   // 어깨뼈 위치 기준
    };
}

/**
 * 캘리브레이션 데이터 처리
 * @param {Object} samples - 수집된 샘플 데이터
 * @returns {Object} 처리된 캘리브레이션 데이터
 */
function processCalibrationData(samples) {
    const processed = {};
    Object.keys(samples).forEach(key => {
        const values = samples[key];
        if (values.length > 0) {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            processed[key] = avg;
        }
    });
    return processed;
}

/**
 * 캘리브레이션 버튼 이벤트 리스너 설정
 */
function setupCalibrationEventListeners() {
    // 건너뛰기 버튼
    if (calibrationSkipBtn) {
        calibrationSkipBtn.addEventListener('click', async () => {
            try {
                // 건너뛰기해도 카메라 권한 요청
                await navigator.mediaDevices.getUserMedia({ video: true });
                
                // 기본 캘리브레이션 설정 (아직 설정되지 않은 경우)
                if (!getCurrentCalibration()) {
                    try {
                        const defaultCalibration = await loadDefaultCalibration();
                        setCalibrationData(defaultCalibration);
                        console.log("건너뛰기 시 기본 캘리브레이션 설정 완료");
                    } catch (error) {
                        console.error("건너뛰기 시 기본 캘리브레이션 로드 실패:", error);
                    }
                }
                
                window.__skippedCalibration = true;
                startApp();
            } catch (err) {
                console.error("카메라 권한 실패:", err);
                
                // 카메라 권한이 없어도 기본 캘리브레이션 설정
                if (!getCurrentCalibration()) {
                    try {
                        const defaultCalibration = await loadDefaultCalibration();
                        setCalibrationData(defaultCalibration);
                        console.log("카메라 권한 없음, 기본 캘리브레이션 설정 완료");
                    } catch (error) {
                        console.error("카메라 권한 없음, 기본 캘리브레이션 로드 실패:", error);
                    }
                }
                
                window.__skippedCalibration = true;
                startAppWithCameraWarning();
            }
        });
    }

    // 측정 시작 버튼
    if (calibrationStartBtn) {
        calibrationStartBtn.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                
                calibrationInitialView.classList.add('hidden');
                calibrationProgressView.classList.remove('hidden');

                const calibrationData = await collectCalibrationData(stream);
                await sendCalibrationData(calibrationData);
                
                // 개인 캘리브레이션으로 설정
                setCalibrationData(calibrationData, 'personal');
                console.log("개인 캘리브레이션 설정 완료");
                
                // 캘리브레이션 상태 로깅
                logCalibrationStatus();
                
                startApp();

            } catch (err) {
                console.error("캘리브레이션 실패:", err);
                calibrationInstructionText.innerHTML = "카메라 권한이 필요합니다.<br>권한을 허용한 후 새로고침 해주세요.";
                calibrationInstructionText.style.color = '#e74c3c';
            }
        });
    }
}

/**
 * 캘리브레이션 모듈 초기화
 * DOM이 로드된 후 실행되어야 함
 */
function initializeCalibrationModule() {
    // DOM 요소 초기화
    initializeCalibrationElements();
    
    // 이벤트 리스너 설정
    setupCalibrationEventListeners();
    
    // 캘리브레이션 초기화는 메인 HTML에서 호출됨
    // initializeCalibration(); // 제거 - 메인 HTML에서 호출
}

// 캘리브레이션 모듈 자동 초기화 비활성화
// 메인 HTML 파일에서 사용자 정보 초기화 후 수동으로 호출됨
console.log('[CALIBRATION] 모듈 로드 완료 - 메인 HTML에서 초기화 대기 중');

// 외부에서 사용할 수 있도록 전역 스코프에 노출
window.CalibrationModule = {
    initializeCalibration,
    checkUserCalibration,
    sendCalibrationData,
    collectCalibrationData,
    generateMockCalibrationData,
    processCalibrationData,
    startApp,
    startAppWithCameraWarning,
    showCalibrationSkipNotification
};
