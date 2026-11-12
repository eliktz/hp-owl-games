# 3D model credits & usage disclaimer

> **Disclaimer.** The 3D models in `assets/models/` are **fan-made** works downloaded from
> [Sketchfab](https://sketchfab.com). This project is an **unofficial, non-commercial**
> toy made for one child to explore at home — **personal, non-commercial family use only**,
> **not for any commercial use**. All *Harry Potter* names, characters and related
> intellectual property belong to **Warner Bros. Entertainment Inc. and J.K. Rowling**.
> This project is not affiliated with, endorsed by, or sponsored by them. If you are a
> rights holder or a model's author and would like something removed, please open an issue
> and it will be **removed on request**.

The models were optimised for the web (geometry → Meshopt compression; textures → resized
to ≤1024 px and re-encoded as WebP) with `tools/optimize/optimize.mjs`. The original,
un-optimised downloads are kept locally in `private-assets/` (gitignored, not published).

## Attribution

Per the CC-BY-4.0 licence terms, the following authors **must be credited**:

| In-game use | Model | Author | Source | License |
|---|---|---|---|---|
| Great Hall interior | The Great Hall in Hogwarts Harry Potter | **s23383** | [Sketchfab](https://sketchfab.com/3d-models/the-great-hall-in-hogwarts-harry-potter-aa65c92e370f464ba81080cae44ab71f) | CC-BY-4.0 |
| Library / study interior | Dumbledore's Office | **zack_graham** | [Sketchfab](https://sketchfab.com/3d-models/dumbledores-office-c5fdffa78c9442bb93a88c386d4ad53d) | CC-BY-4.0 |
| Hedwig the owl | Hedwig | **cgbilz** | [Sketchfab](https://sketchfab.com/3d-models/hedwig-d02ece714c8b4f2ead4b27bbfa98d515) | CC-BY-4.0 |
| Quidditch pitch props | Harry Potter props Homework 3 XYZ | **Kate Abaeva** | [Sketchfab](https://sketchfab.com/3d-models/harry-potter-props-homework-3-xyz-7a72bb34c22e4395a0b51301269455b9) | CC-BY-4.0 |
| Hermione (character) | Hermione Granger | **zack_graham** | [Sketchfab](https://sketchfab.com/3d-models/hermione-granger-95714784f5bb4ac697040ec602b97932) | CC-BY-4.0 |
| Ron (character) | Ronald Weasley | **zack_graham** | [Sketchfab](https://sketchfab.com/3d-models/ronald-weasley-d3419667f6a345a09987a6c57d936d0a) | CC-BY-4.0 |
| Professor McGonagall (Transfiguration classroom, rigged + animated) | Professor Minerva McGonagall | **zack_graham** | [Sketchfab](https://sketchfab.com/3d-models/professor-minerva-mcgonagall-957f44df7b384272bf7cde7d0006285a) | CC-BY-4.0 (uploader's licence label) |

### Full CC-BY attribution strings

- This work is based on ["The Great Hall in Hogwarts Harry Potter"](https://sketchfab.com/3d-models/the-great-hall-in-hogwarts-harry-potter-aa65c92e370f464ba81080cae44ab71f) by s23383, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
- This work is based on ["Dumbledore's Office"](https://sketchfab.com/3d-models/dumbledores-office-c5fdffa78c9442bb93a88c386d4ad53d) by zack_graham, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
- This work is based on ["Hedwig"](https://sketchfab.com/3d-models/hedwig-d02ece714c8b4f2ead4b27bbfa98d515) by cgbilz, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
- This work is based on ["Harry Potter props Homework 3 XYZ"](https://sketchfab.com/3d-models/harry-potter-props-homework-3-xyz-7a72bb34c22e4395a0b51301269455b9) by Kate Abaeva, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
- This work is based on ["Hermione Granger"](https://sketchfab.com/3d-models/hermione-granger-95714784f5bb4ac697040ec602b97932) by zack_graham, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
- This work is based on ["Ronald Weasley"](https://sketchfab.com/3d-models/ronald-weasley-d3419667f6a345a09987a6c57d936d0a) by zack_graham, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/).
- This work is based on ["Professor Minerva McGonagall"](https://sketchfab.com/3d-models/professor-minerva-mcgonagall-957f44df7b384272bf7cde7d0006285a) by zack_graham, licensed under [CC-BY-4.0](http://creativecommons.org/licenses/by/4.0/) (the uploader's licence label; the model is game-extracted from *Harry Potter: Hogwarts Mystery*). Use approved by Elik on 12 Nov 2026. Skeleton and the Idle/Walk/Talk/Cast animations: [Quaternius Universal Animation Library](https://quaternius.com) (CC0). Glasses and wand were made in our own art workspace. Optimised to Meshopt geometry + KTX2 (Basis) textures.

Harry and Hagrid as walking characters are **drawn in code** (no fan model), to match the
game's chibi style. "Great Hall Window" by Saandy and a duplicate "Hagrid's hut" were
downloaded but **dropped** (a lone window frame / an exact duplicate) to keep the committed
set small.


## Not published

"Hagrid's hut" by Katydid ([Sketchfab](https://sketchfab.com/3d-models/hagrids-hut-915ea9ebeda44e08b3f9957e31b66b85)) is under the **Sketchfab Standard** licence, which does not allow redistributing the model file, so it is **not** in this repository. An optimised copy is kept only locally in `private-assets/optimized/` (gitignored); the public game runs without it.
