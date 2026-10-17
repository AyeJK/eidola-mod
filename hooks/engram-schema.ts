// The editor schema for engram.json: hints only, the validator is the
// authority. docs/spec/engram.schema.json is written from this by
// `node scripts/schema.mjs` (`--check` compares). Written by hand, not built
// from validate.ts, so validate.test.ts can hold each to the other: a
// required field, a key, an enum value or a limit added to one side alone
// fails the tests. No imports: node reads this file as it is.

const colour = { type: 'string', pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' } as const
const thumbnail = {
  type: 'string',
  description: 'A file name in vessel/, ending .svg.',
  pattern: '^[A-Za-z0-9_-][A-Za-z0-9._-]*\\.svg$',
} as const
const stateColour = {
  type: 'object',
  required: ['label', 'detail'],
  properties: { label: { $ref: '#/$defs/colour' }, detail: { $ref: '#/$defs/colour' } },
  additionalProperties: false,
} as const
const state = { $ref: '#/$defs/stateColour' } as const

export const ENGRAM_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Eidola Engram (spec 2)',
  description: 'An Engram package manifest: <id>/engram.json. See docs/spec/engram-format.md.',
  type: 'object',
  required: ['spec', 'id', 'name', 'version', 'author', 'description', 'rights', 'vessel'],
  properties: {
    $schema: { type: 'string', description: 'For editors; the mod ignores it.' },
    spec: { description: 'The format version.', enum: [2] },
    id: { type: 'string', description: "Slug, equal to the folder's name.", pattern: '^[a-z0-9-]{2,32}$' },
    name: { type: 'string', description: 'What the picker, the HUD and the status line call it.', minLength: 1, maxLength: 32 },
    version: {
      type: 'string',
      description: 'Semver.',
      pattern:
        '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?(\\+[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$',
    },
    author: { type: 'string', minLength: 1 },
    description: { type: 'string', description: 'The picker card and /engrams.', minLength: 1, maxLength: 160 },
    rights: { description: 'Your word that you made it, or may share it.', enum: ['original', 'licensed'] },
    vessel: {
      type: 'object',
      required: ['scene'],
      properties: {
        scene: { type: 'string', description: 'The scene it draws, built into the mod.', enum: ['kraken', 'lich', 'wisp'] },
        shows: {
          type: 'array',
          description: 'Where it draws; all three when left out.',
          minItems: 1,
          uniqueItems: true,
          items: { enum: ['pane', 'band', 'shrine'] },
        },
        thumbnails: {
          type: 'object',
          description: "Picker stills in vessel/; the scene's own when left out.",
          properties: { pane: thumbnail, band: thumbnail },
          additionalProperties: false,
        },
        hud: {
          type: 'object',
          description: 'The HUD frame over the Vessel.',
          properties: {
            show: { type: 'boolean', description: 'On until the person toggles it. Default false.' },
            meter: { description: 'Default bars.', enum: ['bars', 'wave', 'sparks', 'none'] },
            tag: { description: 'Default name.', enum: ['name', 'livecam', 'sigil', 'none'] },
            camera: { type: 'string', minLength: 1, description: 'The camera on a livecam tag. Default CAM 01.' },
            layout: { description: 'Default top.', enum: ['top', 'bottom'] },
            label: { description: 'Default bold.', enum: ['bold', 'serif', 'pixel'] },
            bracket: { $ref: '#/$defs/colour', description: 'Default brass, #b8913a.' },
            colours: {
              type: 'object',
              description: "Each state's label and detail colours.",
              properties: {
                idle: state,
                thinking: state,
                working: state,
                waiting: state,
                responding: state,
                success: state,
                error: state,
                attention: state,
                sleeping: state,
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    extensions: { type: 'object', description: 'Anything; the mod keeps it and never reads it.' },
  },
  additionalProperties: false,
  $defs: { colour, thumbnail, stateColour },
} as const
