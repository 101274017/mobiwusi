# Pet asset quality rules

`assessAnimatedPetAsset` 是 C13 的共享结构门控，不是 AI 生成质量或设计签收。

它只允许满足以下条件的 `generated_2d` manifest 进入本机预览：

- 画布单边不超过 2048px，解码内存不超过 64MiB。
- `body`、`eyes`、`mouth` 图层齐全，图层边界在画布内，资源只能引用受控本地路径。
- `idle`、`listening`、`thinking`、`speaking`、`pointing`、`celebrating`、`concerned`、`paused` 八种状态都有关键帧。
- 配色、关键帧、时长、字段集合和 manifest 身份全部通过严格校验。

结构门通过后仍然标记 `manualReviewRequired: true` 和 `publishEligible: false`。相似性、动作自然度、遮挡穿帮、五官完整性和儿童可理解性必须由真实生成样本与设计复核完成；静态图片加 CSS 动画不能替代生成资产。

## C11 3D local preflight

`inspectThreeDAsset` is a conservative local-resource preflight for the desktop-only 3D candidate path. It does not instantiate Three.js, download sidecars, or claim that a format is fully render-compatible.

- GLB and VRM containers are identified from their binary header and glTF JSON; the filename is not treated as proof.
- FBX binary/ASCII headers can be recognized, but preview requires a strict summary from an isolated parser. Header recognition alone is never a compatibility result.
- The candidate matrix is VRM `0.x/1.0`, FBX `7.4/7.5`, and glTF/GLB `2.0`. Android remains disabled and the desktop result is still a candidate specification.
- External URIs, script/shader references, malformed containers, unsupported extensions/materials, oversized textures, more than `100,000` triangles, more than `512MiB` parser peak, more than `300MiB` decoded resources, or suspicious expansion ratios fall back to 2D.
- Models without a recognized standard action skeleton may be previewed as display-only; action compatibility is reported separately and is never inferred from the file extension.

The C11 tests use synthetic local bytes and parser summaries. They prove the preflight boundary and fallback behavior, not real Three.js rendering, supplier assets, device frame rate, or the final E20/F03 acceptance.
