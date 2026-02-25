import { describe, it } from 'vitest';

// Tests for src/generation/description/task-description-generation-service.ts
describe('TaskDescriptionGenerationService', () => {
    describe('generateTaskFromQuery', () => {
        it.todo('delegates to the template engine when generationType is "template"');
        it.todo('delegates to the LLM engine when generationType is "llm"');
        it.todo('throws when generationType is "llm" but no GptOption is provided');
        it.todo('delegates to both engines in sequence when generationType is "hybrid"');
        it.todo('returns the fallback message for an unknown generationType');
    });
});
