
import { ConnectionCheckOutStartedEvent } from "mongodb";
import config from "../config";
import { jwtHelpers } from "../helpers/jwtHelpers";

import { ExtendedWebSocket, MessageTypes } from "./socket.helpers";

export async function validateToken(ws: ExtendedWebSocket, token: string): Promise<boolean | any> {
  if (!token) {
    ws.send(
      JSON.stringify({
        type: MessageTypes.AUTH_FAILURE,
        message: "Authentication token is required.",
      })
    );
    ws.close(4000, "Authentication token is required.");
    return false;
  }

  try {
    const decodedToken = jwtHelpers.verifyToken(
      token,
      config.jwt.jwt_secret as string
    );
    // console.log(decodedToken,"check decoded token")
    ws.userId = decodedToken.id;


    ws.send(
      JSON.stringify({
        type: MessageTypes.AUTH_SUCCESS,
        message: "Token validated successfully.",
        userId: decodedToken.id,
      })
    );

    return decodedToken;
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: MessageTypes.AUTH_FAILURE,
        message: "Invalid or expired token.",
      })
    );
    ws.close(4000, "Invalid or expired token.");
    return false;
  }
}
