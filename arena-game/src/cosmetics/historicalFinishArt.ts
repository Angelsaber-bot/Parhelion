/** Original craft motifs, painted onto the existing gun's side and crown.
 * Coordinates use the authored weapon parts. SurfaceArt clips every stroke to
 * their real faces, so a seam never creates a floating sheet across a vent. */
type Point = readonly [number, number];
export interface FinishPainter {
  polygon(points: Point[], bin?: number): void;
  path(points: Point[], width: number, bin?: number): void;
  curve(points: Point[], width: number, bin?: number): void;
  arc(x: number, y: number, r: number, start?: number, end?: number, width?: number, bin?: number): void;
}
export const isHistoricalFinish = (id: string) => ['guard-sash', 'sealed-passage', 'night-nacre'].includes(id);

function sash(a: FinishPainter, x: number, y: number, scale = 1) {
  const p = (u: number, v: number): Point => [x + u * scale, y + v * scale];
  a.path([p(-.22, -.14), p(.22, .14)], .105 * scale, 2);
  a.path([p(-.22, -.14), p(.22, .14)], .026 * scale, 1);
  for (const edge of [-1, 1]) a.path([p(-.22, -.14 + edge * .052), p(.22, .14 + edge * .052)], .006 * scale, 0);
}
function seal(a: FinishPainter, x: number, y: number, radius: number) {
  // An irregular original wax edge, not a reproduced seal or military insignia.
  a.polygon(Array.from({ length: 24 }, (_, i) => {
    const t = i / 24 * Math.PI * 2, r = radius * (i % 3 ? .95 : 1);
    return [x + Math.cos(t) * r, y + Math.sin(t) * r] as const;
  }), 1);
  for (let segment = 0; segment < 4; segment++) a.arc(x, y, radius * .72, segment * Math.PI / 2 + .12, (segment + 1) * Math.PI / 2 - .12, radius * .085, 0);
  a.path([[x - radius * .26, y - radius * .3], [x - radius * .26, y + radius * .3], [x + radius * .28, y + radius * .3]], radius * .085, 2);
  a.path([[x + radius * .26, y + radius * .1], [x + radius * .26, y - radius * .3], [x - radius * .06, y - radius * .3]], radius * .085, 2);
}
function shell(a: FinishPainter, x: number, y: number, width: number, height: number, bin: number, lean = .015) {
  a.polygon([[x - width / 2, y - height / 2 + .012], [x - width / 2 + .014, y - height / 2], [x + width / 2, y - height / 2 + lean], [x + width / 2 - .012, y + height / 2], [x - width / 2, y + height / 2 - .014]], bin);
}

