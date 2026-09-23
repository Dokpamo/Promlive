# AI model catalogs

The picker renders the bundled catalog or the last successful catalog immediately. Every opening refreshes the selected provider, connection and modality in the background. New IDs are prepended; existing IDs keep their relative order and receive updated metadata. Successful empty responses are authoritative. Errors retain the previous list, and a missing saved model never changes the selection automatically.

Catalogs are cached in the settings repository under `ai:catalogs:v1`, with at most 48 snapshots retained for 30 days. A SHA-256 digest of provider, route, endpoint, protocol, project, credential and modality isolates snapshots. API keys, endpoint strings and upstream error bodies are not persisted in the catalog. Changing a connection cancels its picker subscriber; duplicate requests share one in-flight lookup and abort after their last subscriber leaves.

An update immediately shifts the existing rows over 360 ms. New rows begin appearing at 240 ms, fading from zero opacity and growing from 96.5% scale over 280 ms, for a total of 520 ms. The live picker and preview share these timings. The catalog sheet keeps a stable height so incoming rows do not move the whole popup. Identical catalogs and search filtering do not replay entrance motion. Reduced motion skips the transition.

Only catalog GET requests are connected. Inference and OAuth login remain separate future work. API keys supplied in settings save immediately to the separate platform credential store and restore after restarting. Keys are isolated by provider and connection route, including inactive API regions. Clearing the field deletes that key. Native storage uses Keychain/Keystore/Credential Manager; web storage uses origin-local IndexedDB with AES-GCM and a non-extractable local CryptoKey, not an OS keychain. Keys are excluded from serialized preferences and catalog caches. No environment key is read. Public OpenRouter models are a catalog, not a claim of account access. Z.AI uses the bundled list until a documented discovery contract is available.

## Official baseline, audited 2026-09-21

The previous two-or-three-model examples have been replaced by `src/features/settings/catalogs/officialModels.json`. Every registered provider is covered. Each provider records its official source URLs; the picker distinguishes **official documentation**, **public OpenRouter**, **cached**, and **fresh connection** results. Documentation availability is not account entitlement or region availability. A successful authenticated catalog still replaces the baseline, including a genuinely empty catalog.

| Provider | Chat | Image | Video | Audio | TTS voices |
| --- | ---: | ---: | ---: | ---: | ---: |
| OpenAI | 38 | 7 | 2 | 21 | — |
| Anthropic | 14 | — | — | — | — |
| Gemini | 17 | 4 | 3 | 14 | — |
| xAI | 7 | 3 | 2 | 1 | 5 |
| DeepSeek | 2 | — | — | — | — |
| OpenRouter | 431 | 54 | 29 | 43 | — |
| MiniMax | 8 | 1 | 10 | 10 | — |
| MiMo | 2 | — | — | 4 | — |
| Qwen / Model Studio | 136 | 36 | 42 | 93 | — |
| Z.AI | 21 | 2 | 1 | 1 | — |
| Kimi | 4 | — | — | — | — |
| Ollama / custom | Server discovery | — | — | — | — |

Counts are for the audit date. Retired models are excluded; announced future retirements are labeled and filtered automatically on the retirement date. For example, OpenAI Sora is still listed on September 21 and expires on September 24, while xAI Imagine Image Quality expires on November 2. Existing selected IDs are never silently replaced. Anthropic's **deprecated** status does not mean **retired**; Mythos Preview remains listed with its restriction. Specialized access-limited models are labeled. API-specific output modes do not imply interchangeable inference endpoints.

OpenAI's baseline covers canonical API model families, not every dated alias or customer fine-tune; live discovery supplies those. Open-weight downloads, embedding, reranking, moderation, OCR/layout-only and other utility endpoints are not offered as conversation-generation models. Qwen includes the documented Model Studio catalog across regions, including its hosted third-party models; a model retired by its original provider may still be served by Model Studio. Obsolete Qwen2.5 entries and explicitly discontinued entries are excluded. Ollama and custom endpoints have no universal installed catalog, so no models are invented for them.

OpenRouter's snapshot was fetched from its unauthenticated `GET /api/v1/models?output_modalities=all`, retaining only IDs, names, output categories, token limits and supported-parameter flags. Descriptions, pricing and account data are not bundled. Live OpenRouter requests use the same `output_modalities=all` query. Speech/transcription output categories are classified as audio; image/video **input** never implies generation support.

MiniMax's OpenAI-compatible discovery documentation shows language-model examples without guaranteeing media coverage. Its media pickers accept returned media IDs but retain their documented baseline if the response only contains text models. That absence is not presented as proof that the account cannot use media. xAI has separate language, image, video and TTS-voice discovery endpoints; the voice-agent model remains a documented audio choice. Z.AI has no documented discovery contract. These limitations are shown without pretending a fallback is a live result.

