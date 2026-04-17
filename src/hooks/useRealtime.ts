"use client";

import { useEffect } from "react";
import { getPusherClient } from "@/lib/pusher";

export function useRealtime<T>({
  channelName,
  eventName,
  onEvent,
}: {
  channelName: string;
  eventName: string;
  onEvent: (payload: T) => void;
}) {
  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(channelName);
    channel.bind(eventName, onEvent);

    return () => {
      channel.unbind(eventName, onEvent);
      pusher.unsubscribe(channelName);
    };
  }, [channelName, eventName, onEvent]);
}
