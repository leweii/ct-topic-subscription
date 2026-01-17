import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runPipeline } from '@/lib/agent/pipeline';
import { calculateNextRun } from '@/lib/utils';
import type { TimeWindow, OutputMode, Frequency } from '@/lib/types';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Find all subscriptions due for execution
  const { data: subscriptions, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .neq('frequency', 'once')
    .lte('next_run_at', new Date().toISOString());

  if (fetchError) {
    console.error('Error fetching subscriptions:', fetchError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (!subscriptions?.length) {
    return NextResponse.json({ message: 'No subscriptions to run', count: 0 });
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const sub of subscriptions) {
    try {
      const artifact = await runPipeline({
        topicIntent: sub.topic_intent,
        timeWindow: sub.time_window as TimeWindow,
        outputMode: sub.output_mode as OutputMode,
        language: 'en', // Default to English for scheduled runs
      });

      await supabase.from('artifacts').insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        content: artifact,
      });

      await supabase
        .from('subscriptions')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: calculateNextRun(sub.frequency as Frequency),
        })
        .eq('id', sub.id);

      results.push({ id: sub.id, status: 'success' });
    } catch (error) {
      console.error(`Error running subscription ${sub.id}:`, error);
      results.push({
        id: sub.id,
        status: 'error',
        error: (error as Error).message,
      });
    }
  }

  return NextResponse.json({
    message: 'Cron complete',
    total: subscriptions.length,
    results,
  });
}
