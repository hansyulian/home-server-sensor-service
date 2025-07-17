import { appConfig } from "~/config";
import { execPromise } from "~/utils/execPromise";

export const hddInfo: { states: any[] } = {
  states: []
}

let diskWatcherInterval: NodeJS.Timeout | undefined;

export function startDiskWatcher() {
  if (diskWatcherInterval) {
    return false;
  }
  console.log('starting disk watcher');

  reloadReadings();
  diskWatcherInterval = setInterval(reloadReadings, 60000);
}

export function stopDiskWatcher() {
  if (!diskWatcherInterval) {
    return false;
  }
  console.log('stopping disk watcher');
  clearInterval(diskWatcherInterval);
  diskWatcherInterval = undefined;
  return true;
}

async function reloadReadings() {
  hddInfo.states = await readHddStates(appConfig.hddWatch);
}

async function readHddStates(hddNames?: string[]) {
  const normalizedHddNames = (hddNames ?? (await getBaseDisks())).filter((record) => !record.startsWith('/dev/nvme'));
  const result = await Promise.all(normalizedHddNames.map((hddName) => readHddState(hddName)));
  return result;
}

async function readHddState(hddName: string) {
  try {
    const result = await execPromise('sudo hdparm -C', hddName);
    const match = result.match(/drive state is:\s*([a-z]+)/);
    const status = !match ? undefined : match[1];
    // const smartOutput = await execPromise(`sudo smartctl -H ${hddName}`);
    // const isHealthy = /PASSED/.test(smartOutput);
    return {
      name: hddName,
      status,
      // isHealthy,
    };
  } catch (err: any) {
    return {
      name: hddName,
      status: 'error',
      error: err.message,
    };
  }
}

async function getBaseDisks() {
  try {
    const lsblkOutput = await execPromise('lsblk -dn -o NAME');
    // Filter out empty lines and return the base disk names
    const names = lsblkOutput.split('\n').filter((name) => name.trim().length > 0);
    return names.map((record) => `/dev/${record}`);
  } catch (error) {
    console.error('Failed to fetch base disks:', error);
    return [];
  }
}
