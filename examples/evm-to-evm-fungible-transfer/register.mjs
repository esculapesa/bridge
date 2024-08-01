import { register } from 'ts-node/esm';
import { pathToFileURL } from 'url';

register(pathToFileURL('./src/transfer.ts'));