import { z } from "zod";

import type { MeshDefinitionClient } from "./candidate-definition-batch";

const languageValueSchema = z.object({
  "@language": z.string().min(1).optional(),
  "@value": z.string().min(1),
});

const languageValuesSchema = z.union([languageValueSchema, z.array(languageValueSchema).min(1)]);

const meshDescriptorResponseSchema = z.object({
  label: languageValuesSchema,
  preferredConcept: z.string().url(),
});

const meshConceptResponseSchema = z.object({
  identifier: z.string().min(1),
  scopeNote: languageValuesSchema,
});

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function fetchJson(url: string, attempt = 1): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    if (attempt < 3) {
      await delay(250 * attempt);
      return fetchJson(url, attempt + 1);
    }
    throw error;
  }
  if (!response.ok) {
    if (attempt < 3 && (response.status === 429 || response.status >= 500)) {
      await delay(250 * attempt);
      return fetchJson(url, attempt + 1);
    }
    throw new Error(`MeSH request failed ${response.status} ${url}`);
  }
  return response.json();
}

function meshIdFromUri(uri: string): string {
  return uri.slice(uri.lastIndexOf("/") + 1);
}

function englishValue(value: z.infer<typeof languageValuesSchema>): string {
  if (!Array.isArray(value)) return value["@value"];
  return value.find((entry) => entry["@language"] === "en")?.["@value"] ?? value[0]?.["@value"] ?? "";
}

export function createMeshDefinitionClient(baseUrl = "https://id.nlm.nih.gov/mesh"): MeshDefinitionClient {
  return {
    async definitionForDescriptor(descriptorId) {
      const descriptor = meshDescriptorResponseSchema.parse(await fetchJson(`${baseUrl}/${descriptorId}.json`));
      const conceptId = meshIdFromUri(descriptor.preferredConcept);
      const concept = meshConceptResponseSchema.parse(await fetchJson(`${baseUrl}/${conceptId}.json`));
      return {
        descriptorId,
        descriptorLabel: englishValue(descriptor.label),
        conceptId: concept.identifier,
        definition: englishValue(concept.scopeNote),
        definitionUrl: `${baseUrl}/${concept.identifier}`,
      };
    },
  };
}
