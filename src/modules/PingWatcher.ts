import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { appConfig } from '~/config';

interface PingOptions {
  maxPings: number;
}

type PingBuffer = {
  target: string;
  lastValue: number | undefined;
};
export const pingInfo: { pings: PingBuffer[] } = {
  pings: [],
}

let isPingEnabled = false;

export function stopPingTargets() {
  isPingEnabled = false;
  console.log('stopping ping targets');
}

export function startPingTargets() {
  if (isPingEnabled) {
    return;
  }
  const targets = appConfig.pingTargets;
  console.log('starting ping targets');
  isPingEnabled = true;
  pingInfo.pings = [];
  for (const target of targets) {
    const pingBuffer = {
      target: target,
      lastValue: 0,
    };
    pingInfo.pings.push(pingBuffer);
    startPing(target, pingBuffer);
  }
}

async function startPing(target: string, pingBuffer: PingBuffer) {
  while (isPingEnabled) {
    await ping(
      target,
      (value) => {
        pingBuffer.lastValue = value;
      },
      {
        maxPings: 100000,
      },
    );
  }
}

async function ping(
  pingTarget: string,
  onData: (value: number | undefined) => void,
  options: PingOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pingProcess: ChildProcessWithoutNullStreams = spawn('ping', [pingTarget]);
    let pingCount = 0;
    let lastIcmpSequence = 0;
    const maxPings = options.maxPings;

    pingProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      const lines = output.split('\n');

      lines.forEach((line) => {
        // Handle the ICMP sequence and RTT (time)
        const icmpSequence = extractIcmpSequence(line);
        const rtt = extractRtt(line);

        if (icmpSequence !== null) {
          // Handle skipped ICMP sequence numbers
          handleSkippedSequence(lastIcmpSequence, icmpSequence, onData);
          lastIcmpSequence = icmpSequence;
        }

        if (rtt !== null) {
          // If RTT is available, pass it to onData
          onData(rtt);
        }

        pingCount++;
        if (maxPings && pingCount >= maxPings) {
          pingProcess.kill(); // Terminate the ping process after reaching maxPings
        }
      });
    });

    pingProcess.stderr.on('data', (data: Buffer) => {
      console.error(`Error: ${data.toString()}`);
    });

    pingProcess.on('close', (code) => {
      if (pingCount < maxPings) {
        console.log('Ping process was terminated before reaching maxPings.');
      }
      console.log(`Ping process exited with code ${code}`);
      resolve();
    });

    pingProcess.on('error', (err) => {
      console.error('Failed to start ping process:', err);
      reject(err); // Reject the promise in case of error
    });
  });
}

// Helper to extract the icmp_seq from a line
function extractIcmpSequence(line: string): number | null {
  const icmpMatch = line.match(/icmp_seq=(\d+)/);
  return icmpMatch ? parseInt(icmpMatch[1], 10) : null;
}

// Helper to extract the RTT time from a line
function extractRtt(line: string): number | null {
  const pingMatch = line.match(/time=(\d+(\.\d+)?) ms/);
  return pingMatch ? parseFloat(pingMatch[1]) : null;
}

// Helper to handle skipped sequence numbers
function handleSkippedSequence(
  lastIcmpSequence: number,
  currentIcmpSequence: number,
  onData: (value: number | undefined) => void,
): void {
  // Check if there is a gap between sequence numbers
  for (let i = lastIcmpSequence + 1; i < currentIcmpSequence; i++) {
    onData(undefined); // Indicate that the ping was skipped
  }
}
