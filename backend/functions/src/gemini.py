"""
Gemini proxy endpoints for coaching intelligence.

Provides secure API access to Google Gemini for generating coaching tips
and performance reviews without exposing API keys to the client.
"""

import logging
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .middleware.rate_limiter import get_rate_limiter
from .middleware.validator import validate_coaching_request, validate_review_request

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/gemini", tags=["gemini"])

# Word count limits
MAX_COACHING_TIP_WORDS = 15
MAX_PERFORMANCE_REVIEW_WORDS = 100
MAX_CONVERSATION_RESPONSE_WORDS = 200

# Coach personality prompt
COACH_PERSONALITY = """
You are "Coach Rhythm", an enthusiastic AI dance instructor.

PERSONALITY:
- Encouraging and positive
- Uses dance terminology naturally
- Celebrates small wins
- Gives specific, actionable feedback
- Never discouraging or negative

CONSTRAINTS:
- Keep responses concise and energetic
- Focus on ONE improvement at a time
- Use simple, clear language
"""


def count_words(text: str) -> int:
    """Count words in text."""
    return len(text.split())


def truncate_to_word_limit(text: str, max_words: int) -> str:
    """Truncate text to word limit while keeping complete sentences."""
    words = text.split()
    if len(words) <= max_words:
        return text
    
    truncated = " ".join(words[:max_words])
    # Try to end at a sentence boundary
    for punct in [".", "!", "?"]:
        last_punct = truncated.rfind(punct)
        if last_punct > len(truncated) // 2:
            return truncated[:last_punct + 1]
    
    return truncated + "..."


# Pydantic models for request/response
class CoachingTipRequest(BaseModel):
    score: float = Field(..., ge=0, le=100)
    weakPoints: list[str] = Field(default_factory=list)
    strongPoints: list[str] = Field(default_factory=list)
    language: Optional[str] = Field(default="en", pattern="^(en|es|de|ru)$")


class CoachingTipResponse(BaseModel):
    tip: str
    targetBodyPart: str


class CoverageSummary(BaseModel):
    attemptedJoints: int = Field(..., ge=0)
    skippedJoints: int = Field(..., ge=0)
    skipFraction: float = Field(..., ge=0.0, le=1.0)
    topSkippedJoints: list[str] = Field(default_factory=list)


class PerformanceReviewRequest(BaseModel):
    songTitle: str = Field(..., min_length=1)
    songArtist: str = Field(..., min_length=1)
    finalScore: float = Field(..., ge=0, le=100)
    previousBest: Optional[float] = Field(default=None, ge=0, le=100)
    strongestPart: Optional[str] = Field(default="overall movement")
    weakestPart: Optional[str] = Field(default="timing")
    totalFrames: Optional[int] = Field(default=None, ge=0)
    language: Optional[str] = Field(default="en", pattern="^(en|es|de|ru)$")
    coverage: Optional[CoverageSummary] = None


class PerformanceReviewResponse(BaseModel):
    review: str
    improvementTip: str


