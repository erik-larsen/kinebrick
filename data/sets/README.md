# Per-set data

Everything KineBrick knows about a real LEGO set that's too long or nested for its row in [models/technic-sets.csv](../../models/technic-sets.csv), one file per set (`<set>.json`, e.g. `855-1.json`), in three sections kept apart by where they come from (see [Per-set data](../../ARCHITECTURE.md#per-set-data)):

| Section | What | Written by |
|---|---|---|
| `imported` | `instructions`: the set's building instructions as downloaded into `omr/instructions/`, each LEGO PDF (`url`, `file`, in the order LEGO's site lists them) or a folder of scans (`url`, `folder`, `pages`). Empty where neither was found. | `npm run instructions` |
| `curated` | `model`, `instructions`, `functions` (below), `questions` for someone who knows the set, and `settings`: KineBrick's own lines for a set in `models/`, by its file name there, which `npm run import` puts into that file | People, or agents' drafts that people review |
| `generated` | What KineBrick does with each of the set's functions today, its model's loose parts, and the commit and date they were measured at (see [The function check](../../ARCHITECTURE.md#the-function-check)) | `npm run functions`, afresh each time |

```json
{
  "set": "855-1",
  "imported": { "instructions": [ { "url": "https://lego.brickinstructions.com/en/lego_instructions/set/855", "folder": "omr/instructions/855-1/", "pages": 21 } ] },
  "curated": {
    "model": "models/855-Mobile Crane.mpd",
    "instructions": "omr/instructions/855-1/ (scans; the crane is pages 1-13, the tipper truck after)",
    "functions": [
      {
        "does": "The crank high on the cab's right side extends the boom's blue inner section.",
        "source": "book: boom steps 5-6, 9 and 13",
        "control": "p483 3736",
        "moves": ["p402 3703 against p315 3029"],
        "stays": ["p315 3029 against p162 3404"]
      }
    ]
  },
  "generated": {}
}
```

The set's name, year and links are in the CSV, not here.

## Curated

| Field | |
|---|---|
| `model` | The model file the set's parts are counted in, for `functions`. |
| `instructions` | Which book or pages build the model, and where its functions are drawn, in plain English. |
| `functions` | What each of the set's controls is supposed to do: drafted from its building instructions and checked by someone who knows the set. They're the reference the joints probe lacks: it can tell that a control moved, but not whether it moved the right thing. |
| `questions` | What the instructions leave open, each a `question`, with its `answer` once someone gives one. |
| `settings` | KineBrick's own LDraw lines for a set in `models/`, by its file name there (`"854-Go Kart": ["0 !KINEBRICK SCRUB [percent=16]"]`). |

## Functions

Each function has:

| Field | |
|---|---|
| `does` | What it does, in plain English, as the set's owner would say it. |
| `source` | Where that comes from: `book:` and the steps or pages that show it, or `inferred:` and why, where the book doesn't show it. |
| `control` | The part a person turns or pushes to work it, or a list of parts that each do it alike (four outriggers). Left out where nothing is worked by hand. |
| `moves` | Parts that must move when the control is worked, each against the frame or `against` another part. The control itself must always move. |
| `stays` | Parts that must not move, against the frame or `against` another part. |
| `first` | Controls to work first, in order, each `{"control": "p12 3482", "by": 1.5}` (radians, or LDU for a slide), for a function that only works after another one (lower the implement, then roll). |
| `skip` | Why it isn't modelled: a ratchet, brake or spring only matters under gravity or force, which KineBrick doesn't simulate yet. Kept so it isn't forgotten. |
| `note` | Anything else, such as which test checks a function the fields can't express. |

A part is named as the joints probe names it: `p` and its place among the model's parts in file order, then its part number (`p483 3736`, the 484th part, a 3736). Its place is counted in the model file named by `model`. Everything after the first space is the part's name, which may have spaces of its own (`p250 120270 - 4185a`).
