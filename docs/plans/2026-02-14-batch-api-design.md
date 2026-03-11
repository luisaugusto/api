# OpenAI Batch API Integration Design

**Date**: 2026-02-14
**Status**: Approved

## Overview

Integrate OpenAI's Batch API to parallelize recipe data generation and image generation, achieving 50% cost savings and faster overall processing by submitting both requests simultaneously rather than sequentially.

## Goals

- **Parallelization**: Execute recipe data generation and image generation concurrently
- **Cost Savings**: Leverage Batch API's 50% discount on API calls
- **Simplicity**: Minimal changes to existing architecture, single-phase implementation
- **Same prompt**: Use the user's input prompt for both data and image generation (no need for detailed image prompts)

## Architecture

### Single-Phase Implementation

Within existing `waitUntil()` blocks in recipe handlers:

1. Create JSONL file with 2 requests (data + image)
2. Upload file to OpenAI Files API
3. Submit batch job to OpenAI Batch API
4. Poll for completion with 5-minute timeout
5. Parse results and create/update Notion page as usual
6. If timeout: fail gracefully (to be expanded later)

### Data Flow

```
User Request
     ↓
waitUntil(() => {
  Create JSONL: [data request, image request]
       ↓
  Upload to OpenAI Files API → file_id
       ↓
  Create batch → batch_id
       ↓
  Poll every 10s (max 5 min)
       ↓
  Batch complete → download results
       ↓
  Parse recipe data + image b64
       ↓
  Create/update Notion page as usual
})
     ↓
Response: "Recipe creation in progress"
```

## Batch API Integration

### JSONL Format

Each line represents one request:

```jsonl
{"custom_id":"recipe-data","method":"POST","url":"/v1/responses/parse","body":{"input":"make me pasta carbonara","instructions":"You are a helpful assistant...","model":"gpt-5-mini","text":{"format":{...zod schema...}}}}
{"custom_id":"recipe-image","method":"POST","url":"/v1/images/generate","body":{"model":"gpt-image-1.5","prompt":"make me pasta carbonara","size":"1024x1024","response_format":"b64_json"}}
```

### OpenAI SDK Calls

1. **Upload**: `openai.files.create({ file: Buffer.from(jsonl), purpose: "batch" })` → `file_id`
2. **Create batch**: `openai.batches.create({ input_file_id: file_id, endpoint: "/v1/responses/parse", completion_window: "24h" })` → `batch_id`
3. **Poll**: `openai.batches.retrieve(batch_id)` every 10 seconds
4. **Download**: `openai.files.content(output_file_id)` when complete
5. **Parse**: Extract responses by `custom_id`

### Key Details

- Use `custom_id` to match requests/responses (order not guaranteed)
- Both requests use same `input` prompt
- Image uses `response_format: "b64_json"` (matches current behavior)

## Polling Strategy

```typescript
const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL = 10 * 1000;     // 10 seconds

while (Date.now() - startTime < MAX_POLL_TIME) {
  const batch = await openai.batches.retrieve(batch_id);

  if (batch.status === "completed") break;
  if (batch.status === "failed" || batch.status === "expired") {
    throw new Error(`Batch ${batch.status}`);
  }

  await sleep(POLL_INTERVAL);
}
```

Fixed 10-second intervals, no exponential backoff needed.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Batch creation fails | Throw immediately, existing error handlers catch |
| Timeout (5 minutes) | Throw "Batch timeout" error |
| Batch failed/expired | Throw error with OpenAI's reason |
| Partial failure | Throw error (need both results) |
| File parsing error | Throw error (invalid response) |

All errors propagate to existing `catch` blocks in recipe APIs, which call `setResponse()` with 500 status.

## Implementation

### New Method: `lib/shared/openai.ts`

```typescript
export const generateDataAndImageBatch = async <T extends ResponseFormatTextConfig>({
  input,
  instructions,
  format,
}: {
  input: string;
  instructions: string;
  format: T;
}): Promise<{
  data: NonNullable<ParsedResponse<...>["output_parsed"]>;
  imageB64: string;
}>
```

**Responsibilities**:
- Create JSONL with both requests
- Upload file and create batch
- Poll for completion
- Parse and return both results

### Modified Files

**`lib/shared/openai.ts`**:
- Add `generateDataAndImageBatch()` method
- Keep existing methods for backward compatibility

**`api/recipes/index.ts`**:
- Replace `generateData().then(generateRecipeImage())` with `generateDataAndImageBatch()`
- Destructure `{ data: recipe, imageB64 }` from result
- Convert `imageB64` to Notion cover format

**`api/recipes/modify/index.ts`**:
- Same replacement pattern
- Destructure and use batch results

**`lib/shared/recipes.ts`**:
- Extract image upload logic to helper: `uploadImageBase64ToNotion(imageB64, title)`
- Keep existing `generateRecipeImage()` for backward compatibility

## Trade-offs

### Accepted

- **5-minute timeout**: Batches taking longer will fail (can expand with Cron later)
- **Simpler prompts**: Image uses same prompt as recipe (not detailed prompt built from recipe data)
- **Within waitUntil**: Polling happens in request context, not separate worker

### Benefits

- **50% cost savings** on OpenAI API calls
- **True parallelization** of data + image generation
- **Minimal changes** to existing architecture
- **Generic method** can be reused for other data + image use cases

## Future Enhancements

- Add Cron worker for batches taking longer than 5 minutes
- Store batch_id in Notion for status tracking
- Support retry logic for failed batches
- Metrics/monitoring for batch completion times
