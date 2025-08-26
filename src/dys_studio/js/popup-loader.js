/**
 * 팝업 로더 모듈
 * 팝업 HTML 파일들을 동적으로 로드하는 기능
 */

// 전역 변수들
let lastExpressionScore = 60;
let lastExpressionText = '중립적';
let lastExpressionUpdate = 0;
const EXPRESSION_UPDATE_INTERVAL = 2000; // 2초마다 업데이트

// 팝업 로더 함수
async function loadPopup(popupName) {
    try {
        const response = await fetch(`popups/${popupName}.html`);
        if (response.ok) {
            const html = await response.text();
            return html;
        } else {
            console.error(`팝업 로드 실패: ${popupName}`);
            return null;
        }
    } catch (error) {
        console.error(`팝업 로드 오류: ${popupName}`, error);
        return null;
    }
}

// 깜빡임 팝업 로드
async function loadBlinkingPopup() {
    const container = document.getElementById('blinking-popup-container');
    if (container) {
        const html = await loadPopup('blinking-details-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 깜빡임 팝업 로드 완료');
        }
    }
}

// 대화 주도권 팝업 로드
async function loadInitiativePopup() {
    const container = document.getElementById('initiative-popup-container');
    if (container) {
        const html = await loadPopup('initiative-details-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 대화 주도권 팝업 로드 완료');
        }
    }
}

// 표정 팝업 로드
async function loadExpressionPopup() {
    const container = document.getElementById('expression-popup-container');
    if (container) {
        const html = await loadPopup('expression-details-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 표정 팝업 로드 완료');
        }
    }
}

// 시선 안정성 팝업 로드
async function loadGazePopup() {
    const container = document.getElementById('gaze-popup-container');
    if (container) {
        const html = await loadPopup('gaze-details-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 시선 안정성 팝업 로드 완료');
        }
    }
}

// 집중도 팝업 로드
async function loadConcentrationPopup() {
    const container = document.getElementById('concentration-popup-container');
    if (container) {
        const html = await loadPopup('concentration-details-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 집중도 팝업 로드 완료');
        }
    }
}

// 자세 팝업 로드
async function loadPosturePopup() {
    const container = document.getElementById('posture-popup-container');
    if (container) {
        const html = await loadPopup('posture-details-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 자세 팝업 로드 완료');
        }
    }
}

// 캘리브레이션 팝업 로드
async function loadCalibrationPopup() {
    const container = document.getElementById('calibration-popup-container');
    if (container) {
        const html = await loadPopup('calibration-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 캘리브레이션 팝업 로드 완료');
        }
    }
}

// 초기 안내 팝업 로드
async function loadInitialGuidePopup() {
    const container = document.getElementById('initial-guide-popup-container');
    if (container) {
        const html = await loadPopup('initial-guide-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 초기 안내 팝업 로드 완료');
        }
    }
}

// 확인 팝업 로드
async function loadConfirmPopup() {
    const container = document.getElementById('confirm-popup-container');
    if (container) {
        const html = await loadPopup('confirm-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 확인 팝업 로드 완료');
        }
    }
}

// 카메라 경고 팝업 로드
async function loadCameraWarningPopup() {
    const container = document.getElementById('camera-warning-popup-container');
    if (container) {
        const html = await loadPopup('camera-warning-popup');
        if (html) {
            container.innerHTML = html;
            console.log('✅ 카메라 경고 팝업 로드 완료');
        }
    }
}

// 모든 팝업 로드
async function loadAllPopups() {
    console.log('🔄 모든 팝업 로드 시작...');
    
    // 기존 상세 팝업들
    await loadBlinkingPopup();
    await loadInitiativePopup();
    await loadExpressionPopup();
    await loadGazePopup();
    await loadConcentrationPopup();
    await loadPosturePopup();
    
    // 새로운 팝업들
    await loadCalibrationPopup();
    await loadInitialGuidePopup();
    await loadConfirmPopup();
    await loadCameraWarningPopup();
    
    console.log('✅ 모든 팝업 로드 완료');
}

// 전역 함수로 노출
window.loadPopup = loadPopup;
window.loadBlinkingPopup = loadBlinkingPopup;
window.loadInitiativePopup = loadInitiativePopup;
window.loadExpressionPopup = loadExpressionPopup;
window.loadGazePopup = loadGazePopup;
window.loadConcentrationPopup = loadConcentrationPopup;
window.loadPosturePopup = loadPosturePopup;
window.loadCalibrationPopup = loadCalibrationPopup;
window.loadInitialGuidePopup = loadInitialGuidePopup;
window.loadConfirmPopup = loadConfirmPopup;
window.loadCameraWarningPopup = loadCameraWarningPopup;
window.loadAllPopups = loadAllPopups;
