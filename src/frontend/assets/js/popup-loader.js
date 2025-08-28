/**
 * 팝업 로더 모듈
 * 팝업 HTML 파일들을 동적으로 로드하는 기능
 */

// 전역 변수들
let lastExpressionScore = null;
let lastExpressionText = '-';
let lastExpressionUpdate = 0;
const EXPRESSION_UPDATE_INTERVAL = 2000; // 2초마다 업데이트

// 팝업 로더 함수
async function loadPopup(popupName) {
    try {
        // Vercel 프록시를 통한 접근을 위해 경로 수정
        const baseUrl = window.serverUrl || "https://dys-phi.vercel.app/api/gke";
        const response = await fetch(`${baseUrl}/assets/popups/${popupName}.html`);
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

// 전역 함수로 노출
window.loadExpressionPopup = loadExpressionPopup;
window.loadGazePopup = loadGazePopup;
window.loadPosturePopup = loadPosturePopup;
window.loadBlinkingPopup = loadBlinkingPopup;
window.loadConcentrationPopup = loadConcentrationPopup;
window.loadInitiativePopup = loadInitiativePopup;

// 캘리브레이션 팝업 로드
async function loadCalibrationPopup() {
    const container = document.getElementById('calibration-popup-container');
    if (container) {
        const html = await loadPopup('calibration-popup');
        if (html) {
            container.innerHTML = html;
            
            // 팝업 로드 후 카메라 아이콘 경로 설정
            setTimeout(() => {
                const cameraIcon = document.getElementById('cameraIcon');
                if (cameraIcon) {
                    const serverUrl = window.serverUrl || "https://dys-phi.vercel.app/api/gke";
                    const iconPath = `${serverUrl}/frontend/assets/images/icon/camera.webp`;
                    cameraIcon.src = iconPath;
                    console.log('✅ 카메라 아이콘 경로 설정:', iconPath);
                    
                    // 이미지 로드 실패 시 대체 처리
                    cameraIcon.onerror = function() {
                        console.warn('⚠️ 카메라 아이콘 로드 실패, 대체 이미지 시도');
                        // 상대 경로로 재시도
                        this.src = 'assets/images/icon/camera.webp';
                    };
                } else {
                    console.warn('⚠️ cameraIcon 요소를 찾을 수 없습니다');
                }
            }, 100);
            
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
            // 이벤트 바인딩: 시작하기 버튼 클릭 처리
            const startBtn = document.getElementById('close-guide-btn');
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    // 초기 안내 팝업 닫기
                    if (typeof hideInitialGuidePopup === 'function') {
                        hideInitialGuidePopup();
                    }
                    // 캘리브레이션 오버레이 숨기기 (레이어 충돌 방지)
                    const calibrationOverlay = document.getElementById('calibration-overlay');
                    if (calibrationOverlay) {
                        calibrationOverlay.classList.add('hidden');
                    }
                    // 메인 콘텐츠 표시
                    const main = document.getElementById('main-content');
                    if (main) {
                        main.classList.add('visible');
                    }
                    // 앱 시작 로직 트리거
                    if (typeof startApp === 'function') {
                        try { startApp(); } catch (e) { console.warn('[INIT] startApp 실패:', e); }
                    }
                });
            }
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
