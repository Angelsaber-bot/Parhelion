import { bilingual, getLanguage, onLanguageChange } from '../../../shared-client/i18n.ts';
import { trainingUrl } from '../network/training.ts';

interface Evaluation {
  generation: number;
  published: boolean;
  reason: string;
  failedGates?: string[];
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
  human_search: ['真人搜敌动作', 'Human search behavior'],
  human_actions: ['真人操作分布', 'Human actions'],
  simulation: ['对战模拟', 'Match simulation'],
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
      const response = await fetch(trainingUrl(location.hostname) + '/status', {
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
