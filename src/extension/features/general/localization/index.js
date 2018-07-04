import { Feature } from 'toolkit/extension/features/feature';
import { observers } from './observers';

export class Localization extends Feature {
  observe(changedNodes) {
    observers.forEach(({ localize, observe }) => observe(changedNodes) && localize());
  }
}
