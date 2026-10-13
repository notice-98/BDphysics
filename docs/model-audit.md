# Vanilla planar-model audit

Verified on 2026-10-12 (Asia/Seoul). Fresh official client downloads were checked against the SHA-1 and byte length in Mojang's version metadata, then opened as ZIP archives. No game executable was run. The existing bundled model/blockstate JSON and plant PNGs match the official resources; the defect was in interpretation/rendering, not replaced textures. Original client archives remain outside the site checkout and are not published.

| Version | Models + blockstates compared | Plant PNGs compared | Client SHA-1 |
| --- | ---: | ---: | --- |
| 26.3 | 5480 | 63 | `e877b6a07acd633fb3bb475002175cec036e7b87` |
| 1.21.4 | 4386 | 54 | `a7e5a6024bfd3cd614625aa05629adf760020304` |

## Official sources

- [Mojang version manifest](https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)
- [26.3 metadata](https://piston-meta.mojang.com/v1/packages/702fe59163c6ee6578607daa85811d9bc9c7cc40/26.3.json) · [official client resources](https://piston-data.mojang.com/v1/objects/e877b6a07acd633fb3bb475002175cec036e7b87/client.jar)
- [1.21.4 metadata](https://piston-meta.mojang.com/v1/packages/010c66f4559d4647c282d581a451cda6d45777db/1.21.4.json) · [official client resources](https://piston-data.mojang.com/v1/objects/a7e5a6024bfd3cd614625aa05629adf760020304/client.jar)
- [26.3 release notes: model shading](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-3)

## Corrections

- Minecraft zero-thickness model elements already define separate front/back faces. Rendering both as DoubleSide duplicated coplanar, oppositely mapped quads. Explicit JSON faces now use front-face culling, retaining each side's UVs. This applies generically to crossed planes, potted plants, rails, vines, and other flat model parts.
- Honor legacy `shade: false` and 26.3 `shade_direction_override: up` using an unlit cutout material; other explicit shading directions supply the requested normal. Both front and back retain consistent plant brightness.
- Element rescaling applies to the center's offset from its rotation origin as well as its dimensions. This fixes offset planar elements such as sunflower heads and coral fans, without altering the source geometry.

## Regression coverage

`node tests/plant-models.mjs` resolves all blockstate-referenced planar models in all 25 bundled versions. It checks original transformed vertices, cutout shading, and visible face counts from both sides, including all potted variants. A separate asymmetric-UV case prevents mirrored front/back overlays, and placement ghosts keep the same culling. The rest of the physics/import/export suite also runs via `node tests/run.mjs`.

Minecraft assets remain copyright Mojang Studios / Microsoft; this is an unofficial viewer.
