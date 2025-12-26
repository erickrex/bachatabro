"""
Property-based tests for error handling middleware.

Feature: elevenlabs-voice-coach
Property 3: Error Response Code Mapping
Validates: Requirements 1.5
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck

from src.middleware.validator import (
    validate_tts_request,
    validate_stt_request,
    validate_coaching_request,
    validate_review_request,
    SUPPORTED_LANGUAGES,
    MAX_TEXT_LENGTH,
)
from src.middleware.rate_limiter import RateLimiter


class TestErrorResponseCodeMapping:
    """
    Property 3: Error Response Code Mapping
    
    For any invalid request (malformed body, missing fields, invalid values),
    the backend proxy should return the appropriate HTTP error code:
    - 400 for bad request
    - 401 for unauthorized
    - 429 for rate limit
    - 500 for server error
    
    Validates: Requirements 1.5
    """
    
    # --- 400 Bad Request Tests ---
    
    @given(st.none())
    @settings(max_examples=10)
    def test_empty_body_returns_400(self, _):
        """
        Feature: elevenlabs-voice-coach, Property 3: Error Response Code Mapping
        
        Empty request body should return 400.
        """
        result = validate_tts_request({})
        assert not result.valid
        assert result.error_code == 400
    
    @given(st.dictionaries(
        keys=st.text(min_size=1, max_size=10).filter(lambda x: x != "text"),
        values=st.text(min_size=1, max_size=10),
        min_size=0,
        max_size=5
    ))
    @settings(max_examples=100)
    def test_missing_required_field_returns_400(self, data: dict):
        """
        Feature: elevenlabs-voice-coach, Property 3: Error Response Code Mapping
        
        Missing required 'text' field should return 400.
        """
        # Ensure 'text' is not in the data
        data.pop("text", None)
        
        result = validate_tts_request(data)
        assert not result.valid
        assert result.error_code == 400
        assert "text" in result.error_message.lower() or "required" in result.error_message.lower()
    
    @given(st.one_of(
        st.integers(),
        st.floats(allow_nan=False),
        st.lists(st.text()),
        st.dictionaries(st.text(), st.text())
    ))
    @settings(max_examples=100)
    def test_wrong_type_for_text_returns_400(self, wrong_type):
        """
        Feature: elevenlabs-voice-coach, Property 3: Error Response Code Mapping
        
        Wrong type for 'text' field should return 400.
        """
        data = {"text": wrong_type}
        result = validate_tts_request(data)
        
        assert not result.valid
        assert result.error_code == 400
    
    @given(st.integers(min_value=MAX_TEXT_LENGTH + 1, max_value=MAX_TEXT_LENGTH + 100))
    @settings(max_examples=100)
    def test_text_too_long_returns_400(self, length: int):
        """
        Feature: elevenlabs-voice-coach, Property 3: Error Response Code Mapping
        
        Text exceeding max length should return 400.
        """
        long_text = "a" * length
        data = {"text": long_text}
        result = validate_tts_request(data)
        
        assert not result.valid
        assert result.error_code == 400
        assert "maximum length" in result.error_message.lower()
    
    @given(st.text(min_size=1, max_size=10).filter(lambda x: x not in SUPPORTED_LANGUAGES))
    @settings(max_examples=100)
    def test_unsupported_language_returns_400(self, language: str):
        """
        Feature: elevenlabs-voice-coach, Property 3: Error Response Code Mapping
        
        Unsupported language should return 400.
        """
        data = {"text": "Hello", "language": language}
        result = validate_tts_request(data)
        
        assert not result.valid
        assert result.error_code == 400
        assert "unsupported language" in result.error_message.lower()
    
    @given(st.integers(min_value=-100, max_value=-1) | st.integers(min_value=101, max_value=200))
    @settings(max_examples=100)
    def test_score_out_of_range_returns_400(self, score: int):
        """
        Feature: elevenlabs-voice-coach, Property 3: Error Response Code Mapping
        
        Score outside 0-100 range should return 400.
        """
        data = {"score": score, "weakPoints": [], "strongPoints": []}
        result = validate_coaching_request(data)
        
        assert not result.valid
        assert result.error_code == 400
        assert "score" in result.error_message.lower()
    
    # --- 429 Rate Limit Tests ---
    
    def test_rate_limit_exceeded_returns_429_info(self):
        """
        Feature: elevenlabs-voice-coach, Property 3: Error Response Code Mapping
        
        Rate limit exceeded should provide retry_after information.
        """
        rate_limiter = RateLimiter(requests_per_minute=5, window_seconds=60)
        client_id = "test_client"
        
        # Exhaust rate limit
        for _ in range(5):
            result = rate_limiter.check(client_id)
            assert result.allowed
        
        # Next request should be rate limited
        result = rate_limiter.check(client_id)
        assert not result.allowed
        assert result.retry_after is not None
        assert result.retry_after > 0
        
        # Clean up
        rate_limiter.reset(client_id)
    
    @given(st.integers(min_value=1, max_value=10))
    @settings(max_examples=50)
    def test_rate_limit_tracks_per_client(self, limit: int):
        """
        Feature: elevenlabs-voice-coach, Property 3: Error Response Code Mapping
        
        Rate limiting should be per-client, not global.
        """
        rate_limiter = RateLimiter(requests_per_minute=limit, window_seconds=60)
        
        # Client A exhausts their limit
        for _ in range(limit):
            result = rate_limiter.check("client_a")
            assert result.allowed
        
        # Client A is now rate limited
        result = rate_limiter.check("client_a")
        assert not result.allowed
        
        # Client B should still be allowed
        result = rate_limiter.check("client_b")
        assert result.allowed
        
        # Clean up
        rate_limiter.reset_all()


class TestValidRequestsAccepted:
    """Tests that valid requests are accepted."""
    
    @given(
        st.text(min_size=1, max_size=100).filter(lambda x: x.strip()),
        st.sampled_from(list(SUPPORTED_LANGUAGES))
    )
    @settings(max_examples=100)
    def test_valid_tts_request_accepted(self, text: str, language: str):
        """
        For any valid text and supported language, request should be accepted.
        """
        data = {"text": text, "language": language}
        result = validate_tts_request(data)
        
        assert result.valid, f"Valid request rejected: {result.error_message}"
    
    @given(
        st.integers(min_value=0, max_value=100),
        st.lists(st.text(min_size=1, max_size=20), min_size=0, max_size=5),
        st.lists(st.text(min_size=1, max_size=20), min_size=0, max_size=5),
        st.sampled_from(list(SUPPORTED_LANGUAGES))
    )
    @settings(max_examples=100)
    def test_valid_coaching_request_accepted(
        self, score: int, weak_points: list, strong_points: list, language: str
    ):
        """
        For any valid coaching request parameters, request should be accepted.
        """
        data = {
            "score": score,
            "weakPoints": weak_points,
            "strongPoints": strong_points,
            "language": language
        }
        result = validate_coaching_request(data)
        
        assert result.valid, f"Valid request rejected: {result.error_message}"
    
    @given(
        st.text(min_size=1, max_size=50),
        st.text(min_size=1, max_size=50),
        st.integers(min_value=0, max_value=100),
        st.sampled_from(list(SUPPORTED_LANGUAGES))
    )
    @settings(max_examples=100)
    def test_valid_review_request_accepted(
        self, song_title: str, song_artist: str, final_score: int, language: str
    ):
        """
        For any valid review request parameters, request should be accepted.
        """
        data = {
            "songTitle": song_title,
            "songArtist": song_artist,
            "finalScore": final_score,
            "language": language
        }
        result = validate_review_request(data)
        
        assert result.valid, f"Valid request rejected: {result.error_message}"
