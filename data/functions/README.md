# Function lists

What each real LEGO set's controls are supposed to do, in plain English, one file per set (`<set>.json`, e.g. `855-1.json`), drafted from the set's building instructions and checked by someone who knows the set. They're the reference the joints probe lacks: it can tell that a control moved, but not whether it moved the right thing.

```json
{
  "set": "855-1",
  "name": "Mobile Crane",
  "model": "models/855-Mobile Crane.mpd",
  "instructions": "omr/instructions/855-1/ (scans; the crane is pages 1-13)",
  "functions": [
    {
      "does": "The crank high on the cab's right side extends the boom's blue inner section.",
      "source": "book: boom steps 5-6, 9 and 13",
      "control": "p483 3736",
      "moves": ["p402 3703 against p315 3029"],
      "stays": ["p315 3029 against p162 3404"]
    }
  ]
}
```

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
