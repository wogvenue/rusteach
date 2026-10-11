// /istatistik - learning analytics: headline tiles, personal insights, study calendar, daily XP,
// per-module accuracy, review forecast, memory strength and confidence calibration. All numbers
// come from the pure functions in lib/stats.ts.
import { useMemo } from 'react';
import { useProgress } from '../store/progress';
import {
  activityHeatmap,
  buildInsights,
  calibration,
  isNewLearner,
  memorySnapshot,
  moduleAccuracyRows,
  overview,
  periodTotals,
  projectedRetention,
  retentionCurve,
  reviewForecast,
  xpByDay,
} from '../lib/stats';
import { LearnPage, PageHeader } from '../components/review/shared/ui';
import { useClock } from '../components/review/shared/hooks';
import StatTiles from '../components/stats/StatTiles';
import InsightList from '../components/stats/InsightList';
import ActivityHeatmap from '../components/stats/ActivityHeatmap';
import XpChart from '../components/stats/XpChart';
import ModuleAccuracy from '../components/stats/ModuleAccuracy';
import ForecastChart from '../components/stats/ForecastChart';
import MemoryStrength from '../components/stats/MemoryStrength';
import CalibrationChart from '../components/stats/CalibrationChart';
import StatsEmpty from '../components/stats/StatsEmpty';

export default function StatsPage() {
  const state = useProgress();
  const now = useClock(60_000);

  const data = useMemo(() => {
    if (isNewLearner(state)) return null;
    const week = periodTotals(state, 7, now);
    return {
      overview: overview(state, now),
      week,
      insights: buildInsights(state, now),
      heatmap: activityHeatmap(state, 26, now),
      xp: xpByDay(state, 30, now),
      modules: moduleAccuracyRows(state),
      forecast: reviewForecast(state, 30, now),
      memory: memorySnapshot(state, now),
      retention: retentionCurve(state, 30, now),
      projected: { week: projectedRetention(state, 7, now), month: projectedRetention(state, 30, now) },
      calibration: calibration(state),
    };
  }, [state, now]);

  return (
    <LearnPage>
      <PageHeader
        title="İstatistikler"
        subtitle="Ne kadar ilerlediğin, neyi sağlam bildiğin ve neyi tekrar etmen gerektiği."
      />
      {data ? (
        <div className="space-y-5">
          <StatTiles o={data.overview} weekXp={data.week.xp} weekSeconds={data.week.seconds} />
          <InsightList insights={data.insights} />
          <ActivityHeatmap data={data.heatmap} goal={state.settings.dailyGoalXp} streak={state.streak} />
          <div className="grid gap-5 @5xl:grid-cols-2">
            <XpChart days={data.xp} goal={state.settings.dailyGoalXp} />
            <ForecastChart days={data.forecast} />
          </div>
          <div className="grid gap-5 @5xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <ModuleAccuracy rows={data.modules} />
            <MemoryStrength snap={data.memory} retention={data.retention} projected={data.projected} />
          </div>
          <CalibrationChart data={data.calibration} />
        </div>
      ) : (
        <StatsEmpty />
      )}
    </LearnPage>
  );
}