@router.post("/coaching-tip", response_model=CoachingTipResponse)
async def generate_coaching_tip(request: Request, body: CoachingTipRequest):
    """
    Generate a coaching tip based on pose analysis.
    
    Args:
        body: CoachingTipRequest with score, weakPoints, strongPoints, language
        
    Returns:
        CoachingTipResponse with tip and targetBodyPart
    """
    # Check rate limit
    client_ip = request.headers.get("X-Forwarded-For", request.client.host)
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    
    rate_limiter = get_rate_limiter()
    result = rate_limiter.check(client_ip or "unknown")
    
    if not result.allowed:
        logger.warning(f"Rate limit exceeded for client: {client_ip}")
        raise HTTPException(
            status_code=429,
            detail={"error": "Too many requests", "retry_after": result.retry_after}
        )
    
    # Validate request
    validation = validate_coaching_request(body.model_dump())
    if not validation.valid:
        raise HTTPException(status_code=validation.error_code, detail=validation.error_message)
    
    score = body.score
    weak_points = body.weakPoints
    strong_points = body.strongPoints
    language = body.language or "en"
    
    logger.info(f"Coaching tip request: score={score}, weak={weak_points}, lang={language}")
    
    # Determine target body part (weakest)
    target_body_part = weak_points[0] if weak_points else "overall"
    
    # Build prompt
    language_instruction = ""
    if language != "en":
        language_names = {"es": "Spanish", "de": "German", "ru": "Russian"}
        language_instruction = f"\n\nIMPORTANT: Respond in {language_names.get(language, 'English')}."
    
    prompt = f"""{COACH_PERSONALITY}

Generate a SHORT coaching tip (MAXIMUM {MAX_COACHING_TIP_WORDS} words).

Current score: {score}%
Weak points: {', '.join(weak_points) if weak_points else 'none identified'}
Strong points: {', '.join(strong_points) if strong_points else 'none identified'}

Focus on improving: {target_body_part}
Be encouraging and specific. Give ONE actionable tip.{language_instruction}

Respond with ONLY the coaching tip, nothing else."""

    # Call Gemini API
    tip = _call_gemini(prompt)
    
    if tip is None:
        # Fallback to generic tip
        tip = _get_fallback_tip(language, score)
    
    # Ensure word limit
    tip = truncate_to_word_limit(tip, MAX_COACHING_TIP_WORDS)
    
    return CoachingTipResponse(
        tip=tip,
        targetBodyPart=target_body_part,
    )


@router.post("/performance-review", response_model=PerformanceReviewResponse)
async def generate_performance_review(request: Request, body: PerformanceReviewRequest):
    """
    Generate a performance review after a dance session.
    
    Args:
        body: PerformanceReviewRequest with song info, scores, and body part analysis
        
    Returns:
        PerformanceReviewResponse with review and improvementTip
    """
    # Check rate limit
    client_ip = request.headers.get("X-Forwarded-For", request.client.host)
    if client_ip:
        client_ip = client_ip.split(",")[0].strip()
    
    rate_limiter = get_rate_limiter()
    result = rate_limiter.check(client_ip or "unknown")
    
    if not result.allowed:
        logger.warning(f"Rate limit exceeded for client: {client_ip}")
        raise HTTPException(
            status_code=429,
            detail={"error": "Too many requests", "retry_after": result.retry_after}
        )
    
    # Validate request
    validation = validate_review_request(body.model_dump())
    if not validation.valid:
        raise HTTPException(status_code=validation.error_code, detail=validation.error_message)
    
    song_title = body.songTitle
    song_artist = body.songArtist
    final_score = body.finalScore
    previous_best = body.previousBest
    strongest_part = body.strongestPart or "overall movement"
    weakest_part = body.weakestPart or "timing"
    language = body.language or "en"
    coverage = body.coverage
    
    logger.info(f"Performance review request: {song_title}, score={final_score}, lang={language}")
    
    # Build comparison text
    comparison = ""
    if previous_best is not None:
        if final_score > previous_best:
            comparison = f"This beats your previous best of {previous_best}%!"
        elif final_score == previous_best:
            comparison = f"You matched your personal best of {previous_best}%!"
        else:
            comparison = f"Your personal best is {previous_best}%."

    coverage_block = ""
    coverage_instruction = ""
    coverage_guidance = "Only mention sensor reliability if the context naturally calls for it."
    if coverage:
        skip_percent = coverage.skipFraction * 100
        frequent_skips = ", ".join(coverage.topSkippedJoints[:3]) if coverage.topSkippedJoints else "none"
        coverage_block = f"""Pose Coverage:
- Attempted joints: {coverage.attemptedJoints}
- Skipped joints: {coverage.skippedJoints} (~{skip_percent:.1f}%)
- Frequently skipped joints: {frequent_skips}"""
        if coverage.skipFraction > 0.35:
            coverage_instruction = "\nIf skip fraction exceeds 35%, reassure the dancer and mention adjusting camera angle or lighting before focusing on technique."
            coverage_guidance = "Detector struggled; acknowledge it and encourage camera/lighting adjustments before coaching technique."
        else:
            coverage_guidance = "Mention how reliable the detector was and tie it into your advice."
    
    # Build prompt
    language_instruction = ""
    if language != "en":
        language_names = {"es": "Spanish", "de": "German", "ru": "Russian"}
        language_instruction = f"\n\nIMPORTANT: Respond in {language_names.get(language, 'English')}."
    
    prompt = f"""{COACH_PERSONALITY}

Generate a spoken performance review (MAXIMUM {MAX_PERFORMANCE_REVIEW_WORDS} words).

Song: {song_title} by {song_artist}
Final Score: {final_score}%
{comparison}
Strongest body part: {strongest_part}
Weakest body part: {weakest_part}
{coverage_block if coverage_block else ''}

Include:
1. Congratulate on the score
2. Mention comparison to previous best if available
3. Highlight the strongest body part
4. Give ONE tip for the weakest body part
5. Pose coverage guidance: {coverage_guidance}
6. End with a motivating question or call-to-action{coverage_instruction}{language_instruction}

Respond with ONLY the review, nothing else."""

    # Call Gemini API
    review = _call_gemini(prompt)
    
    if review is None:
        # Fallback to generic review
        review = _get_fallback_review(language, final_score, song_title)
    
    # Ensure word limit
    review = truncate_to_word_limit(review, MAX_PERFORMANCE_REVIEW_WORDS)
    
    # Generate improvement tip
    if coverage and coverage.skipFraction > 0.35:
        skip_percent = coverage.skipFraction * 100
        joints = ", ".join(coverage.topSkippedJoints[:2]) if coverage.topSkippedJoints else "key joints"
        improvement_tip = f"Pose tracking missed about {skip_percent:.0f}% of joints (especially {joints}). Adjust your camera angle or lighting, then focus on refining your {weakest_part}."
    else:
        improvement_tip = f"Focus on your {weakest_part} movements next time."
    
    return PerformanceReviewResponse(
        review=review,
        improvementTip=improvement_tip,
    )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "gemini-proxy"}


