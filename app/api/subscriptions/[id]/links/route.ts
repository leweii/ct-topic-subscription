import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LINK_LIMITS = {
  free: 5,
  pro: Infinity,
};

interface RouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const subscriptionId = params.id;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify subscription belongs to user
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single();

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  // Check link count limit
  const { count } = await supabase
    .from('subscription_links')
    .select('*', { count: 'exact', head: true })
    .eq('subscription_id', subscriptionId);

  const userPlan = 'free'; // TODO: get from user profile
  if ((count || 0) >= LINK_LIMITS[userPlan]) {
    return NextResponse.json(
      { error: 'Link limit reached', limit: LINK_LIMITS[userPlan] },
      { status: 400 }
    );
  }

  const { url } = await request.json();

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('subscription_links')
    .insert({ subscription_id: subscriptionId, url })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'URL already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
