"""
Request validation middleware for API endpoints.

Validates incoming requests and returns appropriate error responses.
"""

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Constants
MAX_TEXT_LENGTH = 5000
MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
SUPPORTED_LANGUAGES = {"en", "es", "de", "ru"}

# Error code mapping
ERROR_CODES = {
    "bad_request": 400,
    "unauthorized": 401,
    "rate_limited": 429,
    "server_error": 500,
}


@dataclass
class ValidationResult:
    """Result of request validation."""
    valid: bool
    error_code: Optional[int] = None
    error_message: Optional[str] = None
    error_type: Optional[str] = None


def log_validation_error(error_type: str, message: str, data: dict[str, Any] = None) -> None:
    """Log validation errors for monitoring."""
    logger.warning(f"Validation error [{error_type}]: {message}", extra={"request_data": data})


def validate_tts_request(data: dict[str, Any]) -> ValidationResult:
    """
    Validate text-to-speech request.
    
    Args:
        data: Request body containing text, voiceId, language.
        
    Returns:
        ValidationResult with valid status or error details.
    """
    if not data:
        log_validation_error("bad_request", "Request body is required")
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Request body is required",
            error_type="bad_request"
        )
    
    # Check required field: text
    text = data.get("text")
    if not text:
        log_validation_error("bad_request", "Field 'text' is required", data)
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'text' is required",
            error_type="bad_request"
        )
    
    if not isinstance(text, str):
        log_validation_error("bad_request", "Field 'text' must be a string", data)
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'text' must be a string",
            error_type="bad_request"
        )
    
    # Check text length
    if len(text) > MAX_TEXT_LENGTH:
        log_validation_error("bad_request", f"Text exceeds maximum length of {MAX_TEXT_LENGTH}", data)
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message=f"Text exceeds maximum length of {MAX_TEXT_LENGTH} characters",
            error_type="bad_request"
        )
    
    if len(text.strip()) == 0:
        log_validation_error("bad_request", "Field 'text' cannot be empty", data)
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'text' cannot be empty or whitespace only",
            error_type="bad_request"
        )
    
    # Check optional language field
    language = data.get("language")
    if language and language not in SUPPORTED_LANGUAGES:
        log_validation_error("bad_request", f"Unsupported language '{language}'", data)
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message=f"Unsupported language '{language}'. Supported: {', '.join(SUPPORTED_LANGUAGES)}",
            error_type="bad_request"
        )
    
    return ValidationResult(valid=True)


def validate_stt_request(data: dict[str, Any]) -> ValidationResult:
    """
    Validate speech-to-text request.
    
    Args:
        data: Request body containing audio (base64), language.
        
    Returns:
        ValidationResult with valid status or error details.
    """
    if not data:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Request body is required"
        )
    
    # Check required field: audio
    audio = data.get("audio")
    if not audio:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'audio' is required"
        )
    
    if not isinstance(audio, str):
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'audio' must be a base64 encoded string"
        )
    
    # Estimate decoded size (base64 is ~4/3 of original)
    estimated_size = len(audio) * 3 // 4
    if estimated_size > MAX_AUDIO_SIZE_BYTES:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message=f"Audio exceeds maximum size of {MAX_AUDIO_SIZE_BYTES // (1024*1024)}MB"
        )
    
    # Check optional language field
    language = data.get("language")
    if language and language not in SUPPORTED_LANGUAGES:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message=f"Unsupported language '{language}'. Supported: {', '.join(SUPPORTED_LANGUAGES)}"
        )

    coverage = data.get("coverage")
    if coverage is not None:
        if not isinstance(coverage, dict):
            return ValidationResult(
                valid=False,
                error_code=400,
                error_message="Field 'coverage' must be an object"
            )
        skip_fraction = coverage.get("skipFraction")
        attempted = coverage.get("attemptedJoints")
        skipped = coverage.get("skippedJoints")
        if not isinstance(skip_fraction, (int, float)) or not 0 <= float(skip_fraction) <= 1:
            return ValidationResult(
                valid=False,
                error_code=400,
                error_message="Field 'coverage.skipFraction' must be between 0 and 1"
            )
        if not isinstance(attempted, int) or attempted < 0:
            return ValidationResult(
                valid=False,
                error_code=400,
                error_message="Field 'coverage.attemptedJoints' must be a non-negative integer"
            )
        if not isinstance(skipped, int) or skipped < 0:
            return ValidationResult(
                valid=False,
                error_code=400,
                error_message="Field 'coverage.skippedJoints' must be a non-negative integer"
            )
        top_skipped = coverage.get("topSkippedJoints")
        if top_skipped is not None and not isinstance(top_skipped, list):
            return ValidationResult(
                valid=False,
                error_code=400,
                error_message="Field 'coverage.topSkippedJoints' must be an array"
            )
    
    return ValidationResult(valid=True)


def validate_coaching_request(data: dict[str, Any]) -> ValidationResult:
    """
    Validate coaching tip request.
    
    Args:
        data: Request body containing score, weakPoints, strongPoints, language.
        
    Returns:
        ValidationResult with valid status or error details.
    """
    if not data:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Request body is required"
        )
    
    # Check required field: score
    score = data.get("score")
    if score is None:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'score' is required"
        )
    
    if not isinstance(score, (int, float)):
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'score' must be a number"
        )
    
    if not 0 <= score <= 100:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'score' must be between 0 and 100"
        )
    
    # Check weakPoints and strongPoints (optional but should be lists if present)
    for field in ["weakPoints", "strongPoints"]:
        value = data.get(field)
        if value is not None and not isinstance(value, list):
            return ValidationResult(
                valid=False,
                error_code=400,
                error_message=f"Field '{field}' must be an array"
            )
    
    # Check optional language field
    language = data.get("language")
    if language and language not in SUPPORTED_LANGUAGES:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message=f"Unsupported language '{language}'. Supported: {', '.join(SUPPORTED_LANGUAGES)}"
        )
    
    return ValidationResult(valid=True)


def validate_review_request(data: dict[str, Any]) -> ValidationResult:
    """
    Validate performance review request.
    
    Args:
        data: Request body containing session data.
        
    Returns:
        ValidationResult with valid status or error details.
    """
    if not data:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Request body is required"
        )
    
    # Check required fields
    required_fields = ["songTitle", "songArtist", "finalScore"]
    for field in required_fields:
        if field not in data:
            return ValidationResult(
                valid=False,
                error_code=400,
                error_message=f"Field '{field}' is required"
            )
    
    # Validate finalScore
    final_score = data.get("finalScore")
    if not isinstance(final_score, (int, float)):
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'finalScore' must be a number"
        )
    
    if not 0 <= final_score <= 100:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message="Field 'finalScore' must be between 0 and 100"
        )
    
    # Check optional language field
    language = data.get("language")
    if language and language not in SUPPORTED_LANGUAGES:
        return ValidationResult(
            valid=False,
            error_code=400,
            error_message=f"Unsupported language '{language}'. Supported: {', '.join(SUPPORTED_LANGUAGES)}"
        )
    
    return ValidationResult(valid=True)
