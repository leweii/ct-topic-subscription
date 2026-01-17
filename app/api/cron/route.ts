import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runPipeline } from '@/lib/agent/pipeline';
import { calculateNextRun } from '@/lib/utils';
import { sendReportEmail } from '@/lib/email';
import type { TimeWindow, OutputMode, Frequency, Language } from '@/lib/types';

function detectLanguage(text: string): Language {
  const chineseRegex = /[\u4e00-\u9fa5]/;
  return chineseRegex.test(text) ? 'zh' : 'en';
}

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

  const results: Array<{ id: string; status: string; error?: string; emailSent?: boolean }> = [];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';

  for (const sub of subscriptions) {
    try {
      const language = detectLanguage(sub.topic_intent);

      const artifact = await runPipeline({
        topicIntent: sub.topic_intent,
        timeWindow: sub.time_window as TimeWindow,
        outputMode: sub.output_mode as OutputMode,
        language,
      });

      const { data: insertedArtifact } = await supabase
        .from('artifacts')
        .insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          content: artifact,
        })
        .select('id')
        .single();

      await supabase
        .from('subscriptions')
        .update({
          last_run_at: new Date().toISOString(),
          next_run_at: calculateNextRun(sub.frequency as Frequency),
        })
        .eq('id', sub.id);

      // Send email notification
      let emailSent = false;
      if (insertedArtifact?.id) {
        const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
        const userEmail = userData?.user?.email;

        if (userEmail) {
          const reportUrl = `${baseUrl}/result/${insertedArtifact.id}`;
          const emailResult = await sendReportEmail({
            to: userEmail,
            artifact,
            reportUrl,
            language,
          });
          emailSent = emailResult.success;
        }
      }

      results.push({ id: sub.id, status: 'success', emailSent });
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
