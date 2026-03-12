import cluster from 'node:cluster';
import os from 'node:os';

export const resolveClusterWorkerCount = (requested: number): number => {
  if (requested > 0) {
    return requested;
  }

  return Math.max(1, Math.min(4, os.availableParallelism()));
};

export const isClusterPrimary = (): boolean => cluster.isPrimary;

export const forkClusterWorkers = (count: number): void => {
  for (let index = 0; index < count; index += 1) {
    cluster.fork();
  }

  cluster.on('exit', () => {
    cluster.fork();
  });
};
