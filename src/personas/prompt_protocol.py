
# -*- coding: utf-8 -*-
"""
prompt_protocol.py (TTS 강화판)
- 네 가지 메시지 타입(System, AI, Human, Tool)
- '비슷한 토큰량' + '정중한 TTS 제약(이모티콘/ㅋㅋ/ㅎㅎ 금지)' 적용
"""
import json
import os
import re

BASE = os.path.dirname(__file__) if "__file__" in globals() else "/mnt/data"

def load_protocol(path=os.path.join(BASE, "message_protocol.json")):
    """메시지 프로토콜 로드"""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def read_system_text(persona_name):
    """페르소나별 시스템 텍스트 로드"""
    # 한글 이름을 영문 ID로 매핑
    name_mapping = {
        "이서아": "iseoa",
        "김연진": "kimyeonjin", 
        "박민수": "parkminsu"
    }
    
    # 한글 이름이면 영문 ID로 변환
    persona_id = name_mapping.get(persona_name, persona_name)
    
    # 먼저 한글 파일명으로 시도
    sys_file = f"system_{persona_name}.txt"
    full = os.path.join(BASE, sys_file) if not os.path.isabs(sys_file) else sys_file
    
    if os.path.exists(full):
        try:
            with open(full, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            print(f"⚠️ 한글 파일 읽기 실패: {e}")
    
    # 한글 파일이 없으면 영문 ID로 시도
    sys_file = f"system_{persona_id}.txt"
    full = os.path.join(BASE, sys_file) if not os.path.isabs(sys_file) else sys_file
    
    try:
        with open(full, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"⚠️ 시스템 파일을 찾을 수 없습니다: {persona_name} ({persona_id})")
        return "당신은 친근하고 따뜻한 AI 파트너입니다."

def est_tokens(s: str) -> int:
    """토큰 수 추정 (매우 러프한 추정: CJK 4자 ≈ 1토큰)"""
    return max(1, len(s) // 4)

def clamp_length_by_ratio(user_text: str, assistant_text: str, ratio: float=0.2, hard_cap_tokens: int=80):
    """사용자 메시지 대비 응답 길이 제한"""
    user_tokens = est_tokens(user_text)
    high = min(int(user_tokens * (1 + ratio)), hard_cap_tokens)

    if est_tokens(assistant_text) <= high:
        return assistant_text

    # 문장 단위로 잘라 길이 맞추기
    sents = re.split(r'(?<=[.!?])\s+', assistant_text.strip())
    new_text = ""
    for s in sents:
        candidate = (new_text + " " + s).strip()
        if est_tokens(candidate) > high:
            break
        new_text = candidate
    return new_text if new_text else assistant_text[: max(1, high*4)]

_EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E0-\U0001F1FF"  # flags (iOS)
    "]+",
    flags=re.UNICODE
)

def sanitize_for_tts(text: str) -> str:
    """TTS용 텍스트 정리"""
    # 이모지 제거
    text = _EMOJI_RE.sub("", text)
    # ㅋㅋ/ㅎㅎ 및 변형 제거
    text = re.sub(r"[ㅋㅎ]+", "", text)
    # 줄임표, 반복 느낌표/물음표 정리
    text = re.sub(r"\.{3,}", ".", text)
    text = re.sub(r"!{2,}", "!", text)
    text = re.sub(r"\?{2,}", "?", text)
    # 과도한 기호/이모티콘 패턴 제거
    text = re.sub(r"[\(\)\[\]\{\}<>^~_|]+", "", text)
    # 공백 정리
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text

def apply_style_constraints(user_text: str, assistant_text: str, ratio: float=0.2, hard_cap_tokens: int=80):
    """스타일 제약 적용"""
    cleaned = sanitize_for_tts(assistant_text)
    clamped = clamp_length_by_ratio(user_text, cleaned, ratio=ratio, hard_cap_tokens=hard_cap_tokens)
    return clamped

def compile_messages(human_text: str, persona_name: str = "이서아", tool_call: dict|None=None):
    """메시지 컴파일"""
    try:
        proto = load_protocol()
        system_text = read_system_text(persona_name)

        messages = [
            {"role": "system", "content": system_text},
            {"role": "user", "content": human_text}
        ]

        if tool_call is not None:
            messages.append({"role":"tool", "content": json.dumps(tool_call, ensure_ascii=False)})

        return messages
    except Exception as e:
        print(f"❌ 메시지 컴파일 실패: {e}")
        # 기본 메시지 반환
        return [
            {"role": "system", "content": "당신은 친근하고 따뜻한 AI 파트너입니다."},
            {"role": "user", "content": human_text}
        ]

def get_available_personas():
    """사용 가능한 페르소나 목록 반환"""
    personas = []
    for file in os.listdir(BASE):
        if file.startswith('system_') and file.endswith('.txt'):
            persona_name = file.replace('system_', '').replace('.txt', '')
            personas.append(persona_name)
    
    # 중복 제거 (한글과 영문이 모두 있을 경우)
    unique_personas = []
    for persona in personas:
        if persona not in unique_personas:
            unique_personas.append(persona)
    
    return unique_personas

if __name__ == "__main__":
    # 테스트
    msgs = compile_messages("처음 뵙겠습니다. 카페는 괜찮으신가요?", "이서아")
    print(json.dumps(msgs, ensure_ascii=False, indent=2))
    
    # 사용 가능한 페르소나 확인
    print(f"사용 가능한 페르소나: {get_available_personas()}")
