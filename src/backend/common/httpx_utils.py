#!/usr/bin/env python3
"""
httpx 버전 호환성 유틸리티
httpx 0.27/0.28 버전 간 proxies/proxy 파라미터 차이 해결
"""

import httpx
from typing import Optional

def make_httpx_client(proxy_url: Optional[str] = None, timeout: float = 60.0) -> httpx.Client:
    """
    httpx 버전 호환 클라이언트 생성
    httpx>=0.28: proxy= 사용
    httpx<0.28: proxies= 사용
    """
    kwargs = {"timeout": timeout}
    if proxy_url:
        try:
            # httpx>=0.28
            return httpx.Client(proxy=proxy_url, **kwargs)
        except TypeError:
            # httpx<0.28
            return httpx.Client(proxies=proxy_url, **kwargs)
    return httpx.Client(**kwargs)

def make_httpx_async_client(proxy_url: Optional[str] = None, timeout: float = 60.0) -> httpx.AsyncClient:
    """
    httpx 버전 호환 비동기 클라이언트 생성
    httpx>=0.28: proxy= 사용
    httpx<0.28: proxies= 사용
    """
    kwargs = {"timeout": timeout}
    if proxy_url:
        try:
            # httpx>=0.28
            return httpx.AsyncClient(proxy=proxy_url, **kwargs)
        except TypeError:
            # httpx<0.28
            return httpx.AsyncClient(proxies=proxy_url, **kwargs)
    return httpx.AsyncClient(**kwargs)
