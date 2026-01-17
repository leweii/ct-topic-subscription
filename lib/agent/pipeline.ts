import { scout } from './scout';
import { judge } from './judge';
import { analyst } from './analyst';
import { editor } from './editor';
import type { PipelineInput, PipelineCallbacks, ArtifactContent } from '@/lib/types';

export async function runPipeline(
  input: PipelineInput,
  callbacks?: PipelineCallbacks
): Promise<ArtifactContent> {
  // 1. Scout: Search for content using Gemini Grounding
  callbacks?.onStageStart?.('scout');
  const scoutResult = await scout(input.topicIntent, input.timeWindow);
  callbacks?.onStageComplete?.('scout', scoutResult);

  // 2. Judge: Filter and deduplicate
  callbacks?.onStageStart?.('judge');
  const judgeResult = await judge(scoutResult.sources, input.topicIntent);
  callbacks?.onStageComplete?.('judge', judgeResult);

  // 3. Analyst: Extract insights
  callbacks?.onStageStart?.('analyst');
  const analystResult = await analyst(judgeResult.keptSources, input.topicIntent);
  callbacks?.onStageComplete?.('analyst', analystResult);

  // 4. Editor: Generate final output in the specified language
  callbacks?.onStageStart?.('editor');
  const editorResult = await editor(analystResult.insights, input.outputMode, input.language);
  callbacks?.onStageComplete?.('editor', editorResult);

  return {
    meta: {
      topicIntent: input.topicIntent,
      timeWindow: input.timeWindow,
      outputMode: input.outputMode,
      generatedAt: new Date().toISOString(),
    },
    sources: judgeResult.allSources,
    insights: analystResult.insights,
    output: editorResult,
  };
}
