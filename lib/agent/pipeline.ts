import { scout } from './scout';
import { judge } from './judge';
import { analyst } from './analyst';
import { editor } from './editor';
import type { PipelineInput, PipelineCallbacks, ArtifactContent, Language } from '@/lib/types';

const MIN_SOURCES_THRESHOLD = 3;

const INSUFFICIENT_CONTENT_MESSAGES: Record<Language, string> = {
  en: 'Insufficient relevant content within the specified time range',
  zh: '在指定时间范围内没有找到足够的相关内容',
};

export async function runPipeline(
  input: PipelineInput,
  callbacks?: PipelineCallbacks
): Promise<ArtifactContent> {
  // 1. Scout: Search for content using Gemini Grounding
  callbacks?.onStageStart?.('scout');
  const scoutResult = await scout(input.topicIntent, input.timeWindow, input.language);
  callbacks?.onStageComplete?.('scout', scoutResult);

  // 2. Judge: Filter and deduplicate (with date range filtering)
  callbacks?.onStageStart?.('judge');
  const judgeResult = await judge(
    scoutResult.sources,
    input.topicIntent,
    input.language,
    scoutResult.dateRange
  );
  callbacks?.onStageComplete?.('judge', judgeResult);

  // 3. Check minimum threshold
  if (judgeResult.keptSources.length < MIN_SOURCES_THRESHOLD) {
    return {
      meta: {
        topicIntent: input.topicIntent,
        timeWindow: input.timeWindow,
        outputMode: input.outputMode,
        generatedAt: new Date().toISOString(),
        dateRange: scoutResult.dateRange,
      },
      sources: judgeResult.allSources,
      insights: [],
      output: {
        title: input.language === 'zh' ? '内容不足' : 'Insufficient Content',
        body: '',
        agentStatement: '',
        uncertainties: [],
      },
      insufficientContent: {
        message: INSUFFICIENT_CONTENT_MESSAGES[input.language],
        foundCount: judgeResult.keptSources.length,
        requiredCount: MIN_SOURCES_THRESHOLD,
      },
    };
  }

  // 4. Analyst: Extract insights
  callbacks?.onStageStart?.('analyst');
  const analystResult = await analyst(judgeResult.keptSources, input.topicIntent, input.language);
  callbacks?.onStageComplete?.('analyst', analystResult);

  // 5. Editor: Generate final output in the specified language
  callbacks?.onStageStart?.('editor');
  const editorResult = await editor(analystResult.insights, input.outputMode, input.language);
  callbacks?.onStageComplete?.('editor', editorResult);

  return {
    meta: {
      topicIntent: input.topicIntent,
      timeWindow: input.timeWindow,
      outputMode: input.outputMode,
      generatedAt: new Date().toISOString(),
      dateRange: scoutResult.dateRange,
    },
    sources: judgeResult.allSources,
    insights: analystResult.insights,
    output: editorResult,
  };
}
