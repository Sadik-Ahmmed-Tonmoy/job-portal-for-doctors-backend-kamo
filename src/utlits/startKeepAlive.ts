import WebSocket from "ws";

const startKeepAlive = (ws: WebSocket): NodeJS.Timeout => {
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(interval);
    }
  }, 40000); // every 40 seconds

  return interval;
};

export default startKeepAlive;
