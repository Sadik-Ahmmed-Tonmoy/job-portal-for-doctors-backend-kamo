import { Server } from "http";
import app from "./app";
import config from "./config";
import socketConnect from "./socket";
import { cleanQueues } from "./helpers/redis";

let server: Server;

async function main() {
  cleanQueues();
  server = app.listen(config.port, () => {
    console.log("Sever is running on port ", config.port);
  });
  socketConnect(server);

  const exitHandler = () => {
    if (server) {
      server.close(() => {
        console.info("Server closed!");
      });
    }
    process.exit(1);
  };
  process.on("uncaughtException", (error) => {
    console.log(error);
    exitHandler();
  });

  process.on("unhandledRejection", (error) => {
    console.log(error);
    exitHandler();
  });
}

main();
