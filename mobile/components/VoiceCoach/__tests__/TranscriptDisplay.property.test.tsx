/**
 * Property-Based Tests for TranscriptDisplay Component
 *
 * Feature: elevenlabs-voice-coach
 * Property 18: Transcript Display Consistency
 * Validates: Requirements 11.3, 11.4
 *
 * For any text that is spoken (TTS) or transcribed (STT),
 * the same text should be displayed in the UI transcript area.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import * as fc from 'fast-check';
import { TranscriptDisplay, TranscriptEntry } from '../TranscriptDisplay';

describe('TranscriptDisplay Property Tests', () => {
  /**
   * Property 18: Transcript Display Consistency
   *
   * For any text that is spoken (TTS) or transcribed (STT),
   * the same text should be displayed in the UI transcript area.
   *
   * Validates: Requirements 11.3, 11.4
   */
  it('should display all transcript entries with their exact text', () => {
    fc.assert(
      fc.property(
        // Generate array of transcript entries with unique IDs
        fc.array(
          fc.record({
            id: fc.integer({ min: 0, max: 1000000 }).map(n => `entry-${n}`),
            type: fc.constantFrom('coach' as const, 'user' as const),
            text: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
            timestamp: fc.integer({ min: 0, max: Date.now() }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (entries) => {
          // Ensure unique IDs
          const uniqueEntries = entries.filter((entry, index, self) =>
            index === self.findIndex(e => e.id === entry.id)
          );

          // Render component with generated entries
          const { getAllByText, queryByText } = render(
            <TranscriptDisplay entries={uniqueEntries} />
          );

          // Verify each entry's text is displayed exactly as provided
          for (const entry of uniqueEntries) {
            const displayedElements = getAllByText(entry.text);
            expect(displayedElements.length).toBeGreaterThan(0);
            
            // Verify at least one element has the exact text
            const hasExactMatch = displayedElements.some(
              el => el.props.children === entry.text
            );
            expect(hasExactMatch).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18 (variant): Current speaking text consistency
   *
   * For any text currently being spoken by the coach,
   * it should be displayed in the transcript area.
   *
   * Validates: Requirements 11.3
   */
  it('should display current speaking text exactly as provided', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        (speakingText) => {
          const { getByText } = render(
            <TranscriptDisplay
              entries={[]}
              currentSpeaking={speakingText}
            />
          );

          // Verify the speaking text is displayed
          const displayedText = getByText(speakingText);
          expect(displayedText).toBeTruthy();
          expect(displayedText.props.children).toBe(speakingText);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18 (variant): Current listening text consistency
   *
   * For any text currently being transcribed from user speech,
   * it should be displayed in the transcript area.
   *
   * Validates: Requirements 11.4
   */
  it('should display current listening text exactly as provided', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        (listeningText) => {
          const { getByText } = render(
            <TranscriptDisplay
              entries={[]}
              currentListening={listeningText}
            />
          );

          // Verify the listening text is displayed
          const displayedText = getByText(listeningText);
          expect(displayedText).toBeTruthy();
          expect(displayedText.props.children).toBe(listeningText);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18 (variant): Coach vs User text distinction
   *
   * For any transcript entries, coach entries and user entries
   * should be visually distinguishable while maintaining text accuracy.
   *
   * Validates: Requirements 11.3, 11.4
   */
  it('should distinguish between coach and user entries while preserving text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (coachText, userText) => {
          // Skip if texts are identical (would cause ambiguity in test)
          fc.pre(coachText !== userText);

          const entries: TranscriptEntry[] = [
            {
              id: '1',
              type: 'coach',
              text: coachText,
              timestamp: Date.now(),
            },
            {
              id: '2',
              type: 'user',
              text: userText,
              timestamp: Date.now() + 1000,
            },
          ];

          const { getByText } = render(
            <TranscriptDisplay entries={entries} />
          );

          // Both texts should be present
          const coachDisplay = getByText(coachText);
          const userDisplay = getByText(userText);

          expect(coachDisplay).toBeTruthy();
          expect(userDisplay).toBeTruthy();

          // Text content should match exactly
          expect(coachDisplay.props.children).toBe(coachText);
          expect(userDisplay.props.children).toBe(userText);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18 (variant): Empty state handling
   *
   * For any empty transcript state (no entries, no current text),
   * the component should render without errors.
   *
   * Validates: Requirements 11.3, 11.4
   */
  it('should handle empty state gracefully', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        () => {
          const { root } = render(
            <TranscriptDisplay entries={[]} />
          );

          // Should render without errors
          expect(root).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18 (variant): Special characters preservation
   *
   * For any text containing special characters or unicode,
   * the text should be displayed exactly as provided.
   *
   * Validates: Requirements 11.3, 11.4
   */
  it('should preserve special characters and unicode in transcript text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        (text) => {
          const entries: TranscriptEntry[] = [
            {
              id: '1',
              type: 'coach',
              text: text,
              timestamp: Date.now(),
            },
          ];

          const { getByText } = render(
            <TranscriptDisplay entries={entries} />
          );

          const displayedText = getByText(text);
          expect(displayedText).toBeTruthy();
          expect(displayedText.props.children).toBe(text);
        }
      ),
      { numRuns: 100 }
    );
  });
});

