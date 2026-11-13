import { ensureEnvFile, loadEnvFile } from './load-env';

const result = ensureEnvFile();
loadEnvFile();

console.info(
  result.created
    ? `Created ${result.path} from .env.example. Review it before deploying.`
    : `.env already exists at ${result.path}.`,
);
