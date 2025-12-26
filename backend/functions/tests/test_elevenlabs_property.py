"""
Property-based tests for ElevenLabs proxy endpoints.

Feature: elevenlabs-voice-coach
Property 4: Text Length Boundary Validation
Validates: Requirements 2.5
"""

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck

from src.middleware.validator import validate_tts_request, MAX_TEXT_LENGTH


class TestTextLengthBoundaryValidation:
    """
    Property 4: Text Length Boundary Validation
    
    For any text-to-speech request where text length exceeds 5000 characters,
    the backend proxy should reject the request with a 400 error.
    
    Validates: Requirements 2.5
    """
    
    @given(st.integers(min_value=MAX_TEXT_LENGTH + 1, max_value=MAX_TEXT_LENGTH + 100))
    @settings(max_examples=100)
    def test_text_exceeding_max_length_is_rejected(self, length: int):
        """
        Feature: elevenlabs-voice-coach, Property 4: Text Length Boundary Validation
        
        For any text longer than MAX_TEXT_LENGTH, validation should fail with 400.
        """
        long_text = "a" * length
        data = {"text": long_text}
        result = validate_tts_request(data)
        
        assert not result.valid, f"Text of length {len(long_text)} should be rejected"
        assert result.error_code == 400
        assert "maximum length" in result.error_message.lower()
    
    @given(st.text(min_size=1, max_size=MAX_TEXT_LENGTH))
    @settings(max_examples=100)
    def test_text_within_max_length_is_accepted(self, valid_text: str):
        """
        Feature: elevenlabs-voice-coach, Property 4: Text Length Boundary Validation
        
        For any text within MAX_TEXT_LENGTH, validation should pass (if non-empty).
        """
        # Skip whitespace-only strings as they're invalid for different reason
        if not valid_text.strip():
            return
            
        data = {"text": valid_text}
        result = validate_tts_request(data)
        
        assert result.valid, f"Text of length {len(valid_text)} should be accepted"
    
    @given(st.integers(min_value=MAX_TEXT_LENGTH + 1, max_value=MAX_TEXT_LENGTH * 2))
    @settings(max_examples=100)
    def test_boundary_at_exact_limit(self, length: int):
        """
        Feature: elevenlabs-voice-coach, Property 4: Text Length Boundary Validation
        
        For any text length > MAX_TEXT_LENGTH, validation should fail.
        """
        text = "a" * length
        data = {"text": text}
        result = validate_tts_request(data)
        
        assert not result.valid
        assert result.error_code == 400
    
    def test_text_at_exact_max_length_is_accepted(self):
        """
        Edge case: Text at exactly MAX_TEXT_LENGTH should be accepted.
        """
        text = "a" * MAX_TEXT_LENGTH
        data = {"text": text}
        result = validate_tts_request(data)
        
        assert result.valid, f"Text at exactly {MAX_TEXT_LENGTH} chars should be accepted"
    
    def test_text_one_over_max_length_is_rejected(self):
        """
        Edge case: Text at MAX_TEXT_LENGTH + 1 should be rejected.
        """
        text = "a" * (MAX_TEXT_LENGTH + 1)
        data = {"text": text}
        result = validate_tts_request(data)
        
        assert not result.valid
        assert result.error_code == 400


class TestRequestValidation:
    """Additional validation property tests."""
    
    @given(st.sampled_from(["en", "es", "de", "ru"]))
    @settings(max_examples=100)
    def test_supported_languages_are_accepted(self, language: str):
        """
        For any supported language, validation should pass.
        """
        data = {"text": "Hello world", "language": language}
        result = validate_tts_request(data)
        
        assert result.valid, f"Language '{language}' should be accepted"
    
    @given(st.text(min_size=1, max_size=10).filter(lambda x: x not in ["en", "es", "de", "ru"]))
    @settings(max_examples=100)
    def test_unsupported_languages_are_rejected(self, language: str):
        """
        For any unsupported language, validation should fail.
        """
        data = {"text": "Hello world", "language": language}
        result = validate_tts_request(data)
        
        assert not result.valid
        assert result.error_code == 400
        assert "unsupported language" in result.error_message.lower()
