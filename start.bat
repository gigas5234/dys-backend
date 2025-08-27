@echo off
echo 🚀 DYS Backend 시작...
echo.

REM Python 버전 확인
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python이 설치되지 않았습니다.
    echo 💡 Python 3.8 이상을 설치해주세요.
    pause
    exit /b 1
)

REM 가상환경 확인 (선택사항)
if exist "venv\Scripts\activate.bat" (
    echo 📦 가상환경 활성화...
    call venv\Scripts\activate.bat
)

REM 서버 시작
echo 🎯 서버 시작 중...
python start.py

pause
