/** Prioritized fictitious self-play. Scores belong to the learning side; a draw earns half a point. */
type Payoff = { games: number; points: number };
type Layout = '1v1' | '2v2';
type Rival = Payoff & { byMode?: Partial<Record<Layout, Payoff>> };
type Payoffs = Record<string, Rival>;

function discounted(record: Payoff): Payoff {
  const { games, points } = record;
  if (!Number.isFinite(games) || !Number.isFinite(points) || games < 0 || points < 0 || points > games)
    throw Error('Invalid Arena league payoff');
  return { games: .85 * games, points: .85 * points };
}

function shuffle<T>(values: T[], random: () => number) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function opponentLeague(ids: string[], episodes: number, previous: Payoffs, random: () => number) {
  // A generation changes our policy. Discount evidence from older policies, including the old incumbent.
  const payoffs: Payoffs = Object.create(null);
  for (const id of ids) {
    const old = previous[id] ?? { games: 0, points: 0 };
    const rival: Rival = discounted(old);
    payoffs[id] = rival;
    for (const layout of ['1v1', '2v2'] as const) {
      const history = old.byMode?.[layout];
      if (history) (rival.byMode ??= {})[layout] = discounted(history);
    }
  }
  // Reserve a seat for each opponent whenever budget permits. Shuffle the seats across map, side and mode.
  const seats: (string | undefined)[] = shuffle([...ids], random).slice(0, episodes);
  while (seats.length < episodes) seats.push(undefined);
  shuffle(seats, random);
  return {
    payoffs,
    select(episode: number, layout: Layout): string {
      const reserved = seats[episode];
      if (reserved !== undefined) return reserved;
      // Start from pooled evidence, then let outcomes in this game mode dominate.
      const weights = ids.map(id => {
        const rival = payoffs[id], mode = rival.byMode?.[layout];
        const otherGames = Math.max(0, rival.games - (mode?.games ?? 0));
        const otherPoints = Math.max(0, rival.points - (mode?.points ?? 0));
        const priorLoss = (otherGames - otherPoints + 1) / (otherGames + 2);
        return mode ? ((mode.games - mode.points + 2 * priorLoss) / (mode.games + 2)) ** 2 : priorLoss ** 2;
      });
      let ticket = random() * weights.reduce((sum, weight) => sum + weight, 0);
      for (let i = 0; i < ids.length - 1; i++) {
        ticket -= weights[i];
        if (ticket < 0) return ids[i];
      }
      return ids[ids.length - 1];
    },
    observe(id: string, outcome: number, layout: Layout) {
      if (outcome !== -1 && outcome !== 0 && outcome !== 1) throw Error('Invalid Arena match outcome');
      const rival = payoffs[id], modes = rival.byMode ??= {};
      const mode = modes[layout] ??= { games: 0, points: 0 };
      const points = (outcome + 1) / 2;
      rival.games++;
      rival.points += points;
      mode.games++;
      mode.points += points;
    },
  };
}
