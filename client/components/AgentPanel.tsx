'use client';

// client/components/AgentPanel.tsx
// Canonical export for CodeMind AI Assistant Panel matching Master Prompt naming
import AIAssistantPanel, { AIAssistantPanelProps } from './ai/AIAssistantPanel';

export default function AgentPanel(props: AIAssistantPanelProps) {
  return <AIAssistantPanel {...props} />;
}
