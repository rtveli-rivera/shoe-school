// about.js — how the numbers are made, the legal note, responsible play.

import { el } from '../ui.js';

export async function render(root) {
  root.append(el('h1', {}, 'About Shoe School'),
    el('div', { class: 'card' },
      el('h3', { style: { marginTop: 0 } }, 'Where the numbers come from'),
      el('p', {}, 'Every strategy chart in this app is computed by its own blackjack engine: an exact combinatorial analysis of the shoe for your game’s rules, every card drawn without replacement. The charts were then checked cell by cell against published basic-strategy charts. Index plays (the Illustrious 18 and Fab 4) are the published, simulation-derived Hi-Lo numbers, cross-checked between independent sources.'),
      el('p', { class: 'muted' }, 'Nothing here needs the internet. The app works offline and keeps your progress on this device only.')),
    el('div', { class: 'card' },
      el('h3', { style: { marginTop: 0 } }, 'Is counting cards legal?'),
      el('p', {}, 'Counting cards in your head is not cheating: you are only using your memory and the cards everyone can see. But a casino is private property, and in many places it may refuse your action, limit your bets, shuffle early or ask you to leave. Devices that count for you are illegal in casinos in many jurisdictions; never bring one to a table.'),
      el('p', { class: 'muted', style: { fontSize: '14px' } }, 'This is general information, not legal advice. Rules differ by country and state.')),
    el('div', { class: 'card' },
      el('h3', { style: { marginTop: 0 } }, 'Responsible play'),
      el('p', {}, 'Even a perfect counter loses close to half of all sessions on the way to a small long-run edge, and the swings are large. Only ever play with money you can afford to lose completely, set a loss limit before you sit down, and stop if gambling stops being a choice.'),
      el('p', {}, 'Warning signs: chasing losses, betting money meant for bills, hiding how much you play, feeling restless when you are not playing. If that sounds familiar, talk to someone. Most countries have a free, confidential gambling helpline. In the US it is the National Problem Gambling Helpline: 1-800-MY-RESET (1-800-697-3738), 24 hours a day.')),
    el('p', { class: 'faint center', style: { fontSize: '12px' } }, 'Shoe School is an independent training tool, not affiliated with any casino or other training course.'),
  );
}
