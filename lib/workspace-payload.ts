/** Keep the serialized tenant workspace below D1's single-value limit. */
export const MAX_WORKSPACE_PAYLOAD_BYTES = 1_500_000;

export function serializeWorkspacePayload(value: unknown): string {
  const payload = JSON.stringify(value);
  const bytes = new TextEncoder().encode(payload).byteLength;
  if (bytes > MAX_WORKSPACE_PAYLOAD_BYTES) {
    const error = new Error('工作区数据已接近存储上限，请先归档历史业务记录');
    (error as Error & {code?: string}).code = 'WORKSPACE_PAYLOAD_LIMIT';
    throw error;
  }
  return payload;
}
