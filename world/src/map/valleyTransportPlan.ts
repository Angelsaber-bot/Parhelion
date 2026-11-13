/** Civil routes in the valley's existing geographic frame. The northern and
 * southern loops avoid the lake, the outpost interior and the landing mesa. */
export const VALLEY_TRANSPORT_ROUTES: readonly (readonly [number, number][])[] = [
  [[-275, -30], [-229, -25], [-214, -3], [-211, 30], [-211, 56], [-180, 54]],
  [[-214, -3], [-222, -63], [-209, -108], [-183, -166], [-149, -203], [-118, -231], [-96, -252]],
  [[-96, -252], [-70, -245], [-48, -221], [-33, -194]],
  [[132, 40], [132, 10], [115, -6], [101, -23]],
  [[115, -6], [133, -17], [141, -19]],
  [[132, 40], [148, 72], [132, 106], [108, 141], [84, 179], [80, 220], [70, 260], [54, 303], [40, 310]],
];
export const VALLEY_TRANSPORT_CLEARANCE = [[139, -28, 162, -9], [91, -53, 138, -19], [-107, -273, -95, -257]] as const;
