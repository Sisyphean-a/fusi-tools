type ThinkingMode = "enabled" | "disabled";

export interface ResolvedAiModel {
  apiModel: string;
  displayLabel: string;
  requestedModel: string;
  thinkingMode?: ThinkingMode;
}

const DEFAULT_FAST_MODEL = "deepseek-v4-flash";

export function resolveAiCommitModel(
  model: string | undefined,
  isUserConfigured: boolean,
): ResolvedAiModel {
  const requestedModel = model?.trim() || DEFAULT_FAST_MODEL;

  if (requestedModel === "deepseek-chat") {
    return {
      requestedModel,
      apiModel: DEFAULT_FAST_MODEL,
      thinkingMode: "disabled",
      displayLabel: "deepseek-v4-flash (non-thinking)",
    };
  }

  if (requestedModel === "deepseek-reasoner") {
    return {
      requestedModel,
      apiModel: DEFAULT_FAST_MODEL,
      thinkingMode: "enabled",
      displayLabel: "deepseek-v4-flash (thinking)",
    };
  }

  if (!isUserConfigured && requestedModel === DEFAULT_FAST_MODEL) {
    return {
      requestedModel,
      apiModel: requestedModel,
      thinkingMode: "disabled",
      displayLabel: "deepseek-v4-flash (non-thinking)",
    };
  }

  return {
    requestedModel,
    apiModel: requestedModel,
    displayLabel: requestedModel,
  };
}

export function buildChatRequestBody(
  resolvedModel: ResolvedAiModel,
  systemPrompt: string,
  userContent: string,
) {
  const requestBody: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
    stream: false;
    thinking?: { type: ThinkingMode };
  } = {
    model: resolvedModel.apiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    stream: false,
  };

  if (resolvedModel.thinkingMode) {
    requestBody.thinking = { type: resolvedModel.thinkingMode };
  }

  return requestBody;
}
