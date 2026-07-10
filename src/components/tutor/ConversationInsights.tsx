'use client';

import { useMemo } from 'react';
import { Brain, TrendingUp, Lightbulb, BookOpen, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import type { ChatMessage } from '@/types';

interface ConversationInsightsProps {
  messages: ChatMessage[];
  masteryMap: Record<string, { level: number; evidence: string[]; lastAssessed: number; attempts: number }>;
}

/** Extracts and displays insights from the current conversation */
export function ConversationInsights({ messages, masteryMap }: ConversationInsightsProps) {
  const insights = useMemo(() => {
    if (messages.length < 2) return null;

    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    if (assistantMessages.length === 0) return null;

    // Extract key topics from assistant messages
    const topicPatterns = [
      { regex: /\b(enzyme|protein|DNA|RNA|cell|mitosis|meiosis|photosynthesis)\b/gi, topic: 'Biology', icon: BookOpen, color: 'text-emerald-400' },
      { regex: /\b(function|variable|loop|array|class|algorithm|data structure|recursion|API|database)\b/gi, topic: 'Computer Science', icon: Zap, color: 'text-violet-400' },
      { regex: /\b(integral|derivative|equation|calculus|algebra|geometry|theorem|proof|probability|statistics)\b/gi, topic: 'Mathematics', icon: TrendingUp, color: 'text-amber-400' },
      { regex: /\b(atom|molecule|reaction|electron|proton|neutron|bond|oxidation|reduction|thermodynamic|kinetic)\b/gi, topic: 'Chemistry', icon: Brain, color: 'text-pink-400' },
      { regex: /\b(velocity|force|gravity|momentum|energy|wave|light|electric|magnetic|quantum)\b/gi, topic: 'Physics', icon: Lightbulb, color: 'text-cyan-400' },
      { regex: /\b(history|war|civilization|revolution|empire|century|dynasty|political|economy)\b/gi, topic: 'History', icon: BookOpen, color: 'text-orange-400' },
    ];

    const detectedTopics: { topic: string; count: number; icon: typeof BookOpen; color: string }[] = [];
    const allText = assistantMessages.map((m) => m.content).join(' ');

    for (const pattern of topicPatterns) {
      const matches = allText.match(pattern.regex);
      if (matches && matches.length >= 2) {
        detectedTopics.push({
          topic: pattern.topic,
          count: matches.length,
          icon: pattern.icon,
          color: pattern.color,
        });
      }
    }

    // Sort by count descending
    detectedTopics.sort((a, b) => b.count - a.count);
    const topTopics = detectedTopics.slice(0, 3);

    // Compute conversation stats
    const totalWords = allText.split(/\s+/).length;
    const avgResponseLength = Math.round(totalWords / assistantMessages.length);
    const conceptsDiscussed = Object.keys(masteryMap).length;

    // Compute engagement level
    const userMessages = messages.filter((m) => m.role === 'user');
    const followUpCount = userMessages.filter((m) => m.content.length < 20).length;
    const engagementLevel = followUpCount > 2 ? 'High' : userMessages.length > 3 ? 'Medium' : 'Low';

    return {
      topTopics,
      totalWords,
      avgResponseLength,
      conceptsDiscussed,
      engagementLevel,
      messageCount: assistantMessages.length,
      userMessageCount: userMessages.length,
    };
  }, [messages, masteryMap]);

  if (!insights) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass card-shadow rounded-xl p-4 card-hover-shadow-lift"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-linear-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <Brain className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground">Session Insights</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {insights.messageCount} exchanges
        </Badge>
      </div>

      {/* Detected Topics */}
      {insights.topTopics.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Detected Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {insights.topTopics.map((t) => {
              const Icon = t.icon;
              return (
                <motion.div
                  key={t.topic}
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 border border-border/40 text-xs"
                >
                  <Icon className={`h-3 w-3 ${t.color}`} />
                  <span className="font-medium text-foreground">{t.topic}</span>
                  <span className="text-[10px] text-muted-foreground">{t.count}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-sm font-bold text-primary tabular-nums">{insights.conceptsDiscussed}</p>
          <p className="text-[10px] text-muted-foreground">Concepts</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-primary tabular-nums">{insights.avgResponseLength}</p>
          <p className="text-[10px] text-muted-foreground">Avg Words</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-primary">{insights.engagementLevel}</p>
          <p className="text-[10px] text-muted-foreground">Engagement</p>
        </div>
      </div>
    </motion.div>
  );
}
