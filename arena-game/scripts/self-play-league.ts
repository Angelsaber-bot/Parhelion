/** Prioritized fictitious self-play. Scores belong to the learning side; a draw earns half a point. */
type Payoff = { games: number; points: number };
type Payoffs = Record<string, Payoff>;

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
    if (!Number.isFinite(old.games) || !Number.isFinite(old.points) || old.points < 0 || old.points > old.games)
      throw Error('Invalid Arena league payoff');
    payoffs[id] = { games: .85 * old.games, points: .85 * old.points };
  }
  // Reserve a seat for each opponent whenever budget permits. Shuffle the seats across map, side and mode.
  const seats: (string | undefined)[] = shuffle([...ids], random).slice(0, episodes);
  while (seats.length < episodes) seats.push(undefined);
  shuffle(seats, random);
  return {
    payoffs,
    select(episode: number): string {
      const reserved = seats[episode];
      if (reserved !== undefined) return reserved;
      // Beta(1,1) smoothing for new opponents; square the loss probability to prioritize difficult matchups.
      const weights = ids.map(id => {
        const { games, points } = payoffs[id];
        return ((games - points + 1) / (games + 2)) ** 2;
      });
      let ticket = random() * weights.reduce((sum, weight) => sum + weight, 0);
      for (let i = 0; i < ids.length - 1; i++) {
        ticket -= weights[i];
        if (ticket < 0) return ids[i];
      }
      return ids[ids.length - 1];
    },
    observe(id: string, outcome: number) {
      if (outcome !== -1 && outcome !== 0 && outcome !== 1) throw Error('Invalid Arena match outcome');
      payoffs[id].games++;
      payoffs[id].points += (outcome + 1) / 2;
    },
  };
}
