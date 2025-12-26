"""
Rate limiting middleware for API endpoints.

Implements a sliding window rate limiter to prevent API abuse.
"""

import os
import time
from collections import defaultdict
from dataclasses import dataclass
from threading import Lock
from typing import Optional


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""
    allowed: bool
    remaining: int
    reset_time: float
    retry_after: Optional[int] = None


class RateLimiter:
    """
    Sliding window rate limiter.
    
    Tracks requests per client IP within a time window and enforces limits.
    """
    
    def __init__(
        self,
        requests_per_minute: Optional[int] = None,
        window_seconds: int = 60
    ):
        """
        Initialize rate limiter.
        
        Args:
            requests_per_minute: Maximum requests allowed per window.
                                 Defaults to RATE_LIMIT_REQUESTS_PER_MINUTE env var or 100.
            window_seconds: Time window in seconds (default 60).
        """
        self.requests_per_minute = requests_per_minute or int(
            os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "100")
        )
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()
    
    def check(self, client_id: str) -> RateLimitResult:
        """
        Check if a request from client_id is allowed.
        
        Args:
            client_id: Unique identifier for the client (usually IP address).
            
        Returns:
            RateLimitResult with allowed status and metadata.
        """
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        with self._lock:
            # Clean up old requests outside the window
            self._requests[client_id] = [
                ts for ts in self._requests[client_id]
                if ts > window_start
            ]
            
            request_count = len(self._requests[client_id])
            remaining = max(0, self.requests_per_minute - request_count)
            
            # Calculate reset time (when oldest request expires)
            if self._requests[client_id]:
                oldest_request = min(self._requests[client_id])
                reset_time = oldest_request + self.window_seconds
            else:
                reset_time = current_time + self.window_seconds
            
            if request_count >= self.requests_per_minute:
                # Rate limit exceeded
                retry_after = int(reset_time - current_time) + 1
                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_time=reset_time,
                    retry_after=retry_after
                )
            
            # Request allowed - record it
            self._requests[client_id].append(current_time)
            
            return RateLimitResult(
                allowed=True,
                remaining=remaining - 1,  # -1 because we just used one
                reset_time=reset_time
            )
    
    def reset(self, client_id: str) -> None:
        """Reset rate limit for a specific client (for testing)."""
        with self._lock:
            self._requests[client_id] = []
    
    def reset_all(self) -> None:
        """Reset all rate limits (for testing)."""
        with self._lock:
            self._requests.clear()


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get or create the global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter
