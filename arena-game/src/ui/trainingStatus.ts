import { bilingual, getLanguage, onLanguageChange } from '../../../shared-client/i18n.ts';
import { releaseUrl } from '../network/training.ts';
import type { EvaluationReport } from '../../shared/evaluationReport.ts';

interface Evaluation {
  generation: number;
  published: boolean;
  reason: string;
  failedGates?: string[];
  report?: EvaluationReport;
}

interface Generation extends Evaluation {
  humanRevision: number;
  episodes: number;
  environmentSteps: number;
  optimizerSteps: number;
  totalEpisodes: number;
  totalEnvironmentSteps: number;
  totalOptimizerSteps: number;
  digest: string;
  at: number;
  lastEvaluation?: Evaluation | null;
}

interface TrainingStatus {
  rulesVersion: number;
  reinforcement?: Generation | null;
  reinforcementJob?: { parent: number; state: string; at: number } | null;
  neural?: { digest?: string } | null;
  dataset?: { matches: number; batches: number; revision: number };
}

const reasons: Record<string, [string, string]> = {
  evaluating: ['正在评测', 'Evaluating'],
  evaluation_failed: ['评测未通过', 'Evaluation failed'],
  insufficient_evidence: ['评测证据不足', 'More evaluation needed'],
  passed: ['评测通过', 'Passed evaluation'],
  shadow: ['候选模型已保存', 'Candidate saved'],
};

const stages: Record<string, [string, string]> = {
  collecting: ['生成新对局', 'Collecting matches'],
  updating: ['更新权重', 'Updating weights'],
  evaluating: ['评测候选模型', 'Evaluating candidate'],
  error: ['训练任务失败', 'Job failed'],
};

const gateLabels: Record<string, [string, string]> = {
  hiddenTargetInvariant: ['浓烟遮挡公平性', 'Occlusion fairness'],
  sufficientCoverage: ['地图与种子覆盖', 'Map and seed coverage'],
  candidateHasSearch: ['未接敌时搜敌', 'Search without contact'],
  rearSearch: ['背后搜敌', 'Rear contact'],
  smokeContact: ['烟雾接敌', 'Smoke contact'],
  smokeOffscreenTrigger: ['目标不可见时开火', 'Firing without contact'],
  wallStalls: ['碰撞卡脚', 'Collision stalls'],
  fullRounds: ['完整换边对局', 'Complete paired rounds'],
  improved: ['对战成绩提升', 'Match improvement'],
  bothModes: ['1v1 和 2v2 对照', '1v1 and 2v2 coverage'],
  human_holdout: ['真人验证样本量', 'Human validation coverage'],
  human_search: ['真人示范中的主动转向', 'Deliberate turns in demonstrations'],
  human_quiet: ['真人静止视角漂移', 'Camera drift on quiet demonstrations'],
  human_actions: ['真人操作分布', 'Human actions'],
  simulation: ['对战模拟', 'Match simulation'],
  release_runtime: ['等待公网游戏支持此模型版本', 'Awaiting compatible live game'],
};

function fingerprint(digest?: string) {
  return digest && /^[a-f0-9]{64}$/i.test(digest) ? digest.slice(0, 12) : '—';
}

