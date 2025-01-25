import { supabase } from './supabaseClient';

export async function updateDailyMetricScore(userId: string, metricType: string, goalReached: boolean) {
  const dateStr = new Date().toISOString().split('T')[0];
  const points = goalReached ? 25 : 0;

  const { error } = await supabase
    .from('daily_metric_scores')
    .upsert({
      user_id: userId,
      date: dateStr,
      metric_type: metricType,
      goal_reached: goalReached,
      points
    }, {
      onConflict: 'user_id,date,metric_type'
    });

  if (error) throw error;
}

export async function updateDailyTotal(userId: string) {
  const dateStr = new Date().toISOString().split('T')[0];

  // Sum of all points for the day
  const { data: scores, error: fetchErr } = await supabase
    .from('daily_metric_scores')
    .select('points')
    .match({ user_id: userId, date: dateStr });
  
  if (fetchErr) throw fetchErr;

  const totalPoints = scores?.reduce((sum, item) => sum + (item.points || 0), 0) ?? 0;
  const metricsCompleted = scores?.filter(item => item.points > 0).length ?? 0;

  const { error: upsertErr } = await supabase
    .from('daily_totals')
    .upsert({
      user_id: userId,
      date: dateStr,
      total_points: totalPoints,
      metrics_completed: metricsCompleted
    }, {
      onConflict: 'user_id,date'
    });

  if (upsertErr) throw upsertErr;
}