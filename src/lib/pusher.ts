import Pusher from "pusher";
import PusherClient from "pusher-js";

export function getPusherServer() {
  if (!process.env.PUSHER_APP_ID || !process.env.PUSHER_KEY || !process.env.PUSHER_SECRET) {
    return null;
  }

  return new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER ?? "mt1",
    useTLS: true,
  });
}

export function getPusherClient() {
  if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
    return null;
  }

  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "mt1",
  });
}

export async function triggerPusherEvent(channel: string, event: string, payload: unknown) {
  const server = getPusherServer();
  if (!server) return;
  await server.trigger(channel, event, payload);
}