export function mountTrainingStatus() {
  const panel = document.querySelector<HTMLDetailsElement>('#training-status')!;
  const notice = panel.querySelector<HTMLElement>('.training-notice')!;
  const list = panel.querySelector('dl')!;
  const lobby = document.getElementById('lobby')!;
  let last: TrainingStatus | undefined;
  let failed = false;
  let timer: number | undefined;
  let pending = false;

  function render() {
    list.replaceChildren();
    const zh = getLanguage() === 'zh';
    const number = new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US');
    const count = (n: number) => Number.isSafeInteger(n) && n >= 0 ? number.format(n) : '—';
    const row = (cn: string, en: string, value: string, title?: string) => {
      const term = document.createElement('dt');
      term.textContent = bilingual(cn, en);
      const detail = document.createElement('dd');
      detail.textContent = value;
      if (title) detail.title = title;
      list.append(term, detail);
    };
    notice.textContent = failed
      ? (last ? bilingual('刷新失败，显示上次读取的数据。', 'Refresh failed. Showing the last response.') : bilingual('暂时无法连接训练服务。', 'Training service unavailable.'))
      : (!last ? bilingual('正在读取训练状态…', 'Loading training status…') : '');
    if (!last) return;
    const generation = last.reinforcement;
    const dataset = last.dataset;
    const time = (ms: number) => Number.isFinite(ms) && Number.isFinite(new Date(ms).getTime())
      ? new Date(ms).toLocaleString(zh ? 'zh-CN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const job = last.reinforcementJob;
    if (job) {
      const stage = stages[job.state];
      row('最近任务', 'Latest job', '#' + count(job.parent + 1) + ' · ' + (stage ? bilingual(...stage) : '—'));
      row('任务最后更新', 'Job last updated', time(job.at));
    }
    if (dataset) row('真人对局 / 批次', 'Human matches / batches', count(dataset.matches) + ' / ' + count(dataset.batches));
    const live = last.neural;
    row('线上模型', 'Live model', live ? fingerprint(live.digest) : bilingual('基础 Bot', 'Baseline bot'), live?.digest);
    if (!generation) {
      row('自博弈', 'Self-play', bilingual('等待首代记录', 'Awaiting first generation'));
      return;
    }
    row('自博弈代数', 'Generation', count(generation.generation));
    row('候选模型', 'Candidate', fingerprint(generation.digest), generation.digest);
    const outcome = (evaluation: Evaluation) => {
      const result = reasons[evaluation.reason];
      return evaluation.published ? bilingual('已发布', 'Published') : result ? bilingual(...result) : '—';
    };
    row('本代结果', 'Generation result', outcome(generation));
    const evaluation = generation.lastEvaluation;
    if (evaluation && evaluation.generation !== generation.generation) {
      row('最近评测', 'Last evaluation', '#' + count(evaluation.generation) + ' · ' + outcome(evaluation));
    }
    const gates = evaluation?.failedGates ?? generation.failedGates;
    if (Array.isArray(gates) && gates.length) {
      const labels = gates.map(gate => gateLabels[gate] ? bilingual(...gateLabels[gate]) : gate);
      row('评测未通过项目', 'Failed evaluation checks', labels.join(zh ? '、' : ', '));
    }
    const report = evaluation?.report;
    if (report) {
      const opponents = { baseline: bilingual('战术基线', 'tactical baseline'), incumbent: bilingual('正式模型', 'live model'),
        'public-scripted': bilingual('公网基础 Bot', 'live scripted bot'),
        'public-exploration': bilingual('公网探索模型', 'live exploration model') };
      const opponent = opponents[report.opponent];
      const formatSeconds = (n: number) => number.format(Math.round(n * 100) / 100) + ' s';
      const comparison = formatSeconds(report.rearSeconds) + ' / ' + formatSeconds(report.referenceRearSeconds);
      if (report.perceptionMatchedReference) row('背后搜敌（候选 / 同视野对手）', 'Rear acquisition (candidate / equal-vision opponent)', comparison);
      else row('背后搜敌（候选 / 对手）', 'Rear acquisition (candidate / opponent)', comparison);
      if (report.humanCamera) {
        const { captures, windows, turn, quiet } = report.humanCamera;
        const errorPair = (pair: number[]) => pair.map(n => number.format(Math.round(n * 1800 / Math.PI) / 10) + '°').join(' / ');
        row('真人留出对局 / 操作片段', 'Held-out human matches / windows', count(captures) + ' / ' + count(windows));
        row('主动转向误差（候选 / 真人模仿基线）', 'Turn error (candidate / imitation baseline)', errorPair(turn));
        row('静止视角误差（候选 / 真人模仿基线）', 'Quiet camera error (candidate / imitation baseline)', errorPair(quiet));
      }
      const percent = new Intl.NumberFormat(zh ? 'zh-CN' : 'en-US', { style: 'percent', maximumFractionDigits: 1 });
      row('脱离墙角 / 烟雾中盲射', 'Wall escapes / blind fire in smoke',
        percent.format(report.wallEscape) + ' / ' + percent.format(report.smokeBlindFire));
      const kind = report.roundSet === 'tournament' ? bilingual('晋级赛', 'tournament') : bilingual('诊断赛', 'probe');
      for (const [mode, score] of [['1v1', report.duel], ['2v2', report.team]] as const) {
        const label = mode + ' ' + kind + ' · ' + opponent;
        row(label, label, zh ? score[0] + ' 胜 ' + score[1] + ' 平 ' + score[2] + ' 负'
          : score[0] + ' W · ' + score[1] + ' D · ' + score[2] + ' L');
      }
    }
    row('本代对局 / 累计', 'Matches this gen / total', count(generation.episodes) + ' / ' + count(generation.totalEpisodes));
    row('本代环境步 / 累计', 'Env. steps this gen / total', count(generation.environmentSteps) + ' / ' + count(generation.totalEnvironmentSteps));
    row('本代权重更新 / 累计', 'Updates this gen / total', count(generation.optimizerSteps) + ' / ' + count(generation.totalOptimizerSteps));
    row('真人参考版本', 'Human data revision', count(generation.humanRevision));
    row('最近提交', 'Last commit', time(generation.at));
  }

  const visible = () => panel.open && !document.hidden && !lobby.classList.contains('hidden');

  async function refresh() {
    window.clearTimeout(timer);
    if (!visible() || pending) return;
    pending = true;
    try {
      const response = await fetch(releaseUrl(location.hostname, location.search) + '/status', {
        credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Error();
      const data: TrainingStatus = await response.json();
      if (!data || !Number.isInteger(data.rulesVersion)) throw Error();
      last = data;
      failed = false;
    } catch {
      failed = true;
    } finally {
      pending = false;
      if (visible()) {
        render();
        timer = window.setTimeout(refresh, 30000);
      }
    }
  }
  panel.addEventListener('toggle', () => { if (panel.open) render(); void refresh(); });
  document.addEventListener('visibilitychange', refresh);
  new MutationObserver(refresh).observe(lobby, { attributes: true, attributeFilter: ['class'] });
  onLanguageChange(() => { if (panel.open) render(); });
  if (location.hash === '#training-status') panel.open = true;
}
