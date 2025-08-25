#!/usr/bin/env bash

# Supervisor를 실행하여 두 개의 서버 프로세스를 관리
echo "🚀 Supervisor를 사용하여 메인 서버와 WebSocket 서버를 시작합니다."
supervisord -n -c /etc/supervisor/conf.d/supervisord.conf