const DEFAULT_ROOT = '';
const DEFAULT_PORT = 4300;
const DEFAULT_HOST = '0.0.0.0';

export function standaloneConfig(env = {}) {
  const root = env.PAYEASE_STANDALONE_ROOT || DEFAULT_ROOT;
  const appRoot = root ? root + '/app' : '/app';
  const dataRoot = root ? root + '/data' : '/data';
  const port = env.PAYEASE_STANDALONE_PORT ? Number(env.PAYEASE_STANDALONE_PORT) : DEFAULT_PORT;
  const host = env.PAYEASE_STANDALONE_HOST || DEFAULT_HOST;
  return { root, appRoot, dataRoot, port, host };
}
