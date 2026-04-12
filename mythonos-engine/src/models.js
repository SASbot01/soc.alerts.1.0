// Mythonos model registry.
//
// The agent code never references a model id directly. It calls
// `getActiveModel()` so that switching to Mythos when it ships is a
// one-line env-var change (MYTHONOS_MODEL=mythos-preview) — nothing
// in the agent loop, tool layer, or storage layer needs to change.

const REGISTRY = {
  // Currently available — closest publicly-available frontier model.
  'claude-opus-4-6': {
    id: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    family: 'claude',
    contextWindow: 1_000_000,
    maxOutputTokens: 32_000,
    supportsToolUse: true,
    supportsPromptCache: true,
    available: true,
    description:
      'Latest publicly-available Anthropic frontier model. Used as the Mythonos brain until Mythos is publicly released.',
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    family: 'claude',
    contextWindow: 1_000_000,
    maxOutputTokens: 32_000,
    supportsToolUse: true,
    supportsPromptCache: true,
    available: true,
    description: 'Faster, cheaper sibling — useful for high-volume triage scans.',
  },
  // Placeholder slot for the moment Anthropic ships Mythos publicly.
  // The id below is a placeholder; replace with the official id once known.
  'mythos-preview': {
    id: 'mythos-preview',
    label: 'Mythos Preview',
    family: 'mythos',
    contextWindow: 2_000_000,
    maxOutputTokens: 64_000,
    supportsToolUse: true,
    supportsPromptCache: true,
    available: false,
    description:
      "Anthropic's frontier vulnerability-research model from Project Glasswing. Not yet publicly released — flip MYTHONOS_MODEL to this id as soon as Anthropic publishes credentials.",
  },
};

export function listModels() {
  return Object.values(REGISTRY);
}

export function getModel(id) {
  return REGISTRY[id] || null;
}

export function getActiveModelId() {
  return process.env.MYTHONOS_MODEL || 'claude-opus-4-6';
}

export function getActiveModel() {
  const id = getActiveModelId();
  const model = REGISTRY[id];
  if (!model) {
    throw new Error(
      `MYTHONOS_MODEL="${id}" is not in the registry. Add it to src/models.js or set a known id.`
    );
  }
  if (!model.available) {
    // We still return it — the API call may fail with a clear error from
    // Anthropic, which is the desired signal: "the model isn't out yet".
    return { ...model, _warning: `Model "${id}" is registered but flagged unavailable.` };
  }
  return model;
}
