'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themes, ThemeName, Theme, getTheme, defaultTheme } from '@/lib/theme';

interface ThemeContextType {
  themeName: ThemeName;
  theme: Theme;
  setThemeName: (name: ThemeName) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  lineNumbers: 'on' | 'off' | 'relative';
  setLineNumbers: (val: 'on' | 'off' | 'relative') => void;
  minimap: boolean;
  setMinimap: (enabled: boolean) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
  notifications: boolean;
  setNotifications: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>(defaultTheme);
  const [fontSize, setFontSizeState] = useState<number>(13);
  const [lineNumbers, setLineNumbersState] = useState<'on' | 'off' | 'relative'>('on');
  const [minimap, setMinimapState] = useState<boolean>(true);
  const [aiModel, setAiModelState] = useState<string>('claude-3-7-sonnet');
  const [notifications, setNotificationsState] = useState<boolean>(true);

  // Load persisted preferences
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('codemind_theme') as ThemeName;
      if (savedTheme && themes[savedTheme]) {
        setThemeNameState(savedTheme);
      }
      const savedFontSize = localStorage.getItem('codemind_font_size');
      if (savedFontSize) setFontSizeState(Number(savedFontSize));

      const savedLineNumbers = localStorage.getItem('codemind_line_numbers') as 'on' | 'off' | 'relative';
      if (savedLineNumbers) setLineNumbersState(savedLineNumbers);

      const savedMinimap = localStorage.getItem('codemind_minimap');
      if (savedMinimap !== null) setMinimapState(savedMinimap === 'true');

      const savedAiModel = localStorage.getItem('codemind_ai_model');
      if (savedAiModel) setAiModelState(savedAiModel);
    } catch {
      // Ignore localStorage issues
    }
  }, []);

  const setThemeName = (name: ThemeName) => {
    if (!themes[name]) return;
    setThemeNameState(name);
    try {
      localStorage.setItem('codemind_theme', name);
    } catch {}
  };

  const setFontSize = (size: number) => {
    setFontSizeState(size);
    try {
      localStorage.setItem('codemind_font_size', String(size));
    } catch {}
  };

  const setLineNumbers = (val: 'on' | 'off' | 'relative') => {
    setLineNumbersState(val);
    try {
      localStorage.setItem('codemind_line_numbers', val);
    } catch {}
  };

  const setMinimap = (enabled: boolean) => {
    setMinimapState(enabled);
    try {
      localStorage.setItem('codemind_minimap', String(enabled));
    } catch {}
  };

  const setAiModel = (model: string) => {
    setAiModelState(model);
    try {
      localStorage.setItem('codemind_ai_model', model);
    } catch {}
  };

  const setNotifications = (enabled: boolean) => {
    setNotificationsState(enabled);
  };

  const currentTheme = getTheme(themeName);

  // Update root CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', themeName);
    root.style.setProperty('--vscode-bg-editor', currentTheme.colors.editorBackground);
    root.style.setProperty('--vscode-bg-sidebar', currentTheme.colors.sidebarBackground);
    root.style.setProperty('--vscode-bg-activity', currentTheme.colors.activityBar);
    root.style.setProperty('--vscode-bg-statusbar', currentTheme.colors.statusBar);
    root.style.setProperty('--vscode-border', currentTheme.colors.border);
    root.style.setProperty('--vscode-fg-primary', currentTheme.colors.text);
    root.style.setProperty('--vscode-fg-muted', currentTheme.colors.textMuted);
    root.style.setProperty('--vscode-accent', currentTheme.colors.accent);
  }, [themeName, currentTheme]);

  return (
    <ThemeContext.Provider
      value={{
        themeName,
        theme: currentTheme,
        setThemeName,
        fontSize,
        setFontSize,
        lineNumbers,
        setLineNumbers,
        minimap,
        setMinimap,
        aiModel,
        setAiModel,
        notifications,
        setNotifications,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
