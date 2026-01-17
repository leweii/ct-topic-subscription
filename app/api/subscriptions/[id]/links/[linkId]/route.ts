import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string; linkId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id: subscriptionId, linkId } = await params;
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

  const { error } = await supabase
    .from('subscription_links')
    .delete()
    .eq('id', linkId)
    .eq('subscription_id', subscriptionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
