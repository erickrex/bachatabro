/**
 * CoachSettings Component
 *
 * Provides UI controls for configuring voice coach settings:
 * - Enable/disable real-time coaching
 * - Enable/disable performance reviews
 * - Voice selection
 * - Language selection
 * - Coaching frequency slider
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import type { SupportedLanguage } from '../../types/voiceCoach';
import { VOICE_CONFIG } from '../../config/voiceConfig';

export interface CoachSettingsProps {
  enabled: boolean;
  language: SupportedLanguage;
  voiceId: string;
  realTimeCoachingEnabled: boolean;
  performanceReviewsEnabled: boolean;
  coachingFrequency: 'low' | 'normal' | 'high';
  onSettingsChange: (settings: Partial<CoachSettingsValues>) => void;
}

export interface CoachSettingsValues {
  enabled: boolean;
  language: SupportedLanguage;
  voiceId: string;
  realTimeCoachingEnabled: boolean;
  performanceReviewsEnabled: boolean;
  coachingFrequency: 'low' | 'normal' | 'high';
}

/**
 * CoachSettings Component
 *
 * Comprehensive settings panel for voice coach configuration.
 * All settings are persisted to local storage via the parent component.
 */
export function CoachSettings({
  enabled,
  language,
  voiceId,
  realTimeCoachingEnabled,
  performanceReviewsEnabled,
  coachingFrequency,
  onSettingsChange,
}: CoachSettingsProps): JSX.Element {
  const availableVoices = VOICE_CONFIG[language]?.availableVoices || [];
  const availableLanguages: SupportedLanguage[] = ['en', 'es', 'de', 'ru'];

  const getLanguageLabel = (lang: SupportedLanguage): string => {
    return VOICE_CONFIG[lang]?.name || lang.toUpperCase();
  };

  const getFrequencyLabel = (freq: 'low' | 'normal' | 'high'): string => {
    switch (freq) {
      case 'low':
        return 'Less Frequent (6s cooldown)';
      case 'normal':
        return 'Normal (3s cooldown)';
      case 'high':
        return 'More Frequent (1.5s cooldown)';
    }
  };

  const cycleFrequency = () => {
    const frequencies: Array<'low' | 'normal' | 'high'> = ['low', 'normal', 'high'];
    const currentIndex = frequencies.indexOf(coachingFrequency);
    const nextIndex = (currentIndex + 1) % frequencies.length;
    onSettingsChange({ coachingFrequency: frequencies[nextIndex] });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Voice Coach</Text>

        {/* Master Enable/Disable */}
        <View style={styles.settingRow}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>Enable Voice Coach</Text>
            <Text style={styles.settingDescription}>
              Turn on AI voice coaching and feedback
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={(value) => onSettingsChange({ enabled: value })}
            trackColor={{ false: '#6b7280', true: '#10b981' }}
            thumbColor={enabled ? '#fff' : '#f4f4f5'}
          />
        </View>
      </View>

      {/* Coaching Features */}
      <View style={[styles.section, !enabled && styles.sectionDisabled]}>
        <Text style={styles.sectionTitle}>Coaching Features</Text>

        {/* Real-Time Coaching Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>Real-Time Coaching</Text>
            <Text style={styles.settingDescription}>
              Get spoken tips while dancing
            </Text>
          </View>
          <Switch
            value={realTimeCoachingEnabled}
            onValueChange={(value) =>
              onSettingsChange({ realTimeCoachingEnabled: value })
            }
            disabled={!enabled}
            trackColor={{ false: '#6b7280', true: '#10b981' }}
            thumbColor={realTimeCoachingEnabled ? '#fff' : '#f4f4f5'}
          />
        </View>

        {/* Performance Reviews Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingLabel}>
            <Text style={styles.settingText}>Performance Reviews</Text>
            <Text style={styles.settingDescription}>
              Hear a summary after each dance
            </Text>
          </View>
          <Switch
            value={performanceReviewsEnabled}
            onValueChange={(value) =>
              onSettingsChange({ performanceReviewsEnabled: value })
            }
            disabled={!enabled}
            trackColor={{ false: '#6b7280', true: '#10b981' }}
            thumbColor={performanceReviewsEnabled ? '#fff' : '#f4f4f5'}
          />
        </View>

        {/* Coaching Frequency */}
        <TouchableOpacity
          style={styles.settingRow}
          onPress={cycleFrequency}
          disabled={!enabled || !realTimeCoachingEnabled}
        >
          <View style={styles.settingLabelFull}>
            <Text style={styles.settingText}>Coaching Frequency</Text>
            <Text style={styles.settingDescription}>
              {getFrequencyLabel(coachingFrequency)}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Voice & Language */}
      <View style={[styles.section, !enabled && styles.sectionDisabled]}>
        <Text style={styles.sectionTitle}>Voice & Language</Text>

        {/* Language Selection */}
        <View style={styles.settingRow}>
          <View style={styles.settingLabelFull}>
            <Text style={styles.settingText}>Language</Text>
            <Text style={styles.settingDescription}>
              Coach will speak in this language
            </Text>
          </View>
        </View>
        <View style={styles.optionsContainer}>
          {availableLanguages.map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.optionButton,
                language === lang && styles.optionButtonSelected,
              ]}
              onPress={() => onSettingsChange({ language: lang })}
              disabled={!enabled}
            >
              <Text
                style={[
                  styles.optionText,
                  language === lang && styles.optionTextSelected,
                ]}
              >
                {getLanguageLabel(lang)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Voice Selection */}
        <View style={styles.settingRow}>
          <View style={styles.settingLabelFull}>
            <Text style={styles.settingText}>Voice</Text>
            <Text style={styles.settingDescription}>
              Choose the coach's voice
            </Text>
          </View>
        </View>
        <View style={styles.optionsContainer}>
          {availableVoices.map((voice) => (
            <TouchableOpacity
              key={voice}
              style={[
                styles.optionButton,
                voiceId === voice && styles.optionButtonSelected,
              ]}
              onPress={() => onSettingsChange({ voiceId: voice })}
              disabled={!enabled}
            >
              <Text
                style={[
                  styles.optionText,
                  voiceId === voice && styles.optionTextSelected,
                ]}
              >
                {voice}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          💡 Voice coaching uses AI to provide personalized feedback during your dance sessions.
          All settings are saved automatically.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLabel: {
    flex: 1,
    marginRight: 16,
  },
  settingLabelFull: {
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  chevron: {
    fontSize: 24,
    color: '#9ca3af',
    fontWeight: '300',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  optionButtonSelected: {
    borderColor: '#10b981',
    backgroundColor: '#d1fae5',
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#059669',
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
});

