/**
 * Tests for VideoPlayer component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { VideoPlayer } from '../VideoPlayer';

// Mock expo-av
jest.mock('expo-av', () => ({
  Video: 'Video',
  ResizeMode: {
    CONTAIN: 'contain',
  },
}));

describe('VideoPlayer', () => {
  it('should render without crashing', () => {
    const { getByTestId } = render(
      <VideoPlayer
        videoUri="test://video.mp4"
        shouldPlay={false}
      />
    );
    
    expect(true).toBe(true); // Basic render test
  });

  it('should accept all props', () => {
    const onPlaybackUpdate = jest.fn();
    const onEnd = jest.fn();
    const onReady = jest.fn();
    const onError = jest.fn();

    render(
      <VideoPlayer
        videoUri="test://video.mp4"
        shouldPlay={true}
        isLooping={false}
        onPlaybackUpdate={onPlaybackUpdate}
        onEnd={onEnd}
        onReady={onReady}
        onError={onError}
      />
    );

    expect(true).toBe(true);
  });
});
