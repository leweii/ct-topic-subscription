import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runPipeline } from '@/lib/agent/pipeline';
import { calculateNextRun } from '@/lib/utils';
import type { TimeWindow, OutputMode, Frequency, Language } from '@/lib/types';

export const maxDuration = 60;

export async function POST(request: Request) {
  const { language = 'en' } = await request.json().catch(() => ({})) as { language?: Language };
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!subscription) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const artifact = await runPipeline(
          {
            topicIntent: subscription.topic_intent,
            timeWindow: subscription.time_window as TimeWindow,
            outputMode: subscription.output_mode as OutputMode,
            language,
          },
          {
            onStageStart: (stage) => send({ type: 'stage_start', stage }),
            onStageComplete: (stage) => send({ type: 'stage_complete', stage }),
          }
        );

        // Store artifact
        const { error: insertError } = await supabase.from('artifacts').insert({
          subscription_id: subscription.id,
          user_id: user.id,
          content: artifact,
        });

        if (insertError) {
          throw insertError;
        }

        // Update subscription timestamps
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: calculateNextRun(subscription.frequency as Frequency),
          })
          .eq('id', subscription.id);

        if (updateError) {
          throw updateError;
        }

        send({ type: 'complete', artifact });
      } catch (error) {
        console.error('Pipeline error:', error);
        send({ type: 'error', message: (error as Error).message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
