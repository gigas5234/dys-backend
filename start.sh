#!/bin/bash

echo "🚀 DYS Backend 시작..."
echo

# Python 버전 확인
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3가 설치되지 않았습니다."
    echo "💡 Python 3.8 이상을 설치해주세요."
    exit 1
fi

# 가상환경 확인 (선택사항)
if [ -d "venv" ]; then
    echo "📦 가상환경 활성화..."
    source venv/bin/activate
fi

# 실행 권한 확인
if [ ! -x "start.py" ]; then
    chmod +x start.py
fi

# 서버 시작
echo "🎯 서버 시작 중..."
python3 start.py
