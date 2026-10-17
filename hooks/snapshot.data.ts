// The snapshots hooks/snapshot.test.ts checks: what the three kept Engrams
// (the Kraken, the Lich and the Wisp) look like in 0.6.0. One entry per
// snapshot, each named for its Engram. When one differs on purpose, the test's
// failure holds its new value as `SNAPSHOT <name> <value>`: put that value here in
// place of the old one, and change no other entry.

export const SNAPSHOTS: Record<string, unknown> = {
  // Task 1: the picker cards: each kept Engram's name, what it is, its button, the Surface options that list it, and their order among themselves.
  "cards: order of the kept Engrams": [
    "wisp",
    "kraken",
    "lich"
  ],
  "card: kraken": {
    "id": "kraken",
    "name": "Kraken",
    "description": "Something vast in the deep water beside your work. It surfaces when there is work to do.",
    "button": {
      "key": "awaken:kraken",
      "label": "Awaken"
    },
    "listedUnder": [
      "all",
      "pane",
      "band"
    ]
  },
  "card: lich": {
    "id": "lich",
    "name": "Lich",
    "description": "A crowned skull of alchemical signs, soul-fire in its sockets. It burns brighter while you work.",
    "button": {
      "key": "awaken:lich",
      "label": "Awaken"
    },
    "listedUnder": [
      "all",
      "pane",
      "band"
    ]
  },
  "card: wisp": {
    "id": "wisp",
    "name": "Wisp",
    "description": "A will-o'-the-wisp in a night fen. It flies where it likes, its ghost fire burning the colour of your work, and speaks in flickers.",
    "button": {
      "key": "awaken:wisp",
      "label": "Awaken"
    },
    "listedUnder": [
      "all",
      "band"
    ]
  },

  // Task 2: the picker thumbnails, at the card sizes of a docked and a narrow pane.
  "thumbnail: kraken, docked pane, two cards a row": {
    "rows": 5,
    "alt": "Kraken, pane view",
    "width": 232,
    "height": 122,
    "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 960 722\" width=\"232\" height=\"122\" preserveAspectRatio=\"xMidYMid slice\"><title>kraken/thumb-pane.svg</title></svg>"
  },
  "thumbnail: lich, docked pane, two cards a row": {
    "rows": 5,
    "alt": "Lich, pane view",
    "width": 232,
    "height": 122,
    "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 480 361\" width=\"232\" height=\"122\" preserveAspectRatio=\"xMidYMid slice\"><title>lich/thumb-pane.svg</title></svg>"
  },
  "thumbnail: wisp, docked pane, two cards a row": {
    "rows": 5,
    "alt": "Wisp, band view",
    "width": 232,
    "height": 46,
    "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 720 171\" width=\"232\" height=\"46\" preserveAspectRatio=\"xMidYMid slice\"><title>wisp/thumb-band.svg</title></svg>"
  },
  "thumbnail: kraken, narrow pane, one card a row": {
    "rows": 7,
    "alt": "Kraken, pane view",
    "width": 272,
    "height": 160,
    "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 960 722\" width=\"272\" height=\"160\" preserveAspectRatio=\"xMidYMid slice\"><title>kraken/thumb-pane.svg</title></svg>"
  },
  "thumbnail: lich, narrow pane, one card a row": {
    "rows": 7,
    "alt": "Lich, pane view",
    "width": 272,
    "height": 160,
    "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 480 361\" width=\"272\" height=\"160\" preserveAspectRatio=\"xMidYMid slice\"><title>lich/thumb-pane.svg</title></svg>"
  },
  "thumbnail: wisp, narrow pane, one card a row": {
    "rows": 7,
    "alt": "Wisp, band view",
    "width": 272,
    "height": 56,
    "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 720 171\" width=\"272\" height=\"56\" preserveAspectRatio=\"xMidYMid slice\"><title>wisp/thumb-band.svg</title></svg>"
  },

  // Task 3: the pane and band in each mood, the clock fixed. Long SVG sources are their length and hash.
  "scene: kraken, idle, desktop pane": [
    "Box {\"width\":52,\"height\":75}",
    "  Box {\"width\":52,\"height\":75}",
    "    Box {\"width\":52,\"height\":75,\"overflow\":\"hidden\",\"alignItems\":\"flex-start\"}",
    "      Svg {\"source\":\"[15410 chars #0ea00f84]\",\"alt\":\"Kraken in deep water\",\"width\":412,\"height\":1444,\"isInteractive\":true}",
    "      Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "        Client#kraken-live {\"module\":\"hooks/kraken-live.tsx\",\"props\":{\"mood\":\"idle\",\"cols\":52,\"rows\":75,\"ink\":0},\"width\":52,\"height\":75}",
    "    Box#frame-tl {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#3c9aa6\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#3c9aa6\"}",
    "    Box#frame-tr {\"position\":\"absolute\",\"top\":0,\"left\":50}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#3c9aa6\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-end\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#3c9aa6\"}",
    "    Box#frame-bl {\"position\":\"absolute\",\"top\":74,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#3c9aa6\"}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#3c9aa6\"}",
    "    Box#frame-state {\"position\":\"absolute\",\"top\":1,\"left\":3}",
    "      Box {\"width\":12,\"height\":2}",
    "        Svg {\"source\":\"[240 chars #5c9adaed]\",\"alt\":\"IDLE\",\"width\":92,\"height\":34}",
    "    Box#frame-detail {\"position\":\"absolute\",\"top\":3,\"left\":3}",
    "      Text {\"color\":\"#3c9aa6\"}",
    "        \"by hand\"",
    "    Box#frame-tag {\"position\":\"absolute\",\"top\":1,\"left\":29}",
    "      Client#frame-cam {\"module\":\"hooks/frame-cam.tsx\",\"props\":{\"name\":\"KRAKEN\",\"camera\":\"DEEPCAM 02\"},\"width\":20,\"height\":2}",
    "  Box#corner {\"position\":\"absolute\",\"top\":73,\"left\":49}",
    "    Client#frame-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#3c9aa6\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: kraken, idle, desktop band": [
    "Box {\"width\":100,\"height\":7}",
    "  Svg {\"source\":\"[15270 chars #b37bc58e]\",\"alt\":\"Kraken in deep water\",\"width\":796,\"height\":131,\"isInteractive\":true}",
    "  Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "    Client#kraken-band {\"module\":\"hooks/kraken-live.tsx\",\"props\":{\"mood\":\"idle\",\"cols\":100,\"rows\":7,\"view\":\"band\",\"ink\":0},\"width\":100,\"height\":7}",
    "  Box#corner {\"position\":\"absolute\",\"top\":5,\"left\":97}",
    "    Client#band-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#3c9aa6\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: kraken, idle, terminal pane": [
    "Text",
    "  \"( o_o )\""
  ],
  "scene: kraken, idle, terminal band": [
    "Text",
    "  \"( o_o )\""
  ],
  "scene: kraken, working, desktop pane": [
    "Box {\"width\":52,\"height\":75}",
    "  Box {\"width\":52,\"height\":75}",
    "    Box {\"width\":52,\"height\":75,\"overflow\":\"hidden\",\"alignItems\":\"flex-start\"}",
    "      Svg {\"source\":\"[15410 chars #0ea00f84]\",\"alt\":\"Kraken in deep water\",\"width\":412,\"height\":1444,\"isInteractive\":true}",
    "      Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "        Client#kraken-live {\"module\":\"hooks/kraken-live.tsx\",\"props\":{\"mood\":\"working\",\"cols\":52,\"rows\":75,\"ink\":0},\"width\":52,\"height\":75}",
    "    Box#frame-tl {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#3c9aa6\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#3c9aa6\"}",
    "    Box#frame-tr {\"position\":\"absolute\",\"top\":0,\"left\":50}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#3c9aa6\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-end\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#3c9aa6\"}",
    "    Box#frame-bl {\"position\":\"absolute\",\"top\":74,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#3c9aa6\"}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#3c9aa6\"}",
    "    Box#frame-state {\"position\":\"absolute\",\"top\":1,\"left\":3}",
    "      Box {\"width\":19,\"height\":2}",
    "        Svg {\"source\":\"[245 chars #95649c79]\",\"alt\":\"WORKING\",\"width\":152,\"height\":34}",
    "    Box#frame-detail {\"position\":\"absolute\",\"top\":3,\"left\":3}",
    "      Text {\"color\":\"#b8282c\"}",
    "        \"by hand\"",
    "    Box#frame-tag {\"position\":\"absolute\",\"top\":1,\"left\":29}",
    "      Client#frame-cam {\"module\":\"hooks/frame-cam.tsx\",\"props\":{\"name\":\"KRAKEN\",\"camera\":\"DEEPCAM 02\"},\"width\":20,\"height\":2}",
    "  Box#corner {\"position\":\"absolute\",\"top\":73,\"left\":49}",
    "    Client#frame-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#3c9aa6\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: kraken, working, desktop band": [
    "Box {\"width\":100,\"height\":7}",
    "  Svg {\"source\":\"[15270 chars #b37bc58e]\",\"alt\":\"Kraken in deep water\",\"width\":796,\"height\":131,\"isInteractive\":true}",
    "  Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "    Client#kraken-band {\"module\":\"hooks/kraken-live.tsx\",\"props\":{\"mood\":\"working\",\"cols\":100,\"rows\":7,\"view\":\"band\",\"ink\":0},\"width\":100,\"height\":7}",
    "  Box#corner {\"position\":\"absolute\",\"top\":5,\"left\":97}",
    "    Client#band-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#3c9aa6\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: kraken, working, terminal pane": [
    "Text",
    "  \"( >_< ) *\""
  ],
  "scene: kraken, working, terminal band": [
    "Text",
    "  \"( >_< ) *\""
  ],
  "scene: kraken, attention, desktop pane": [
    "Box {\"width\":52,\"height\":75}",
    "  Box {\"width\":52,\"height\":75}",
    "    Box {\"width\":52,\"height\":75,\"overflow\":\"hidden\",\"alignItems\":\"flex-start\"}",
    "      Svg {\"source\":\"[15410 chars #0ea00f84]\",\"alt\":\"Kraken in deep water\",\"width\":412,\"height\":1444,\"isInteractive\":true}",
    "      Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "        Client#kraken-live {\"module\":\"hooks/kraken-live.tsx\",\"props\":{\"mood\":\"attention\",\"cols\":52,\"rows\":75,\"ink\":0},\"width\":52,\"height\":75}",
    "    Box#frame-tl {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#3c9aa6\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#3c9aa6\"}",
    "    Box#frame-tr {\"position\":\"absolute\",\"top\":0,\"left\":50}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#3c9aa6\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-end\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#3c9aa6\"}",
    "    Box#frame-bl {\"position\":\"absolute\",\"top\":74,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#3c9aa6\"}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#3c9aa6\"}",
    "    Box#frame-state {\"position\":\"absolute\",\"top\":1,\"left\":3}",
    "      Box {\"width\":24,\"height\":2}",
    "        Svg {\"source\":\"[247 chars #4cbdd6af]\",\"alt\":\"ATTENTION\",\"width\":192,\"height\":34}",
    "    Box#frame-detail {\"position\":\"absolute\",\"top\":3,\"left\":3}",
    "      Text {\"color\":\"#c49a2a\"}",
    "        \"by hand\"",
    "    Box#frame-tag {\"position\":\"absolute\",\"top\":1,\"left\":29}",
    "      Client#frame-cam {\"module\":\"hooks/frame-cam.tsx\",\"props\":{\"name\":\"KRAKEN\",\"camera\":\"DEEPCAM 02\"},\"width\":20,\"height\":2}",
    "  Box#corner {\"position\":\"absolute\",\"top\":73,\"left\":49}",
    "    Client#frame-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#3c9aa6\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: kraken, attention, desktop band": [
    "Box {\"width\":100,\"height\":7}",
    "  Svg {\"source\":\"[15270 chars #b37bc58e]\",\"alt\":\"Kraken in deep water\",\"width\":796,\"height\":131,\"isInteractive\":true}",
    "  Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "    Client#kraken-band {\"module\":\"hooks/kraken-live.tsx\",\"props\":{\"mood\":\"attention\",\"cols\":100,\"rows\":7,\"view\":\"band\",\"ink\":0},\"width\":100,\"height\":7}",
    "  Box#corner {\"position\":\"absolute\",\"top\":5,\"left\":97}",
    "    Client#band-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#3c9aa6\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: kraken, attention, terminal pane": [
    "Text",
    "  \"( O_O ) !\""
  ],
  "scene: kraken, attention, terminal band": [
    "Text",
    "  \"( O_O ) !\""
  ],
  "scene: lich, idle, desktop pane": [
    "Box {\"width\":52,\"height\":75}",
    "  Box {\"width\":52,\"height\":75}",
    "    Box {\"width\":52,\"height\":75,\"overflow\":\"hidden\",\"alignItems\":\"flex-start\"}",
    "      Svg {\"source\":\"[5292 chars #92659679]\",\"alt\":\"Lich in the dark\",\"width\":412,\"height\":1444,\"isInteractive\":true}",
    "      Box {\"position\":\"absolute\",\"top\":0,\"left\":0,\"flexDirection\":\"column\"}",
    "        Client#lich-0 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"idle\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[0,19]},\"width\":52,\"height\":19}",
    "        Client#lich-1 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"idle\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[19,19]},\"width\":52,\"height\":19}",
    "        Client#lich-2 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"idle\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[38,18]},\"width\":52,\"height\":18}",
    "        Client#lich-3 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"idle\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[56,19]},\"width\":52,\"height\":19}",
    "    Box#frame-tl {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#9a3c28\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#9a3c28\"}",
    "    Box#frame-tr {\"position\":\"absolute\",\"top\":0,\"left\":50}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#9a3c28\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-end\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#9a3c28\"}",
    "    Box#frame-bl {\"position\":\"absolute\",\"top\":74,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#9a3c28\"}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#9a3c28\"}",
    "    Box#frame-state {\"position\":\"absolute\",\"top\":1,\"left\":3}",
    "      Box {\"width\":12,\"height\":2}",
    "        Svg {\"source\":\"[309 chars #f0b691df]\",\"alt\":\"IDLE\",\"width\":92,\"height\":34}",
    "    Box#frame-detail {\"position\":\"absolute\",\"top\":3,\"left\":3}",
    "      Text {\"color\":\"#9a3c28\"}",
    "        \"by hand\"",
    "    Box#frame-tag {\"position\":\"absolute\",\"top\":1,\"left\":42}",
    "      Client#frame-sigil {\"module\":\"hooks/frame-sigil.tsx\",\"props\":{\"colour\":\"#e0603e\",\"level\":\"idle\",\"cols\":7,\"rows\":3,\"top\":8,\"bottom\":52},\"width\":7,\"height\":3}",
    "    Box#frame-sparks {\"position\":\"absolute\",\"top\":69,\"left\":2}",
    "      Client#frame-sparks {\"module\":\"hooks/frame-sparks.tsx\",\"props\":{\"colour\":\"#e0603e\",\"level\":\"idle\",\"cols\":48,\"rows\":5},\"width\":48,\"height\":5}",
    "  Box#corner {\"position\":\"absolute\",\"top\":73,\"left\":49}",
    "    Client#frame-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#9a3c28\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: lich, idle, desktop band": [
    "Box {\"width\":100,\"height\":12}",
    "  Svg {\"source\":\"[4202 chars #afc10364]\",\"alt\":\"Lich in the dark\",\"width\":796,\"height\":226,\"isInteractive\":true}",
    "  Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "    Client#lich-band {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"idle\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":100,\"rows\":12,\"view\":\"band\"},\"width\":100,\"height\":12}",
    "  Box#corner {\"position\":\"absolute\",\"top\":10,\"left\":97}",
    "    Client#band-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#9a3c28\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: lich, idle, terminal pane": [
    "Text",
    "  \"( o_o )\""
  ],
  "scene: lich, idle, terminal band": [
    "Text",
    "  \"( o_o )\""
  ],
  "scene: lich, working, desktop pane": [
    "Box {\"width\":52,\"height\":75}",
    "  Box {\"width\":52,\"height\":75}",
    "    Box {\"width\":52,\"height\":75,\"overflow\":\"hidden\",\"alignItems\":\"flex-start\"}",
    "      Svg {\"source\":\"[5292 chars #92659679]\",\"alt\":\"Lich in the dark\",\"width\":412,\"height\":1444,\"isInteractive\":true}",
    "      Box {\"position\":\"absolute\",\"top\":0,\"left\":0,\"flexDirection\":\"column\"}",
    "        Client#lich-0 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"working\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[0,19]},\"width\":52,\"height\":19}",
    "        Client#lich-1 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"working\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[19,19]},\"width\":52,\"height\":19}",
    "        Client#lich-2 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"working\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[38,18]},\"width\":52,\"height\":18}",
    "        Client#lich-3 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"working\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[56,19]},\"width\":52,\"height\":19}",
    "    Box#frame-tl {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#9a3c28\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#9a3c28\"}",
    "    Box#frame-tr {\"position\":\"absolute\",\"top\":0,\"left\":50}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#9a3c28\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-end\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#9a3c28\"}",
    "    Box#frame-bl {\"position\":\"absolute\",\"top\":74,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#9a3c28\"}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#9a3c28\"}",
    "    Box#frame-state {\"position\":\"absolute\",\"top\":1,\"left\":3}",
    "      Box {\"width\":19,\"height\":2}",
    "        Svg {\"source\":\"[314 chars #9cc8539e]\",\"alt\":\"WORKING\",\"width\":152,\"height\":34}",
    "    Box#frame-detail {\"position\":\"absolute\",\"top\":3,\"left\":3}",
    "      Text {\"color\":\"#6c34a8\"}",
    "        \"by hand\"",
    "    Box#frame-tag {\"position\":\"absolute\",\"top\":1,\"left\":42}",
    "      Client#frame-sigil {\"module\":\"hooks/frame-sigil.tsx\",\"props\":{\"colour\":\"#a860f0\",\"level\":\"working\",\"cols\":7,\"rows\":3,\"top\":8,\"bottom\":52},\"width\":7,\"height\":3}",
    "    Box#frame-sparks {\"position\":\"absolute\",\"top\":69,\"left\":2}",
    "      Client#frame-sparks {\"module\":\"hooks/frame-sparks.tsx\",\"props\":{\"colour\":\"#a860f0\",\"level\":\"working\",\"cols\":48,\"rows\":5},\"width\":48,\"height\":5}",
    "  Box#corner {\"position\":\"absolute\",\"top\":73,\"left\":49}",
    "    Client#frame-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#9a3c28\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: lich, working, desktop band": [
    "Box {\"width\":100,\"height\":12}",
    "  Svg {\"source\":\"[4202 chars #afc10364]\",\"alt\":\"Lich in the dark\",\"width\":796,\"height\":226,\"isInteractive\":true}",
    "  Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "    Client#lich-band {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"working\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":100,\"rows\":12,\"view\":\"band\"},\"width\":100,\"height\":12}",
    "  Box#corner {\"position\":\"absolute\",\"top\":10,\"left\":97}",
    "    Client#band-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#9a3c28\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: lich, working, terminal pane": [
    "Text",
    "  \"( >_< ) *\""
  ],
  "scene: lich, working, terminal band": [
    "Text",
    "  \"( >_< ) *\""
  ],
  "scene: lich, attention, desktop pane": [
    "Box {\"width\":52,\"height\":75}",
    "  Box {\"width\":52,\"height\":75}",
    "    Box {\"width\":52,\"height\":75,\"overflow\":\"hidden\",\"alignItems\":\"flex-start\"}",
    "      Svg {\"source\":\"[5292 chars #92659679]\",\"alt\":\"Lich in the dark\",\"width\":412,\"height\":1444,\"isInteractive\":true}",
    "      Box {\"position\":\"absolute\",\"top\":0,\"left\":0,\"flexDirection\":\"column\"}",
    "        Client#lich-0 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"attention\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[0,19]},\"width\":52,\"height\":19}",
    "        Client#lich-1 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"attention\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[19,19]},\"width\":52,\"height\":19}",
    "        Client#lich-2 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"attention\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[38,18]},\"width\":52,\"height\":18}",
    "        Client#lich-3 {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"attention\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":52,\"rows\":75,\"slice\":[56,19]},\"width\":52,\"height\":19}",
    "    Box#frame-tl {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#9a3c28\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#9a3c28\"}",
    "    Box#frame-tr {\"position\":\"absolute\",\"top\":0,\"left\":50}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#9a3c28\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-end\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#9a3c28\"}",
    "    Box#frame-bl {\"position\":\"absolute\",\"top\":74,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#9a3c28\"}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#9a3c28\"}",
    "    Box#frame-state {\"position\":\"absolute\",\"top\":1,\"left\":3}",
    "      Box {\"width\":24,\"height\":2}",
    "        Svg {\"source\":\"[316 chars #653a0c00]\",\"alt\":\"ATTENTION\",\"width\":192,\"height\":34}",
    "    Box#frame-detail {\"position\":\"absolute\",\"top\":3,\"left\":3}",
    "      Text {\"color\":\"#22905e\"}",
    "        \"by hand\"",
    "    Box#frame-tag {\"position\":\"absolute\",\"top\":1,\"left\":42}",
    "      Client#frame-sigil {\"module\":\"hooks/frame-sigil.tsx\",\"props\":{\"colour\":\"#3ccf8a\",\"level\":\"attention\",\"cols\":7,\"rows\":3,\"top\":8,\"bottom\":52},\"width\":7,\"height\":3}",
    "    Box#frame-sparks {\"position\":\"absolute\",\"top\":69,\"left\":2}",
    "      Client#frame-sparks {\"module\":\"hooks/frame-sparks.tsx\",\"props\":{\"colour\":\"#3ccf8a\",\"level\":\"attention\",\"cols\":48,\"rows\":5},\"width\":48,\"height\":5}",
    "  Box#corner {\"position\":\"absolute\",\"top\":73,\"left\":49}",
    "    Client#frame-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#9a3c28\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: lich, attention, desktop band": [
    "Box {\"width\":100,\"height\":12}",
    "  Svg {\"source\":\"[4202 chars #afc10364]\",\"alt\":\"Lich in the dark\",\"width\":796,\"height\":226,\"isInteractive\":true}",
    "  Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "    Client#lich-band {\"module\":\"hooks/lich-live.tsx\",\"props\":{\"mood\":\"attention\",\"moodAt\":1760000000000,\"moodBefore\":\"idle\",\"ink\":0,\"inkAt\":0,\"epoch\":1760000000000,\"cols\":100,\"rows\":12,\"view\":\"band\"},\"width\":100,\"height\":12}",
    "  Box#corner {\"position\":\"absolute\",\"top\":10,\"left\":97}",
    "    Client#band-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#9a3c28\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: lich, attention, terminal pane": [
    "Text",
    "  \"( O_O ) !\""
  ],
  "scene: lich, attention, terminal band": [
    "Text",
    "  \"( O_O ) !\""
  ],
  "scene: wisp, idle, desktop band": [
    "Box {\"width\":100,\"height\":9}",
    "  Box {\"width\":100,\"height\":9}",
    "    Box {\"width\":100,\"height\":9,\"overflow\":\"hidden\",\"alignItems\":\"flex-start\"}",
    "      Svg {\"source\":\"[14771 chars #6855e32f]\",\"alt\":\"Wisp in the fen\",\"width\":800,\"height\":190,\"isInteractive\":true}",
    "      Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "        Client#wisp-band {\"module\":\"hooks/wisp-live.tsx\",\"props\":{\"mood\":\"idle\",\"cols\":100,\"rows\":9,\"ink\":0},\"width\":100,\"height\":9}",
    "    Box#frame-tl {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#6f62d8\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#6f62d8\"}",
    "    Box#frame-tr {\"position\":\"absolute\",\"top\":0,\"left\":98}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#6f62d8\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-end\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#6f62d8\"}",
    "    Box#frame-bl {\"position\":\"absolute\",\"top\":8,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#6f62d8\"}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#6f62d8\"}",
    "    Box#frame-state {\"position\":\"absolute\",\"top\":7,\"left\":3}",
    "      Box {\"width\":93,\"height\":2,\"flexDirection\":\"row\",\"alignItems\":\"center\",\"justifyContent\":\"space-between\"}",
    "        Svg {\"source\":\"[965 chars #14c408f7]\",\"alt\":\"IDLE\",\"width\":49,\"height\":18}",
    "        Text {\"color\":\"#a0a0b8\"}",
    "          \"by hand\"",
    "  Box#corner {\"position\":\"absolute\",\"top\":7,\"left\":97}",
    "    Client#band-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#6f62d8\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: wisp, idle, terminal pane": [
    "Text",
    "  \"( o_o )\""
  ],
  "scene: wisp, idle, terminal band": [
    "Text",
    "  \"( o_o )\""
  ],
  "scene: wisp, working, desktop band": [
    "Box {\"width\":100,\"height\":9}",
    "  Box {\"width\":100,\"height\":9}",
    "    Box {\"width\":100,\"height\":9,\"overflow\":\"hidden\",\"alignItems\":\"flex-start\"}",
    "      Svg {\"source\":\"[14771 chars #6855e32f]\",\"alt\":\"Wisp in the fen\",\"width\":800,\"height\":190,\"isInteractive\":true}",
    "      Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "        Client#wisp-band {\"module\":\"hooks/wisp-live.tsx\",\"props\":{\"mood\":\"working\",\"cols\":100,\"rows\":9,\"ink\":0},\"width\":100,\"height\":9}",
    "    Box#frame-tl {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#6f62d8\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#6f62d8\"}",
    "    Box#frame-tr {\"position\":\"absolute\",\"top\":0,\"left\":98}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#6f62d8\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-end\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#6f62d8\"}",
    "    Box#frame-bl {\"position\":\"absolute\",\"top\":8,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#6f62d8\"}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#6f62d8\"}",
    "    Box#frame-state {\"position\":\"absolute\",\"top\":7,\"left\":3}",
    "      Box {\"width\":93,\"height\":2,\"flexDirection\":\"row\",\"alignItems\":\"center\",\"justifyContent\":\"space-between\"}",
    "        Svg {\"source\":\"[1670 chars #6e39ec3c]\",\"alt\":\"WORKING\",\"width\":85,\"height\":18}",
    "        Text {\"color\":\"#3fae8c\"}",
    "          \"by hand\"",
    "  Box#corner {\"position\":\"absolute\",\"top\":7,\"left\":97}",
    "    Client#band-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#6f62d8\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: wisp, working, terminal pane": [
    "Text",
    "  \"( >_< ) *\""
  ],
  "scene: wisp, working, terminal band": [
    "Text",
    "  \"( >_< ) *\""
  ],
  "scene: wisp, attention, desktop band": [
    "Box {\"width\":100,\"height\":9}",
    "  Box {\"width\":100,\"height\":9}",
    "    Box {\"width\":100,\"height\":9,\"overflow\":\"hidden\",\"alignItems\":\"flex-start\"}",
    "      Svg {\"source\":\"[14771 chars #6855e32f]\",\"alt\":\"Wisp in the fen\",\"width\":800,\"height\":190,\"isInteractive\":true}",
    "      Box {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "        Client#wisp-band {\"module\":\"hooks/wisp-live.tsx\",\"props\":{\"mood\":\"attention\",\"cols\":100,\"rows\":9,\"ink\":0},\"width\":100,\"height\":9}",
    "    Box#frame-tl {\"position\":\"absolute\",\"top\":0,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#6f62d8\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#6f62d8\"}",
    "    Box#frame-tr {\"position\":\"absolute\",\"top\":0,\"left\":98}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#6f62d8\"}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-end\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#6f62d8\"}",
    "    Box#frame-bl {\"position\":\"absolute\",\"top\":8,\"left\":0}",
    "      Box {\"flexDirection\":\"column\",\"width\":2,\"height\":1}",
    "        Box#down {\"flexDirection\":\"row\",\"height\":\"92%\",\"justifyContent\":\"flex-start\"}",
    "          Box {\"width\":\"10%\",\"height\":\"100%\",\"backgroundColor\":\"#6f62d8\"}",
    "        Box#across {\"width\":\"100%\",\"height\":\"8%\",\"backgroundColor\":\"#6f62d8\"}",
    "    Box#frame-state {\"position\":\"absolute\",\"top\":7,\"left\":3}",
    "      Box {\"width\":93,\"height\":2,\"flexDirection\":\"row\",\"alignItems\":\"center\",\"justifyContent\":\"space-between\"}",
    "        Svg {\"source\":\"[1928 chars #a126ed8c]\",\"alt\":\"ATTENTION\",\"width\":109,\"height\":18}",
    "        Text {\"color\":\"#c8a83a\"}",
    "          \"by hand\"",
    "  Box#corner {\"position\":\"absolute\",\"top\":7,\"left\":97}",
    "    Client#band-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#6f62d8\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "scene: wisp, attention, terminal pane": [
    "Text",
    "  \"( O_O ) !\""
  ],
  "scene: wisp, attention, terminal band": [
    "Text",
    "  \"( O_O ) !\""
  ],

  // Task 4: the nothing-awake view. Sprint 1.3 changes these on purpose.
  "nothing awake: desktop pane": [
    "Box {\"width\":52,\"height\":75}",
    "  Svg {\"source\":\"[9060 chars #f9858a61]\",\"alt\":\"Wisp: Asleep\",\"width\":408,\"height\":1425,\"isInteractive\":true}",
    "  Box#corner {\"position\":\"absolute\",\"top\":73,\"left\":49}",
    "    Client#frame-corner {\"module\":\"hooks/frame-corner.tsx\",\"props\":{\"colour\":\"#b8913a\",\"isOpen\":false},\"width\":3,\"height\":2}"
  ],
  "nothing awake: desktop band": [
    "Box {\"flexDirection\":\"row\",\"alignItems\":\"center\",\"gap\":1}",
    "  Svg {\"source\":\"[4440 chars #d4a10d6b]\",\"alt\":\"Wisp · Asleep · No Engram awake\",\"width\":140,\"height\":140,\"isInteractive\":true}",
    "  Box {\"flexDirection\":\"column\"}",
    "    Text {\"bold\":true}",
    "      \"Wisp · Asleep\"",
    "    Text {\"dimColor\":true,\"wrap\":\"truncate-end\"}",
    "      \"No Engram awake\""
  ],
  "nothing awake: terminal pane": [
    "Text",
    "  \"( -_- ) z\""
  ],
  "nothing awake: terminal band": [
    "Text",
    "  \"( -_- ) z\""
  ],

  // Sprint 1.5: where each appears under each surfaces switch combination. The band-only bug is fixed:
  // the Wisp never opens the pane by itself, and the pane, asked for, draws its band view (see the test).
  "placement: kraken, pane on, band on, hide on": {
    "surfaces": "pane on · band on (hidden while the pane is open)",
    "paneOpensAtStart": true,
    "paneShows": "the pane view",
    "bandWithPanePlaced": false,
    "bandWithPaneNotPlaced": true
  },
  "placement: kraken, pane on, band on, hide off": {
    "surfaces": "pane on · band on",
    "paneOpensAtStart": true,
    "paneShows": "the pane view",
    "bandWithPanePlaced": true,
    "bandWithPaneNotPlaced": true
  },
  "placement: kraken, pane on, band off": {
    "surfaces": "pane on · band off",
    "paneOpensAtStart": true,
    "paneShows": "the pane view",
    "bandWithPanePlaced": false,
    "bandWithPaneNotPlaced": false
  },
  "placement: kraken, pane off, band on, hide on": {
    "surfaces": "pane off · band on (hidden while the pane is open)",
    "paneOpensAtStart": false,
    "paneShows": "the pane view",
    "bandWithPanePlaced": false,
    "bandWithPaneNotPlaced": true
  },
  "placement: kraken, pane off, band on, hide off": {
    "surfaces": "pane off · band on",
    "paneOpensAtStart": false,
    "paneShows": "the pane view",
    "bandWithPanePlaced": true,
    "bandWithPaneNotPlaced": true
  },
  "placement: lich, pane on, band on, hide on": {
    "surfaces": "pane on · band on (hidden while the pane is open)",
    "paneOpensAtStart": true,
    "paneShows": "the pane view",
    "bandWithPanePlaced": false,
    "bandWithPaneNotPlaced": true
  },
  "placement: lich, pane on, band on, hide off": {
    "surfaces": "pane on · band on",
    "paneOpensAtStart": true,
    "paneShows": "the pane view",
    "bandWithPanePlaced": true,
    "bandWithPaneNotPlaced": true
  },
  "placement: lich, pane on, band off": {
    "surfaces": "pane on · band off",
    "paneOpensAtStart": true,
    "paneShows": "the pane view",
    "bandWithPanePlaced": false,
    "bandWithPaneNotPlaced": false
  },
  "placement: lich, pane off, band on, hide on": {
    "surfaces": "pane off · band on (hidden while the pane is open)",
    "paneOpensAtStart": false,
    "paneShows": "the pane view",
    "bandWithPanePlaced": false,
    "bandWithPaneNotPlaced": true
  },
  "placement: lich, pane off, band on, hide off": {
    "surfaces": "pane off · band on",
    "paneOpensAtStart": false,
    "paneShows": "the pane view",
    "bandWithPanePlaced": true,
    "bandWithPaneNotPlaced": true
  },
  "placement: wisp, pane on, band on, hide on": {
    "surfaces": "pane on · band on (hidden while the pane is open)",
    "paneOpensAtStart": false,
    "paneShows": "the band view",
    "bandWithPanePlaced": true,
    "bandWithPaneNotPlaced": true
  },
  "placement: wisp, pane on, band on, hide off": {
    "surfaces": "pane on · band on",
    "paneOpensAtStart": false,
    "paneShows": "the band view",
    "bandWithPanePlaced": true,
    "bandWithPaneNotPlaced": true
  },
  "placement: wisp, pane on, band off": {
    "surfaces": "pane on · band off",
    "paneOpensAtStart": false,
    "paneShows": "the band view",
    "bandWithPanePlaced": false,
    "bandWithPaneNotPlaced": false
  },
  "placement: wisp, pane off, band on, hide on": {
    "surfaces": "pane off · band on (hidden while the pane is open)",
    "paneOpensAtStart": false,
    "paneShows": "the band view",
    "bandWithPanePlaced": true,
    "bandWithPaneNotPlaced": true
  },
  "placement: wisp, pane off, band on, hide off": {
    "surfaces": "pane off · band on",
    "paneOpensAtStart": false,
    "paneShows": "the band view",
    "bandWithPanePlaced": true,
    "bandWithPaneNotPlaced": true
  },
}
