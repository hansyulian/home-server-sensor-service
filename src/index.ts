// server.ts
import WebSocket, { WebSocketServer } from 'ws';
import { appConfig } from '~/config';
import { hddInfo, startDiskWatcher, stopDiskWatcher } from '~/modules/DiskWatcher';
import { pingInfo, startPingTargets, stopPingTargets } from '~/modules/PingWatcher';
import { startSystemStatusWatcher, stopSystemStatusWatcher, systemStatusInfo } from '~/modules/SystemStatusWatcher'

const wss = new WebSocketServer({ port: appConfig.port });

console.log(`WebSocket server is running on ws://localhost:${appConfig.port}`);

let broadcasterInterval: NodeJS.Timeout | undefined;

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected, total clients: ', wss.clients.size);
  startBroadcaster();

  ws.on('message', (message: string) => {
    console.log(`Received: ${message}`);

    // Broadcast the message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`Echo: ${message}`);
      }
    });
  });

  ws.on('close', () => {
    console.log('Client disconnected, total clients:', wss.clients.size);
    if (wss.clients.size === 0) {
      stopBroadcaster();
    }
  });
});

function startBroadcaster() {
  if (broadcasterInterval) {
    return;
  }
  console.log('starting broadcaster');
  startDiskWatcher();
  startPingTargets();
  startSystemStatusWatcher();
  broadcasterInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      client.send(JSON.stringify({
        hdd: hddInfo.states,
        ping: pingInfo.pings,
        systemStatus: systemStatusInfo
      }))
    })
  }, 1000);
}

function stopBroadcaster() {
  if (!broadcasterInterval) {
    return;
  }
  console.log('stopping broadcaster');
  clearInterval(broadcasterInterval);
  stopDiskWatcher();
  stopPingTargets();
  stopSystemStatusWatcher();
  broadcasterInterval = undefined;
}