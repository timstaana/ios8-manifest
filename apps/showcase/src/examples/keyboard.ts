// Keyboard & saving: type into a text box (the iPad's keyboard opens), press return to keep the line.
// Lines are saved on the iPad and are still there next time the app opens.
// Core p5: createInput(), input.value(), storeItem() / getItem() (localStorage; the home-screen app has its own).
// iOS 8: the keyboard only opens if the tap on the text box isn't blocked; the runner lets touches on form fields through.
// Typing speed: vendor/p5-ios8.js turns autocorrect off for p5's text boxes (it doubled the keyboard's lag here).
import { changed, type Example } from '../runner';
import { PALETTE, BG, INK, MUTED, labelImage } from '../art';

const KEY = 'showcase-notes';
let input: p5.Element | null = null, notes: string[] = [], shown = '\u0000';
let typedG: p5.Graphics | null = null, notesG: p5.Graphics | null = null, notesImg: p5.Image | null = null;

// Keep typing smooth on the iPad mini: one canvas for the typed text, reused and redrawn only when the text
// changes (making new canvases or images on every key froze it for ~400 ms a key), and the saved lines redrawn
// only when they change.
function renderTyped(typed: string) {
  const g = typedG!; g.clear(); g.noStroke(); g.fill(INK); g.textFont('Helvetica Neue'); g.textSize(48); g.textStyle('bold');
  g.text(typed || ' ', 0, 0, g.width, g.height); shown = typed;
}
function renderNotes() {
  const n = notesG!; n.clear(); n.noStroke(); n.textFont('Helvetica Neue'); n.textSize(20);
  notes.forEach((t, i) => { n.fill(i ? MUTED : INK); n.text(t, 0, 24 + i * 34); });
  notesImg = n.get(); // a fast-drawing image of it, made only when the lines change
}

export const keyboard: Example = {
  id: 'keyboard', title: 'Keyboard & saving', about: 'Type with the iPad keyboard. Lines are saved on the iPad and come back next time.',
  setup(p, top) {
    notes = (p.getItem(KEY) as string[] | null) || []; shown = '\u0000';
    typedG = p.createGraphics(p.width - 56, 140); typedG.pixelDensity(1);
    notesG = p.createGraphics(p.width - 56, 34 * 12 + 10); notesG.pixelDensity(1); renderNotes();
    input = p.createInput('');
    input.position(28, top + 70); input.size(Math.min(560, p.width - 56), 44);
    input.attribute('placeholder', 'Type something, then press return');
    input.style('z-index', '2'); input.style('font-size', '22px'); input.style('padding', '0 12px');
    input.style('border', '2px solid ' + PALETTE[0]); input.style('border-radius', '8px'); input.style('-webkit-appearance', 'none');
    // iOS scrolls a full-screen page up to make room for the keyboard; put it back when the keyboard closes
    (input.elt as HTMLInputElement).addEventListener('blur', () => window.scrollTo(0, 0), false);
    (input.elt as HTMLInputElement).addEventListener('keydown', (e: KeyboardEvent) => {
      const el = input!.elt as HTMLInputElement;
      if (e.keyCode !== 13 || !el.value) return;
      notes.unshift(el.value); notes = notes.slice(0, 12); p.storeItem(KEY, notes); el.value = ''; renderNotes();
      e.preventDefault(); // keep the keyboard open for the next line
    }, false);
  },
  draw(p, top) {
    p.background(BG);
    const typed = input ? (input.elt as HTMLInputElement).value : '';
    if (typed !== shown) renderTyped(typed);
    if (typedG) p.image(typedG, 28, top + 140);
    if (notesImg) p.image(notesImg, 28, top + 330);
    const l = labelImage(p, notes.length ? 'Tap here to clear the saved lines' : 'Saved lines appear here', 16, MUTED);
    p.image(l, 28, p.height - 50);
  },
  touchStarted(p, e) {
    for (const t of changed(e)) if (t.y > p.height - 70) { notes = []; p.removeItem(KEY); renderNotes(); }
  },
  exit() { if (input) (input.elt as HTMLInputElement).blur(); input = null; },
};