def _call_gemini(prompt: str) -> str | None:
    """
    Call Gemini API with the given prompt.
    
    Returns the generated text or None if the call fails.
    """
    try:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        
        if not project_id:
            logger.error("GOOGLE_CLOUD_PROJECT not configured")
            return None
        
        from google.cloud import aiplatform
        from vertexai.generative_models import GenerativeModel
        
        aiplatform.init(project=project_id, location=location)
        
        model = GenerativeModel("gemini-2.0-flash-001")
        response = model.generate_content(prompt)
        
        return response.text.strip()
        
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return None


def _get_fallback_tip(language: str, score: float) -> str:
    """Get a fallback coaching tip when API fails."""
    fallback_tips = {
        "en": {
            "low": "Keep those arms up higher!",
            "mid": "Great energy! Watch your timing.",
            "high": "Perfect! You're on fire!",
        },
        "es": {
            "low": "¡Mantén los brazos más arriba!",
            "mid": "¡Gran energía! Cuida el ritmo.",
            "high": "¡Perfecto! ¡Estás en llamas!",
        },
        "de": {
            "low": "Halte die Arme höher!",
            "mid": "Tolle Energie! Achte auf das Timing.",
            "high": "Perfekt! Du bist on fire!",
        },
        "ru": {
            "low": "Держи руки выше!",
            "mid": "Отличная энергия! Следи за ритмом.",
            "high": "Идеально! Ты в ударе!",
        },
    }
    
    level = "low" if score < 70 else "high" if score > 90 else "mid"
    return fallback_tips.get(language, fallback_tips["en"])[level]


def _get_fallback_review(language: str, score: float, song_title: str) -> str:
    """Get a fallback performance review when API fails."""
    fallback_reviews = {
        "en": f"Great job on {song_title}! You scored {score:.0f}%. Keep practicing and you'll keep improving. Ready for another round?",
        "es": f"¡Buen trabajo en {song_title}! Obtuviste {score:.0f}%. Sigue practicando y seguirás mejorando. ¿Listo para otra ronda?",
        "de": f"Gut gemacht bei {song_title}! Du hast {score:.0f}% erreicht. Übe weiter und du wirst dich verbessern. Bereit für eine weitere Runde?",
        "ru": f"Отличная работа над {song_title}! Ты набрал {score:.0f}%. Продолжай практиковаться. Готов к ещё одному раунду?",
    }
    
    return fallback_reviews.get(language, fallback_reviews["en"])
