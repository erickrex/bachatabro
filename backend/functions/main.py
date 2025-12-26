"""
FastAPI application entry point for Bacha Trainer backend proxy.

Combines ElevenLabs and Gemini routers into a single FastAPI application.
"""

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from src.elevenlabs import router as elevenlabs_router
from src.gemini import router as gemini_router

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Bacha Trainer Voice Coach API",
    description="Backend proxy for ElevenLabs TTS/STT and Google Gemini coaching",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(elevenlabs_router)
app.include_router(gemini_router)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "Bacha Trainer Voice Coach API",
        "version": "1.0.0",
        "endpoints": {
            "elevenlabs": "/elevenlabs",
            "gemini": "/gemini",
        },
    }


@app.get("/health")
async def health():
    """Global health check endpoint."""
    return {"status": "healthy", "service": "bacha-trainer-backend"}


# AWS Lambda / Google Cloud Functions handler
handler = Mangum(app)