Reasoning controls are model-specific: Grok 4.5 exposes low/medium/high; 4.6 also exposes xhigh. GLM-5.3/Flash use forced thinking, so no off switch is offered. Kimi K3 offers low/high/max; K2.7 Code always thinks; K2.6 can disable thinking. Unknown capabilities remain conservative, and actual API metadata takes precedence. Fields exposed by an API-compatible gateway are not assumed to be hosted tools.

## Reasoning selection, checked 2026-09-23

Choosing a conversation model saves it immediately. Models with selectable reasoning levels open a second sheet from the right. Back returns to the still-mounted catalog without restarting discovery or resetting its scroll position. Choosing a level saves that model's preset and closes both sheets after their exit animations finish. Models without level choices finish at the model picker.

The level picker contains actual levels only, with no `default` row. A valid saved level wins; otherwise `defaultEffort` resolves the old/default preference to the documented or server-reported level. Defaults are model-specific: Grok 4.5/4.6, the bundled Claude effort models and DeepSeek use high; GLM and Kimi K3 use max; current Qwen 3.8 uses xhigh; Gemini Flash defaults vary by version. Gemini 2.5 uses token budgets, so fabricated low/medium/high choices were removed. Qwen-hosted third-party models do not inherit their native provider's controls automatically.

xAI's `capabilities.default_reasoning_effort` and OpenRouter's `reasoning.supported_efforts`, `default_effort`, `default_enabled` and `mandatory` override bundled metadata. Older cached rows can inherit newly documented defaults, but an empty server effort list remains authoritative. Unknown or unsupported defaults stay unselected (the settings row reads 선택); choosing the first or middle item is not a substitute for knowing a default. No inference request is introduced by this flow.

Default/level sources:

- OpenAI: https://developers.openai.com/api/docs/guides/reasoning and the individual model pages (model-dependent defaults; unconfirmed models remain unselected).
- Claude: https://platform.claude.com/docs/en/build-with-claude/effort
- Gemini: https://ai.google.dev/gemini-api/docs/generate-content/thinking
- xAI: https://docs.x.ai/developers/model-capabilities/text/reasoning and https://docs.x.ai/developers/rest-api-reference/inference/models
- DeepSeek: https://api-docs.deepseek.com/guides/thinking_mode/
- Qwen: https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions
- GLM: https://docs.z.ai/api-reference/llm/chat-completion
- Kimi: https://platform.kimi.ai/docs/api/models-overview
- OpenRouter: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens

Grok's account-login UI has been restored alongside the API-key route, following the Hermes device-code flow documentation. It remains a preview with no login or account catalog implemented. Removed MiniMax and Qwen login routes restore their separately saved API profile, without moving account-only models between routes. ChatGPT/Codex, Google Cloud and OpenRouter login entries also remain explicitly labeled as not yet integrated.

Qwen's China discovery route uses the documented workspace host (`{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/models`), rather than assuming the old inference host has the same listing API. Its connection UI collects that workspace ID, validates it before sending a key, and includes it in cache isolation. Singapore continues to use the documented public DashScope catalog endpoint with account authentication.

To update the baseline, review the URLs in the JSON, reconcile lifecycle notices and regional availability, update only factual model metadata and the audit date, then run `npm run verify`. Keep generated-media models separate from vision-input chat models, preserve current selections, and check the keyless model picker in the app.

## Source contracts checked 2026-09-21

- OpenAI: https://developers.openai.com/api/reference/resources/models/methods/list
- Anthropic (cursor pages, model capabilities and token limits): https://platform.claude.com/docs/en/api/models/list
- Gemini (page tokens, generation methods and token limits): https://ai.google.dev/api/models
- xAI language/image/video: https://docs.x.ai/developers/rest-api-reference/inference/models
- xAI voices: https://docs.x.ai/developers/model-capabilities/audio/text-to-speech
- xAI media fallback: https://docs.x.ai/developers/models/grok-imagine-image-2.0 and https://docs.x.ai/developers/models/grok-imagine-video-1.5
- OpenRouter (modalities, supported parameters): https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties
- DeepSeek: https://api-docs.deepseek.com/api/list-models/
- MiniMax: https://platform.minimax.io/docs/api-reference/models/openai/list-models
- MiMo: https://mimo.mi.com/docs/zh-CN/api/model/list-models
- Qwen (workspace/region endpoint, numbered pages): https://docs.modelstudio.console.alibabacloud.com/en/model-studio/list-models
- Kimi: https://platform.kimi.com/docs/api/models-overview and https://platform.kimi.com/docs/models; `/v1/models` uses the selected Moonshot region. Account-authenticated verification is still required.
- Ollama: https://docs.ollama.com/api/tags
- Z.AI published API index: https://docs.z.ai/llms.txt

Unavailable or undocumented discovery responses never masquerade as a successful live list. Provider-supplied reasoning/parameter metadata takes precedence over bundled known-model settings. Unknown model controls are kept conservative. Function-calling support does not imply a provider-hosted web search or code-execution tool.
