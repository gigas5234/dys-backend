/**
 * 기본 캘리브레이션 설정 모듈
 * 대부분의 사람이 사용하는 기본 캘리브레이션 값들을 관리
 * 필요시 이 파일에서 값들을 수정하여 전체 시스템에 적용
 */

/**
 * 기본 캘리브레이션 데이터
 * 일반적인 성인(평균 키 160-180cm, 정상 시력)을 기준으로 설정
 */
const DEFAULT_CALIBRATION = {
    // 시선 관련 - 화면 중앙 기준
    center_h: 0.5,                    // 화면 중앙 수평 위치
    center_v: 0.53,                   // 화면 중앙 수직 위치 (약간 아래)
    center_ear: 0.22,                 // EAR(Eye Aspect Ratio) 기준값
    
    // 시선 안정성 밴드
    band_center_half: 0.08,           // 중앙 밴드 반값 (시선 안정성 측정)
    band_mid_half: 0.18,              // 중간 밴드 반값 (시선 이동 감지)
    
    // 깜빡임 임계값
    blink_ear_threshold: 0.19,        // 깜빡임 EAR 임계값
    blink_closed_threshold: 0.22,     // 눈 감음 임계값
    
    // 시선 이동 임계값
    saccade_threshold: 0.045,         // 사카드(급속 안구운동) 임계값
    focus_drift_seconds: 2.0,         // 집중 이탈 시간 (초)
    
    // 자세 관련 - 일반적인 사람 기준
    neck_length_baseline: 0.18,       // 목 길이 기준
    neck_angle_baseline: 12.0,        // 목 각도 기준 (도)
    chin_forward_baseline: 0.02,      // 턱 앞으로 내밀기
    neck_tilt_baseline: 0.005,        // 목 기울기
    
    // 어깨 및 몸통 관련
    shoulder_width_baseline: 0.28,    // 어깨 너비 기준
    torso_height_baseline: 0.38,      // 몸통 높이 기준
    back_curve_baseline: 8.0,         // 등 굽힘 기준 (도)
    shoulder_blade_position: 4.0,     // 어깨뼈 위치 기준
    
    // 품질 및 메타데이터
    quality_score: 0.85,              // 기본 캘리브레이션 품질 점수
    description: "대부분의 사람이 사용하는 기본 캘리브레이션 (일반적인 사람 기준 - 관대한 설정)",
    
    // 통계 정보
    statistics: {
        total_users: 0,               // 사용자 수 (동적으로 업데이트 가능)
        average_accuracy: 0.85,       // 평균 정확도
        recommended_for: [            // 권장 사용자 그룹
            "일반적인 성인",
            "평균 키 160-180cm", 
            "정상 시력"
        ],
        notes: [                      // 사용 시 주의사항
            "대부분의 사람에게 적합한 기본 설정",
            "시선 안정성과 자세 분석에 최적화",
            "개인 캘리브레이션이 없을 때 사용",
            "필요시 이 파일에서 값들을 조정 가능"
        ]
    },
    
    // 버전 관리
    version: 2,
    last_updated: "2024-12-23"
};

/**
 * 기본 캘리브레이션 데이터 가져오기
 * @returns {Object} 기본 캘리브레이션 데이터
 */
function getDefaultCalibration() {
    return { ...DEFAULT_CALIBRATION };
}

/**
 * 특정 필드의 기본값 가져오기
 * @param {string} field - 필드명
 * @param {any} fallback - 기본값이 없을 때 사용할 값
 * @returns {any} 필드값 또는 fallback
 */
function getDefaultValue(field, fallback = null) {
    return DEFAULT_CALIBRATION[field] !== undefined ? DEFAULT_CALIBRATION[field] : fallback;
}

/**
 * 기본 캘리브레이션 정보 출력 (디버깅용)
 */
function logDefaultCalibration() {
    console.log('📋 [DEFAULT CALIBRATION]', {
        version: DEFAULT_CALIBRATION.version,
        description: DEFAULT_CALIBRATION.description,
        quality_score: DEFAULT_CALIBRATION.quality_score,
        last_updated: DEFAULT_CALIBRATION.last_updated,
        recommended_for: DEFAULT_CALIBRATION.statistics.recommended_for
    });
    
    console.log('🎯 [DEFAULT VALUES]', {
        '시선 중앙': `H: ${DEFAULT_CALIBRATION.center_h}, V: ${DEFAULT_CALIBRATION.center_v}`,
        'EAR 기준': DEFAULT_CALIBRATION.center_ear,
        '깜빡임 임계값': `${DEFAULT_CALIBRATION.blink_ear_threshold} / ${DEFAULT_CALIBRATION.blink_closed_threshold}`,
        '목 각도 기준': `${DEFAULT_CALIBRATION.neck_angle_baseline}°`,
        '어깨 너비 기준': DEFAULT_CALIBRATION.shoulder_width_baseline
    });
}

// 모듈 내보내기
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 환경
    module.exports = {
        DEFAULT_CALIBRATION,
        getDefaultCalibration,
        getDefaultValue,
        logDefaultCalibration
    };
} else {
    // 브라우저 환경 - 전역 객체에 추가
    window.DefaultCalibration = {
        DEFAULT_CALIBRATION,
        getDefaultCalibration,
        getDefaultValue,
        logDefaultCalibration
    };
}
