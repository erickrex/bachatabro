"""
ElevenLabs proxy endpoints for Text-to-Speech and Speech-to-Text.

Provides secure API access to ElevenLabs without exposing API keys to the client.
"""

import base64
import logging
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .middleware.rate_limiter import get_rate_limiter
from .middleware.validator import validate_tts_request, validate_stt_request

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/elevenlabs", tags=["elevenlabs"])

# Voice configuration by language
# Using actual ElevenLabs voice IDs (not display names)
# See: https://elevenlabs.io/docs/api-reference/voices
VOICE_CONFIG = {
    "en": {
        "default": "21m00Tcm4TlvDq8ikWAM",  # Rachel
        "available": {
            "Rachel": "21m00Tcm4TlvDq8ikWAM",
            "Drew": "29vD33N1CtxCmqQRPOHJ",
            "Clyde": "2EiwWnXFnvU5JabPnv8n",
            "Paul": "5Q0t7uMcjvnagumLfvZi",
            "Domi": "AZnzlk1XvdvUeBnXmlld",
        },
        "model": "eleven_turbo_v2",
    },
    "es": {
        "default": "XrExE9yKIg1WjnnlVkGX",  # Laura (multilingual)
        "available": {
            "Laura": "XrExE9yKIg1WjnnlVkGX",
        },
        "model": "eleven_multilingual_v2",
    },
    "de": {
        "default": "ErXwobaYiN019PkySvjV",  # Antoni (multilingual, works for German)
        "available": {
            "Antoni": "ErXwobaYiN019PkySvjV",
        },
        "model": "eleven_multilingual_v2",
    },
    "ru": {
        "default": "ErXwobaYiN019PkySvjV",  # Antoni (multilingual, works for Russian)
        "available": {
            "Antoni": "ErXwobaYiN019PkySvjV",
        },
        "model": "eleven_multilingual_v2",
    },
}


# Pydantic models for request/response
class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voiceId: Optional[str] = None
    language: Optional[str] = Field(default="en", pattern="^(en|es|de|ru)$")


class TTSResponse(BaseModel):
    audio: str
    format: str
    durationMs: int


class STTRequest(BaseModel):
    audio: str = Field(..., min_length=1)
    language: Optional[str] = Field(default="en", pattern="^(en|es|de|ru)$")


class STTResponse(BaseModel):
    transcript: str
    confidence: float
    language: str


@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(request: Request, body: TTSRequest):
    """
    Convert text to speech using ElevenLabs.
    
    Args:
        body: TTSRequest with text, voiceId, and language
        
    Returns:
        TTSResponse with base64 encoded audio
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
    validation = validate_tts_request(body.model_dump())
    if not validation.valid:
        raise HTTPException(status_code=validation.error_code, detail=validation.error_message)
    
    language = body.language or "en"
    config = VOICE_CONFIG.get(language, VOICE_CONFIG["en"])
    
    # If voiceId provided, use it directly; otherwise use default
    # voiceId can be either a voice ID or a voice name
    voice_id = body.voiceId
    if not voice_id:
        voice_id = config["default"]
    elif voice_id in config.get("available", {}):
        # Map voice name to ID if it's a name
        voice_id = config["available"][voice_id]
    # Otherwise assume it's already a valid voice ID
    
    model_id = config["model"]
    
    logger.info(f"TTS request: {len(body.text)} chars, voice={voice_id}, lang={language}")
    
    # Get ElevenLabs API key
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        logger.error("ELEVENLABS_API_KEY not configured")
        raise HTTPException(status_code=500, detail="Service not configured")
    
    try:
        from elevenlabs import ElevenLabs
        
        client = ElevenLabs(api_key=api_key)
        
        audio_generator = client.text_to_speech.convert(
            voice_id=voice_id,
            text=body.text,
            model_id=model_id,
        )
        
        # Collect audio chunks
        audio_chunks = []
        for chunk in audio_generator:
            audio_chunks.append(chunk)
        
        audio_bytes = b"".join(audio_chunks)
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        
        # Estimate duration (rough: ~10 chars per second for speech)
        estimated_duration_ms = int(len(body.text) * 100)
        
        return TTSResponse(
            audio=audio_base64,
            format="mp3",
            durationMs=estimated_duration_ms,
        )
        
    except Exception as e:
        logger.error(f"ElevenLabs API error: {e}")
        raise HTTPException(status_code=500, detail="Text-to-speech conversion failed")


@router.post("/stt", response_model=STTResponse)
async def speech_to_text(request: Request, body: STTRequest):
    """
    Convert speech to text using ElevenLabs.
    
    Args:
        body: STTRequest with base64 audio and language
        
    Returns:
        STTResponse with transcript
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
    validation = validate_stt_request(body.model_dump())
    if not validation.valid:
        raise HTTPException(status_code=validation.error_code, detail=validation.error_message)
    
    language = body.language or "en"
    
    logger.info(f"STT request: {len(body.audio)} chars base64, lang={language}")
    
    # Get ElevenLabs API key
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        logger.error("ELEVENLABS_API_KEY not configured")
        raise HTTPException(status_code=500, detail="Service not configured")
    
    # Decode audio
    try:
        audio_bytes = base64.b64decode(body.audio)
    except Exception as e:
        logger.error(f"Failed to decode audio: {e}")
        raise HTTPException(status_code=400, detail="Invalid base64 audio data")
    
    try:
        from elevenlabs import ElevenLabs
        
        client = ElevenLabs(api_key=api_key)
        
        result = client.speech_to_text.convert(
            audio=audio_bytes,
            language_code=language,
        )
        
        return STTResponse(
            transcript=result.text,
            confidence=getattr(result, "confidence", 0.9),
            language=language,
        )
        
    except Exception as e:
        logger.error(f"ElevenLabs STT API error: {e}")
        raise HTTPException(status_code=500, detail="Speech-to-text conversion failed")


@router.get("/voices")
async def get_voices(language: Optional[str] = None):
    """Get available voices by language."""
    if language:
        if language not in VOICE_CONFIG:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")
        config = VOICE_CONFIG[language]
        return {
            language: {
                "default": config["default"],
                "available": list(config.get("available", {}).keys()),
                "model": config["model"],
            }
        }
    
    # Return all languages with voice names (not IDs) for client display
    result = {}
    for lang, config in VOICE_CONFIG.items():
        result[lang] = {
            "default": config["default"],
            "available": list(config.get("available", {}).keys()),
            "model": config["model"],
        }
    return result


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "elevenlabs-proxy"}
