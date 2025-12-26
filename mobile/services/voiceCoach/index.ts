/**
 * Voice Coach services barrel export
 */

export { ElevenLabsClient, getElevenLabsClient } from './ElevenLabsClient';
export { GeminiClient, getGeminiClient } from './GeminiClient';
export { AudioManager } from './AudioManager';
export type { AudioClip, AudioPriority, AudioManagerConfig } from './AudioManager';
export { PerformanceReviewer } from './PerformanceReviewer';
export type { GameSession, PerformanceReview, PerformanceReviewerConfig } from './PerformanceReviewer';
export { VoiceNavigation } from './VoiceNavigation';
export type { Router, VoiceNavigationConfig } from './VoiceNavigation';
export { ConversationAgent } from './ConversationAgent';
export type { ConversationMessage, ConversationContext, ConversationAgentConfig } from './ConversationAgent';
export { ErrorHandler, getErrorHandler } from './ErrorHandler';
export type { ErrorType, ErrorContext, ErrorHandlerConfig, VoiceFeatureStatus, ErrorHandlerState } from './ErrorHandler';
export { NetworkRetryQueue, getNetworkRetryQueue } from './NetworkRetryQueue';
export type { RequestType, QueuedRequest, NetworkRetryQueueConfig, NetworkStatus } from './NetworkRetryQueue';
export { ResponseCache, getResponseCache } from './ResponseCache';
export type { CacheEntry, ResponseCacheConfig, CacheStats } from './ResponseCache';
export { BatteryAdapter, DefaultBatteryProvider } from './BatteryAdapter';
export type { BatteryState, BatteryAdapterConfig, BatteryLevelProvider } from './BatteryAdapter';
export { RealTimeCoach } from './RealTimeCoach';
export type { RealTimeCoachConfig, FeedbackType } from './RealTimeCoach';
export { BackgroundAudioProcessor, getBackgroundAudioProcessor, resetBackgroundAudioProcessor } from './BackgroundAudioProcessor';
export type { AudioTask, AudioTaskResult, BackgroundAudioProcessorConfig } from './BackgroundAudioProcessor';
