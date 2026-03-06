# Smart Translate API Switch Design

**Goal:** 将智能翻译底层接口从当前谷歌接口切换到 `https://fanyi.sisyphean.top/single`，同时保持现有交互与“中文转英文，非中文转中文”的业务规则不变。

**Scope:** 仅调整 `src/features/smartTranslate/translator.ts` 的请求与响应解析，并补充对应单元测试。

**Design:**
- 保留本地 `LanguageDetector` 的方向判断：`zh -> en`，其他 -> `zh`。
- 调用新接口时，将内部目标语言 `zh` 映射为接口所需的 `zh_CN`；英文保持 `en`。
- 响应解析从旧的 `sentences[].trans` 改为读取 `translation`。
- 如果返回 `info.detectedSource`，则优先作为结果中的 `sourceLanguage`，否则回退到本地检测值。
- 保留现有缓存、复合词预处理与错误抛出行为。

**Testing:**
- 新增 `src/test/smartTranslate/translator.test.ts`。
- 覆盖中文转英文与英文转中文两个方向的参数映射和响应解析。
- 通过子类覆写 HTTP 请求方法避免真实网络请求。
