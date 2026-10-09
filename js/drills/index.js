// index.js — every drill, which module unlocks it, and its default session.
// The drill code itself loads on demand from js/drills/<id>.js.

export const DRILLS = [
  { id: 'hand-total', module: 'm1', icon: '🧮', title: 'Hand totals', blurb: 'Soft or hard, and what is it worth? Instantly.', items: 20 },
  { id: 'dealer-rules', module: 'm1', icon: '🤵', title: 'Dealer rules', blurb: 'Does the dealer hit or stand? Soft 17 is the trap.', items: 20 },
  { id: 'payouts', module: 'm1', icon: '💵', title: 'Payouts', blurb: 'Blackjack, doubles, surrender, insurance: what gets paid.', items: 15 },
  { id: 'bs-flash', module: 'm2', icon: '⚡', title: 'Strategy flashcards', blurb: 'Two cards and an upcard. Your play. Misses come back until they stick.', items: 50 },
  { id: 'bs-hands', module: 'm2', icon: '🂡', title: 'Play full hands', blurb: 'Real hands to the end, splits and all. Every decision checked.', items: 40 },
  { id: 'rule-spot', module: 'm3', icon: '🔀', title: 'Rule changes', blurb: 'Same hand, different casino. Which cells move?', items: 20 },
  { id: 'count-tags', module: 'm4', icon: '🏷️', title: 'Card tags', blurb: '+1, 0 or −1? Until you do not have to think.', items: 52 },
  { id: 'count-pairs', module: 'm4', icon: '👯', title: 'Count in pairs', blurb: 'Two cards at once. High and low cancel.', items: 40 },
  { id: 'deck-countdown', module: 'm4', icon: '⏱️', title: 'Deck countdown', blurb: 'Count down a whole deck against the clock. It must end at zero.', items: 1 },
  { id: 'running-count', module: 'm4', icon: '🌊', title: 'Running count', blurb: 'Cards flash by at table speed. What is the count?', items: 10 },
  { id: 'deck-estimation', module: 'm4', icon: '🗑️', title: 'Deck estimation', blurb: 'Read the discard tray: how many decks are left?', items: 15 },
  { id: 'true-count', module: 'm4', icon: '➗', title: 'True count', blurb: 'Running count ÷ decks left, rounded down, in your head.', items: 20 },
  { id: 'deviation-flash', module: 'm5', icon: '📈', title: 'Index plays', blurb: 'Same hand, different count. When do you break the chart?', items: 30 },
  { id: 'bet-ramp', module: 'm6', icon: '🪜', title: 'Bet ramp', blurb: 'True count in, bet out. No hesitation.', items: 20 },
  { id: 'casino', module: 'm8', icon: '🎰', title: 'Casino simulator', blurb: 'Everything at once: play, count, bet, at table speed.', items: 0 },
];

export function drillById(id) { return DRILLS.find((d) => d.id === id) || null; }
