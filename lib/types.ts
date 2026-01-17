export type TimeWindow = '3d' | '7d' | '30d';
export type OutputMode = 'brief' | 'report';
export type Frequency = 'once' | 'daily' | 'weekly' | 'monthly';
export type SourceType = 'youtube' | 'blog' | 'official';
export type Confidence = 'high' | 'medium' | 'low';
export type Language = 'en' | 'zh';

export interface Subscription {
  id: string;
  user_id: string;
  topic_intent: string;
  time_window: TimeWindow;
  output_mode: OutputMode;
  frequency: Frequency;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionLink {
  id: string;
  subscription_id: string;
  url: string;
  created_at: string;
}

export interface SubscriptionWithLinks extends Subscription {
  subscription_links?: SubscriptionLink[];
}

export interface Source {
  title: string;
  url: string;
  author: string;
  publishedAt: string;
  sourceType: SourceType;
  summary: string;
  kept?: boolean;
  reason?: string;
}

export interface Insight {
  headline: string;
  significance: string;
  isNovelty: boolean;
  confidence: Confidence;
}

export interface ArtifactOutput {
  title: string;
  body: string;
  agentStatement: string;
  uncertainties: string[];
}

export interface ArtifactContent {
  meta: {
    topicIntent: string;
    timeWindow: TimeWindow;
    outputMode: OutputMode;
    generatedAt: string;
  };
  sources: Source[];
  insights: Insight[];
  output: ArtifactOutput;
}

export interface Artifact {
  id: string;
  subscription_id: string;
  user_id: string;
  content: ArtifactContent;
  pipeline_log?: Record<string, unknown>;
  created_at: string;
}

export interface PipelineInput {
  topicIntent: string;
  timeWindow: TimeWindow;
  outputMode: OutputMode;
  language: Language;
}

export interface PipelineCallbacks {
  onStageStart?: (stage: string) => void;
  onStageComplete?: (stage: string, result: unknown) => void;
}
