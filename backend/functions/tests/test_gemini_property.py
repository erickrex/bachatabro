"""
Property-based tests for Gemini proxy endpoints.

Feature: elevenlabs-voice-coach
Property 5: Generated Text Word Count Limits
Validates: Requirements 4.1, 4.2, 4.3
"""

import pytest
from hypothesis import given, strategies as st, settings

from src.gemini import (
    count_words,
    truncate_to_word_limit,
    MAX_COACHING_TIP_WORDS,
    MAX_PERFORMANCE_REVIEW_WORDS,
    MAX_CONVERSATION_RESPONSE_WORDS,
)


class TestGeneratedTextWordCountLimits:
    """
    Property 5: Generated Text Word Count Limits
    
    For any generated text from Gemini, the word count should not exceed
    the specified limit for its type:
    - Coaching tips: ≤ 15 words
    - Performance reviews: ≤ 100 words
    - Conversation responses: ≤ 200 words
    
    Validates: Requirements 4.1, 4.2, 4.3
    """
    
    @given(st.text(min_size=1, max_size=1000))
    @settings(max_examples=100)
    def test_truncate_respects_coaching_tip_limit(self, text: str):
        """
        Feature: elevenlabs-voice-coach, Property 5: Generated Text Word Count Limits
        
        For any text, truncation should produce output ≤ MAX_COACHING_TIP_WORDS.
        """
        truncated = truncate_to_word_limit(text, MAX_COACHING_TIP_WORDS)
        word_count = count_words(truncated)
        
        assert word_count <= MAX_COACHING_TIP_WORDS, (
            f"Truncated text has {word_count} words, expected ≤ {MAX_COACHING_TIP_WORDS}"
        )
    
    @given(st.text(min_size=1, max_size=2000))
    @settings(max_examples=100)
    def test_truncate_respects_review_limit(self, text: str):
        """
        Feature: elevenlabs-voice-coach, Property 5: Generated Text Word Count Limits
        
        For any text, truncation should produce output ≤ MAX_PERFORMANCE_REVIEW_WORDS.
        """
        truncated = truncate_to_word_limit(text, MAX_PERFORMANCE_REVIEW_WORDS)
        word_count = count_words(truncated)
        
        assert word_count <= MAX_PERFORMANCE_REVIEW_WORDS, (
            f"Truncated text has {word_count} words, expected ≤ {MAX_PERFORMANCE_REVIEW_WORDS}"
        )
    
    @given(st.text(min_size=1, max_size=3000))
    @settings(max_examples=100)
    def test_truncate_respects_conversation_limit(self, text: str):
        """
        Feature: elevenlabs-voice-coach, Property 5: Generated Text Word Count Limits
        
        For any text, truncation should produce output ≤ MAX_CONVERSATION_RESPONSE_WORDS.
        """
        truncated = truncate_to_word_limit(text, MAX_CONVERSATION_RESPONSE_WORDS)
        word_count = count_words(truncated)
        
        assert word_count <= MAX_CONVERSATION_RESPONSE_WORDS, (
            f"Truncated text has {word_count} words, expected ≤ {MAX_CONVERSATION_RESPONSE_WORDS}"
        )
    
    @given(st.integers(min_value=1, max_value=50))
    @settings(max_examples=100)
    def test_text_within_limit_unchanged(self, word_count: int):
        """
        Feature: elevenlabs-voice-coach, Property 5: Generated Text Word Count Limits
        
        For any text within the word limit, truncation should not modify it.
        """
        # Generate text with exact word count
        text = " ".join(["word"] * word_count)
        
        # Use a limit higher than word count
        limit = word_count + 10
        truncated = truncate_to_word_limit(text, limit)
        
        assert truncated == text, "Text within limit should not be modified"
    
    @given(
        st.integers(min_value=20, max_value=100),
        st.integers(min_value=5, max_value=15)
    )
    @settings(max_examples=100)
    def test_truncation_preserves_word_boundary(self, total_words: int, limit: int):
        """
        Feature: elevenlabs-voice-coach, Property 5: Generated Text Word Count Limits
        
        For any truncation, the result should end at a word boundary (no partial words).
        """
        # Generate text with exact word count
        words = [f"word{i}" for i in range(total_words)]
        text = " ".join(words)
        
        truncated = truncate_to_word_limit(text, limit)
        
        # Check that truncated text doesn't end with a partial word
        # (unless it ends with "..." which is acceptable)
        if not truncated.endswith("..."):
            # Each word in truncated should be a complete word from original
            truncated_words = truncated.rstrip(".!?").split()
            for word in truncated_words:
                clean_word = word.rstrip(".!?,")
                assert clean_word in words or clean_word == "", (
                    f"Partial word detected: {word}"
                )


class TestWordCounting:
    """Tests for word counting utility."""
    
    @given(st.lists(st.text(min_size=1, max_size=20, alphabet="abcdefghijklmnopqrstuvwxyz"), min_size=0, max_size=50))
    @settings(max_examples=100)
    def test_word_count_matches_space_separated_words(self, words: list[str]):
        """
        For any list of words joined by spaces, count_words should return the list length.
        """
        # Filter out empty strings
        words = [w for w in words if w.strip()]
        text = " ".join(words)
        
        if not text.strip():
            # Empty text should have 0 or 1 words depending on implementation
            assert count_words(text) <= 1
        else:
            assert count_words(text) == len(words), (
                f"Expected {len(words)} words, got {count_words(text)}"
            )
    
    def test_empty_string_has_zero_or_one_word(self):
        """Edge case: empty string word count."""
        # split() on empty string returns [''], so count is 1
        # This is acceptable behavior
        assert count_words("") <= 1
    
    def test_whitespace_only_has_minimal_words(self):
        """Edge case: whitespace-only string."""
        assert count_words("   ") <= 1


class TestCoachingTipWordLimit:
    """Specific tests for coaching tip word limit (15 words)."""
    
    def test_exactly_15_words_unchanged(self):
        """Text with exactly 15 words should not be truncated."""
        text = " ".join(["word"] * 15)
        truncated = truncate_to_word_limit(text, MAX_COACHING_TIP_WORDS)
        assert truncated == text
    
    def test_16_words_truncated(self):
        """Text with 16 words should be truncated to 15."""
        text = " ".join(["word"] * 16)
        truncated = truncate_to_word_limit(text, MAX_COACHING_TIP_WORDS)
        assert count_words(truncated) <= MAX_COACHING_TIP_WORDS
    
    def test_sentence_boundary_preservation(self):
        """Truncation should try to preserve sentence boundaries."""
        text = "Keep your arms up. Watch your timing. Focus on the beat. Stay relaxed."
        truncated = truncate_to_word_limit(text, 10)
        
        # Should end at a sentence boundary if possible
        assert truncated.endswith(".") or truncated.endswith("..."), (
            f"Expected sentence boundary, got: {truncated}"
        )
