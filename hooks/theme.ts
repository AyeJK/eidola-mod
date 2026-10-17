// The pane's colours, from docs/design/design-system.md §Colours: every
// colour the picker and an Engram's page draw comes from here. Alpha colours
// are given solid, already blended over the void background, since the pane
// draws no alpha. Gold is for labels and brand; amber means selected or on.

export const THEME = {
  /** The pane's background. */
  void: '#06060a',
  /** Engram cards, code and path wells. */
  card: '#1f1f1f',
  /** Panels: the awake strip, Where it draws. */
  panel: '#0b0b0f',
  /** Panel and chip borders. */
  line: '#212022',
  /** Dividers inside panels and cards. */
  lineSoft: '#18171a',
  /** Headings, Engram names. */
  white: '#ffffff',
  /** Default text, secondary button text. */
  frost: '#e8e4dc',
  /** Lead text under a heading. */
  body: '#c4c0b5',
  /** Descriptions, helper text. */
  muted: '#8c8983',
  /** Unselected chips, captions. */
  faint: '#76746e',
  /** Labels, sub-headings, links. */
  gold: '#c9a84c',
  /** A secondary button's border. */
  goldLine: '#2d2617',
  /** Selected and on: the active filter or mood, surface icons that are on, the awake badge, the HUD's mood. */
  amber: '#e09030',
  /** The background of a selected chip. */
  amberFill: '#17110d',
  /** The border of a selected chip or the awake card. */
  amberLine: '#5d3d19',
  /** The start of the accent rule; the Error button's border. */
  ember: '#c55238',
  /** The Error button's text. */
  errorText: '#d9705a',
  /** A running Shrine's dot. */
  ok: '#3a8a4a',
  /** A surface icon on a card for a surface the Engram can't draw on. */
  iconOff: '#2e2d2e',
  /** The HUD preview's frame, behind its scene. */
  preview: '#020308',
  /** A raised surface: a selected chip or menu row, a control under the pointer. */
  raised: '#232226',
  /** A control's border under the pointer, or a selected chip's. */
  lineHover: '#3a393d',
  /** The primary button, Awaken: its fill. */
  goldFill: '#c9a84c',
  /** The primary button under the pointer. */
  goldHover: '#dcbd62',
  /** Text on the gold fill. */
  ink: '#14110a',
  /** The danger button, Sleep: its fill. */
  dangerFill: '#7a1d1d',
  /** The danger button under the pointer. */
  dangerHover: '#962626',
} as const

export type ThemeColour = (typeof THEME)[keyof typeof THEME]

/**
 * The accent rule under a screen title, left to right: ember, through amber,
 * to gold, fading out into the void. Each step is a short bar.
 */
export const RULE: readonly string[] = [THEME.ember, '#d37134', THEME.amber, THEME.gold, '#6a5a2e']
