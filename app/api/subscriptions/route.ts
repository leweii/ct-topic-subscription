import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { TimeWindow, OutputMode, Frequency } from '@/lib/types';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, subscription_links(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const payload = {
    user_id: user.id,
    topic_intent: body.topic_intent as string,
    time_window: (body.time_window || '7d') as TimeWindow,
    output_mode: (body.output_mode || 'brief') as OutputMode,
    frequency: (body.frequency || 'once') as Frequency,
  };

  const { data, error } = await supabase
    .from('subscriptions')
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
