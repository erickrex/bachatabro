/**
 * Integration check - verifies all imports work correctly
 * This file should compile without errors
 */

// Test importing the component
import { DualVideoView } from './DualVideoView';
import type { DualVideoViewProps } from './DualVideoView';

// Test importing from barrel export
import { DualVideoView as DualVideoViewBarrel } from './index';

// Test importing dependencies
import { VideoPlayer } from '../Video/VideoPlayer';
import { CameraView } from '../Camera/CameraView';

// Type check
const props: DualVideoViewProps = {
  videoUri: 'test.mp4',
  isPlaying: true,
  onFrame: (base64: string) => console.log(base64),
  onVideoEnd: () => console.log('ended'),
  onVideoReady: () => console.log('ready'),
  onError: (error: string) => console.error(error),
};

// Verify types are correct
const component: typeof DualVideoView = DualVideoViewBarrel;

export { DualVideoView, DualVideoViewProps };
