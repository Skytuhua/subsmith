declare module "jschardet" {
  export interface DetectResult {
    encoding: string | null;
    confidence: number;
  }
  export function detect(buffer: string | Uint8Array): DetectResult;
  const _default: { detect: typeof detect };
  export default _default;
}
