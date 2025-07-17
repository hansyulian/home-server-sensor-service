import { execPromise } from "~/utils/execPromise";
import os from 'os';
import si from 'systeminformation';

let lastCpuTimes = {
  total: 0,
  idle: 0,
};

export const systemStatusInfo = {
  cpu: {
    total: 0,
    idle: 0,
  },
  memory: {
    total: 0,
    free: 0,
    used: 0,
  },
  network: {
    iface: '',
    upload: 0,
    download: 0
  }
}

let systemStatusWatcherInterval: NodeJS.Timeout | undefined;

export function startSystemStatusWatcher() {
  if (systemStatusWatcherInterval) {
    return;
  }
  console.log('starting system status watcher');
  reloadReadings();
  systemStatusWatcherInterval = setInterval(reloadReadings, 1000);
}


export function stopSystemStatusWatcher() {
  if (!systemStatusWatcherInterval) {
    return false;
  }
  console.log('stopping system status watcher');
  clearInterval(systemStatusWatcherInterval);
  systemStatusWatcherInterval = undefined;
  return true;
}

async function reloadReadings() {

  const systemStat = await readSystemStat();
  if (systemStat) {
    systemStatusInfo.cpu.total = systemStat.cpu.usage;
    systemStatusInfo.cpu.idle = systemStat.cpu.temperature;
    systemStatusInfo.memory.total = systemStat.memory.total;
    systemStatusInfo.memory.free = systemStat.memory.free;
    systemStatusInfo.memory.used = systemStat.memory.total - systemStat.memory.free;
    systemStatusInfo.network.iface = systemStat.network.iface;
    systemStatusInfo.network.upload = systemStat.network.upload;
    systemStatusInfo.network.download = systemStat.network.download;
  }
}

async function readSystemStat() {
  try {
    const result = await execPromise('sensors');
    const match = result.match(/Package id 0:\s*\+([0-9.]+)°C/);
    if (!match) {
      return undefined;
    }
    const cpuTemperature = parseFloat(match[1]);
    const cpuUsage = calculateCpuUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const networkStats = await si.networkStats();
    const firstNetworkStat = networkStats[0];

    return {
      cpu: {
        usage: cpuUsage,
        temperature: cpuTemperature,
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
      },
      network: {
        iface: firstNetworkStat.iface,
        upload: firstNetworkStat.tx_sec,
        download: firstNetworkStat.rx_sec,
      },
    };
  } catch (err) {
    return undefined;
  }
}


function getCurrentCpuTimes() {
  const currentCpuState = os.cpus();

  const totalTimes = currentCpuState.reduce(
    (acc, cpu) => {
      const { user, nice, sys, idle, irq } = cpu.times;
      acc.total += user + nice + sys + idle + irq;
      acc.idle += idle;
      return acc;
    },
    { total: 0, idle: 0 },
  );
  return totalTimes;
}


function calculateCpuUsage() {
  const currentCpuTimes = getCurrentCpuTimes();
  const totalDiff = currentCpuTimes.total - lastCpuTimes.total;
  const idleDiff = currentCpuTimes.idle - lastCpuTimes.idle;
  lastCpuTimes = currentCpuTimes;
  const cpuUsage = 100 * (1 - idleDiff / totalDiff);
  return cpuUsage;
}
