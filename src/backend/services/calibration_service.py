"""
캘리브레이션 서비스
- Supabase 연동
- 캘리브레이션 데이터 관리
- 실시간 캘리브레이션 처리
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import json

from ..models.calibration import (
    CalibrationData, CalibrationRequest, CalibrationResponse, 
    CalibrationStatus, validate_calibration_data, fill_missing_calibration_data,
    get_default_calibration
)

logger = logging.getLogger(__name__)

class CalibrationService:
    def __init__(self):
        self.supabase_client = None
        self._initialize_supabase()
    
    def _initialize_supabase(self):
        """Supabase 클라이언트 초기화"""
        try:
            from supabase import create_client, Client
            import os
            
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if supabase_url and supabase_key:
                self.supabase_client = create_client(supabase_url, supabase_key)
                logger.info("✅ Supabase 클라이언트 초기화 성공")
            else:
                logger.warning("⚠️ Supabase 환경변수가 설정되지 않음")
                
        except ImportError:
            logger.warning("⚠️ Supabase 라이브러리가 설치되지 않음")
        except Exception as e:
            logger.error(f"❌ Supabase 초기화 실패: {e}")
    
    async def check_user_calibration_status(self, user_id: str) -> CalibrationStatus:
        """사용자의 캘리브레이션 상태 확인"""
        try:
            if not self.supabase_client:
                return CalibrationStatus(
                    has_calibration=False,
                    user_id=user_id,
                    message="Supabase 연결 불가"
                )
            
            # users 테이블에서 cam_calibration 상태 확인
            user_response = self.supabase_client.table("users").select("cam_calibration").eq("id", user_id).execute()
            
            if not user_response.data:
                return CalibrationStatus(
                    has_calibration=False,
                    user_id=user_id,
                    message="사용자를 찾을 수 없음"
                )
            
            user_data = user_response.data[0]
            has_calibration = user_data.get("cam_calibration", False)
            
            if not has_calibration:
                return CalibrationStatus(
                    has_calibration=False,
                    user_id=user_id,
                    message="캘리브레이션이 필요함"
                )
            
            # camera_calibrations 테이블에서 최신 캘리브레이션 데이터 확인
            calib_response = self.supabase_client.table("camera_calibrations").select("*").eq("user_id", user_id).order("updated_at", desc=True).limit(1).execute()
            
            if calib_response.data:
                calib_data = calib_response.data[0]
                return CalibrationStatus(
                    has_calibration=True,
                    user_id=user_id,
                    profile_name=calib_data.get("profile_name"),
                    quality_score=calib_data.get("quality_score"),
                    last_updated=datetime.fromisoformat(calib_data.get("updated_at").replace("Z", "+00:00")) if calib_data.get("updated_at") else None
                )
            else:
                return CalibrationStatus(
                    has_calibration=False,
                    user_id=user_id,
                    message="캘리브레이션 데이터가 없음"
                )
                
        except Exception as e:
            logger.error(f"❌ 캘리브레이션 상태 확인 실패: {e}")
            return CalibrationStatus(
                has_calibration=False,
                user_id=user_id,
                message=f"오류 발생: {str(e)}"
            )
    
    async def get_user_calibration(self, user_id: str, profile_name: str = "default") -> Optional[CalibrationData]:
        """사용자의 캘리브레이션 데이터 조회"""
        try:
            if not self.supabase_client:
                logger.error("❌ Supabase 클라이언트가 초기화되지 않음")
                return None
            
            response = self.supabase_client.table("camera_calibrations").select("*").eq("user_id", user_id).eq("profile_name", profile_name).order("updated_at", desc=True).limit(1).execute()
            
            if response.data:
                calib_data = response.data[0]
                return CalibrationData(**calib_data)
            else:
                logger.warning(f"⚠️ 사용자 {user_id}의 캘리브레이션 데이터가 없음")
                return None
                
        except Exception as e:
            logger.error(f"❌ 캘리브레이션 데이터 조회 실패: {e}")
            return None
    
    async def save_calibration_data(self, calibration_data: CalibrationData) -> bool:
        """캘리브레이션 데이터 저장"""
        try:
            if not self.supabase_client:
                logger.error("❌ Supabase 클라이언트가 초기화되지 않음")
                return False
            
            # 데이터 유효성 검사
            is_valid, missing_fields, quality_score = validate_calibration_data(calibration_data)
            
            # 누락된 필드를 기본값으로 채움
            if missing_fields:
                logger.info(f"📝 누락된 필드를 기본값으로 채움: {missing_fields}")
                calibration_data = fill_missing_calibration_data(calibration_data)
            
            # 품질 점수 업데이트
            calibration_data.quality_score = quality_score
            calibration_data.updated_at = datetime.utcnow()
            
            # Supabase에 저장
            response = self.supabase_client.table("camera_calibrations").upsert(calibration_data.dict()).execute()
            
            if response.data:
                logger.info(f"✅ 캘리브레이션 데이터 저장 성공: {calibration_data.user_id}")
                
                # users 테이블의 cam_calibration 상태 업데이트
                self.supabase_client.table("users").update({"cam_calibration": True}).eq("id", calibration_data.user_id).execute()
                
                return True
            else:
                logger.error("❌ 캘리브레이션 데이터 저장 실패")
                return False
                
        except Exception as e:
            logger.error(f"❌ 캘리브레이션 데이터 저장 중 오류: {e}")
            return False
    
    async def process_calibration_session(self, user_id: str, session_data: Dict[str, Any]) -> CalibrationResponse:
        """캘리브레이션 세션 처리 (5초간 데이터 수집)"""
        try:
            logger.info(f"🔄 캘리브레이션 세션 시작: {user_id}")
            
            # 세션 데이터에서 캘리브레이션 값들 추출
            calibration_values = self._extract_calibration_values(session_data)
            
            # 캘리브레이션 데이터 생성
            calibration_data = CalibrationData(
                user_id=user_id,
                profile_name="default",
                **calibration_values
            )
            
            # 데이터 유효성 검사
            is_valid, missing_fields, quality_score = validate_calibration_data(calibration_data)
            
            if not is_valid:
                logger.warning(f"⚠️ 캘리브레이션 데이터 부족: {missing_fields}")
                
                # 누락된 필드를 기본값으로 채움
                calibration_data = fill_missing_calibration_data(calibration_data)
                quality_score = 0.5  # 기본값으로 채워진 경우 낮은 품질 점수
            
            # 데이터 저장
            save_success = await self.save_calibration_data(calibration_data)
            
            if save_success:
                return CalibrationResponse(
                    success=True,
                    message="캘리브레이션이 성공적으로 완료되었습니다.",
                    calibration_data=calibration_data,
                    quality_score=quality_score,
                    missing_fields=missing_fields if missing_fields else None
                )
            else:
                return CalibrationResponse(
                    success=False,
                    message="캘리브레이션 데이터 저장에 실패했습니다.",
                    quality_score=quality_score,
                    missing_fields=missing_fields
                )
                
        except Exception as e:
            logger.error(f"❌ 캘리브레이션 세션 처리 실패: {e}")
            return CalibrationResponse(
                success=False,
                message=f"캘리브레이션 처리 중 오류가 발생했습니다: {str(e)}"
            )
    
    def _extract_calibration_values(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """세션 데이터에서 캘리브레이션 값들 추출"""
        calibration_values = {}
        
        # 직접 전달된 캘리브레이션 데이터 처리
        if isinstance(session_data, dict):
            # 기존 calibration.js에서 전송하는 형식에 맞춤
            calibration_values.update({
                "center_h": session_data.get("center_h", 0.5),
                "center_v": session_data.get("center_v", 0.53),
                "center_ear": session_data.get("center_ear", 0.22),
                "band_center_half": session_data.get("band_center_half", 0.08),
                "band_mid_half": session_data.get("band_mid_half", 0.18),
                "blink_ear_threshold": session_data.get("blink_ear_threshold", 0.19),
                "blink_closed_threshold": session_data.get("blink_closed_threshold", 0.22),
                "saccade_threshold": session_data.get("saccade_threshold", 0.045),
                "focus_drift_seconds": session_data.get("focus_drift_seconds", 2.0),
                "neck_length_baseline": session_data.get("neck_length_baseline", 0.18),
                "neck_angle_baseline": session_data.get("neck_angle_baseline", 12.0),
                "chin_forward_baseline": session_data.get("chin_forward_baseline", 0.02),
                "neck_tilt_baseline": session_data.get("neck_tilt_baseline", 0.005),
                "shoulder_width_baseline": session_data.get("shoulder_width_baseline", 0.28),
                "torso_height_baseline": session_data.get("torso_height_baseline", 0.38),
                "back_curve_baseline": session_data.get("back_curve_baseline", 8.0),
                "shoulder_blade_position_baseline": session_data.get("shoulder_blade_position", 4.0)
            })
        
        # 구조화된 데이터 처리 (향후 확장용)
        else:
            # 중심점 데이터
            if "center_points" in session_data:
                center = session_data["center_points"]
                calibration_values.update({
                    "center_h": center.get("horizontal", 0.5),
                    "center_v": center.get("vertical", 0.5),
                    "center_ear": center.get("ear", 0.2)
                })
            
            # 밴드 데이터
            if "band_data" in session_data:
                band = session_data["band_data"]
                calibration_values.update({
                    "band_center_half": band.get("center_half", 0.1),
                    "band_mid_half": band.get("mid_half", 0.15)
                })
            
            # 깜빡임 데이터
            if "blink_data" in session_data:
                blink = session_data["blink_data"]
                calibration_values.update({
                    "blink_ear_threshold": blink.get("ear_threshold", 0.21),
                    "blink_closed_threshold": blink.get("closed_threshold", 0.19)
                })
            
            # 시선 데이터
            if "gaze_data" in session_data:
                gaze = session_data["gaze_data"]
                calibration_values.update({
                    "saccade_threshold": gaze.get("saccade_threshold", 50.0),
                    "focus_drift_seconds": gaze.get("focus_drift_seconds", 2.0)
                })
            
            # 자세 데이터
            if "posture_data" in session_data:
                posture = session_data["posture_data"]
                calibration_values.update({
                    "neck_length_baseline": posture.get("neck_length", 0.15),
                    "neck_angle_baseline": posture.get("neck_angle", 0.0),
                    "chin_forward_baseline": posture.get("chin_forward", 0.0),
                    "neck_tilt_baseline": posture.get("neck_tilt", 0.0),
                    "shoulder_width_baseline": posture.get("shoulder_width", 0.4),
                    "torso_height_baseline": posture.get("torso_height", 0.6),
                    "back_curve_baseline": posture.get("back_curve", 0.0),
                    "shoulder_blade_position_baseline": posture.get("shoulder_blade_position", 0.0)
                })
        
        return calibration_values
    
    async def start_calibration_session(self, user_id: str, duration_seconds: int = 5) -> str:
        """캘리브레이션 세션 시작"""
        session_id = f"calib_{user_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"🎯 캘리브레이션 세션 시작: {session_id} ({duration_seconds}초)")
        return session_id
    
    async def collect_calibration_data(self, session_id: str, frame_data: Dict[str, Any]) -> bool:
        """캘리브레이션 프레임 데이터 수집"""
        try:
            # 여기서 실제 프레임 데이터를 처리하고 저장
            # 현재는 로그만 출력
            logger.debug(f"📊 캘리브레이션 프레임 수집: {session_id}")
            return True
        except Exception as e:
            logger.error(f"❌ 캘리브레이션 데이터 수집 실패: {e}")
            return False

# 전역 캘리브레이션 서비스 인스턴스
calibration_service = CalibrationService()
