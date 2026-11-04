# Unicode Emoji data

`emoji.json` is generated from Unicode Emoji 18.0 `emoji-test.txt` and Chinese CLDR annotations, including fully qualified emoji and standalone components. The pinned CLDR revision is `7d2b9cb11cec08f4d333ad73209deb3df0711c3b`.

- Unicode data: https://www.unicode.org/Public/18.0.0/emoji/emoji-test.txt
- CLDR: https://github.com/unicode-org/cldr-json/tree/7d2b9cb11cec08f4d333ad73209deb3df0711c3b
- Copyright © 1991–2026 Unicode, Inc.; see `LICENSE.txt`.

`NotoColorEmoji.ttf` is Google's Noto Color Emoji font with Emoji 18 support, pinned to Google Fonts commit `142c8963e7606b510c93a644c82a4c4cdeae6ef9` (SHA-256 `4d82a18d8d95f60ba883ce242bbadbf84a576e987745dd7ba38d71c67cff2d73`). The font is distributed under the SIL Open Font License 1.1; see `OFL.txt`.

Regenerate with `scripts/build-unicode-emoji.cjs`, passing the official emoji test file and the Chinese regular and derived annotation JSON files.