/** Return true for handled themes, even where that part intentionally stays plain. */
export function paintHistoricalFinish(id: string, role: string, top: boolean, a: FinishPainter) {
  if (!isHistoricalFinish(id)) return false;
  if (id === 'guard-sash') {
    if (role === 'body' && !top) {
      sash(a, -.23, .275);
      // A small buckle and two folded loops read clearly from the held view.
      a.path([[-.285, .21], [-.18, .21], [-.18, .315], [-.285, .315], [-.285, .21]], .009, 0);
      a.curve([[-.23, .265], [-.33, .34], [-.37, .31], [-.23, .265], [-.11, .22], [-.1, .25], [-.23, .265]], .008, 0);
      a.curve([[.19, .18], [.42, .23], [.68, .26], [.9, .3]], .006, 0);
      for (let i = 0; i < 7; i++) {
        const x = .24 + i * .085, y = .193 + i * .014;
        a.polygon([[x, y], [x + .025, y + .052], [x + .066, y + .058], [x + .041, y + .016]], 0);
        if (i < 6) a.polygon([[x + .036, y + .009], [x + .074, y - .024], [x + .111, y - .025], [x + .076, y + .012]], 0);
      }
      for (let i = 0; i < 7; i++) a.path([[.2 + i * .11, .355], [.245 + i * .11, .355]], .0045, 2);
    } else if (role === 'body' && top) {
      sash(a, -.22, 0, .72);
      for (const side of [-1, 1]) a.path([[.14, side * .079], [.83, side * .079]], .007, 0);
      for (let i = 0; i < 5; i++) a.path([[.2 + i * .13, -.025], [.25 + i * .13, .025]], .011, 2);
    } else if (role === 'stock' && !top) {
      sash(a, -1.02, .18, .58);
      a.path([[-1.23, .06], [-1.12, .06]], .008, 0);
    } else if (role === 'stock' && top) {
      for (const side of [-1, 1]) a.path([[-1.2, side * .048], [-.8, side * .048]], .008, 2);
    } else if (role === 'magazine' && !top) {
      a.path([[.14, -.46], [.29, -.15]], .06, 2);
      a.path([[.14, -.46], [.29, -.15]], .014, 1);
      for (let i = 0; i < 3; i++) a.path([[.115, -.12 - i * .036], [.155, -.12 - i * .036]], .007, 0);
    }
  } else if (id === 'sealed-passage') {
    if (role === 'body' && !top) {
      a.path([[-.63, .14], [-.63, .43], [.18, .43]], .008, 0);
      a.path([[-.60, .15], [.21, .15], [.21, .39]], .005, 2);
      for (let line = 0; line < 5; line++) {
        const y = .19 + line * .042;
        a.path([[-.57, y], [-.32 + (line % 2) * .045, y]], .004, 2);
        a.path([[.025, y], [.17 - (line % 3) * .025, y]], .004, 2);
      }
      seal(a, -.15, .29, .095);
      a.path([[-.20, .205], [-.25, .12]], .028, 1);
      a.path([[-.12, .202], [-.09, .12]], .022, 1);
      for (let i = 0; i < 6; i++) a.path([[.34 + i * .18, .35], [.41 + i * .18, .35]], .007, 0);
    } else if (role === 'body' && top) {
      for (const side of [-1, 1]) a.path([[-.64, side * .07], [.16, side * .07]], .006, 0);
      for (let i = 0; i < 5; i++) a.path([[-.56 + i * .12, -.042], [-.56 + i * .12, .035]], .0035, 2);
      seal(a, .035, 0, .052);
    } else if (role === 'stock' && !top) {
      a.path([[-1.38, .13], [-1.38, .35], [-.91, .35]], .008, 0);
      for (let i = 0; i < 4; i++) a.path([[-1.30, .17 + i * .035], [-.97 + i * .022, .17 + i * .035]], .004, 2);
      seal(a, -1.18, .25, .058);
    } else if (role === 'stock' && top) {
      for (const side of [-1, 1]) a.path([[-1.35, side * .06], [-.9, side * .06]], .006, 0);
    } else if (role === 'fore_end' && !top) {
      a.path([[.48, .12], [1.14, .12], [1.14, .30], [.48, .30], [.48, .12]], .006, 0);
      for (let i = 0; i < 4; i++) a.path([[.56 + i * .14, .16], [.56 + i * .14, .26]], .006, 2);
      seal(a, .83, .21, .052);
    }
  } else if (id === 'night-nacre') {
    if (role === 'body' && !top) {
      for (let i = 0; i < 13; i++) {
        const x = -.92 + i * .165, y = .24 + (i % 3 - 1) * .055;
        shell(a, x, y, .076 + (i % 2) * .023, .061 + (i % 3) * .018, i % 3);
        a.path([[x + .047, y + .073], [x + .066, y + .153]], .004, (i + 1) % 3);
        if (i % 2 === 0) a.path([[x - .025, y - .11], [x - .013, y - .055]], .0035, 0);
      }
      a.path([[-.98, .1], [.97, .1]], .005, 0);
    } else if (role === 'body' && top) {
      for (let i = 0; i < 12; i++) {
        const x = -.93 + i * .17, y = (i % 2 ? -1 : 1) * .043;
        shell(a, x, y, .067, .057, i % 3, .009);
        a.path([[x + .049, y - .02], [x + .083, y + .018]], .004, (i + 1) % 3);
      }
    } else if (role === 'stock' && !top) {
      // The DMR has a thumbhole, not a solid cheek panel. Put the shell work on
      // its real lower frame and leave the rubber cheek rest undecorated.
      for (let i = 0; i < 6; i++) {
        const x = -1.08 + i * .12, y = -.285 + (i % 2) * .007;
        shell(a, x, y, .06, .047, (i + 1) % 3);
        a.path([[x - .035, y + .027], [x - .02, y + .043]], .004, 0);
      }
    } else if (role === 'magazine' && !top) {
      for (let i = 0; i < 4; i++) {
        shell(a, -.73 + (i % 2) * .04, -.12 - i * .065, .065, .05, i % 3);
        a.path([[-.83, -.10 - i * .07], [-.82, -.14 - i * .07]], .004, 0);
      }
    }
  }
  return true;
}
