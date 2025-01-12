import requests
import random
import time
from typing import List, Optional

class ProxyPool:
    def __init__(self):
        self.proxies: List[dict] = []
        self.failed_times: dict = {}
        self.max_failed = 3
        
    def add_proxy(self, proxy: str) -> None:
        """添加代理到代理池"""
        self.proxies.append({
            'http': f'http://{proxy}',
            'https': f'http://{proxy}'
        })
        
    def get_proxy(self) -> Optional[dict]:
        """获取一个可用代理"""
        if not self.proxies:
            return None
        return random.choice(self.proxies)
    
    def remove_proxy(self, proxy: dict) -> None:
        """移除失效代理"""
        if proxy in self.proxies:
            self.proxies.remove(proxy)
            
    def mark_failed(self, proxy: dict) -> None:
        """标记代理失败次数"""
        proxy_str = str(proxy)
        self.failed_times[proxy_str] = self.failed_times.get(proxy_str, 0) + 1
        if self.failed_times[proxy_str] >= self.max_failed:
            self.remove_proxy(proxy) 