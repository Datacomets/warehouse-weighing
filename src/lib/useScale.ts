"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseWeight } from "./scaleParser";

/**
 * Web Serial API hook for reading weight from digital scales.
 *
 * Parser lives in `./scaleParser.ts` (see there for protocol details).
 *
 * First-time UX: user clicks "เชื่อมต่อ" → browser picker → permission granted.
 * Subsequent mounts (e.g. navigating between per-pcs/per-inner/per-carton)
 * auto-reconnect silently via `navigator.serial.getPorts()` — the browser
 * remembers the granted port for this origin.
 */

export type ScaleStatus = "disconnected" | "connecting" | "connected" | "reading" | "error";

interface UseScaleOptions {
  baudRate?: number;
  onReading?: (value: number, raw: string) => void;
}

const COMMON_BAUD_RATES = [9600, 19200, 38400, 115200, 4800, 2400];

export function useScale(options: UseScaleOptions = {}) {
  const { baudRate = 9600, onReading } = options;
  const [status, setStatus] = useState<ScaleStatus>("disconnected");
  const [lastValue, setLastValue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);

  const isSupported = typeof navigator !== "undefined" && "serial" in navigator;

  /**
   * On mount, try to silently reconnect to a previously-authorized port.
   * `navigator.serial.getPorts()` returns ports the user has granted
   * permission for on this origin — no picker dialog shown.
   *
   * This fires on every component mount (e.g. each weighing step page), so
   * the user only has to click "เชื่อมต่อ" once per browser session.
   */
  useEffect(() => {
    if (!isSupported) return;

    let cancelled = false;
    (async () => {
      try {
        const ports: any[] = await (navigator as any).serial.getPorts();
        if (cancelled || ports.length === 0) return;

        const port = ports[0];
        if (!port.readable && !port.writable) {
          // Port is closed — open it. If already open (e.g. another mount
          // of the same hook kept it alive), just use it as-is.
          setStatus("connecting");
          await port.open({ baudRate });
        }
        if (cancelled) return;
        portRef.current = port;
        setStatus("connected");
      } catch {
        // Silent fail — user can still click "เชื่อมต่อ" manually
        if (!cancelled) setStatus("disconnected");
      }
    })();

    return () => {
      cancelled = true;
    };
    // baudRate intentionally excluded — changing it shouldn't force a reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  /** Connect to scale and start reading */
  const connect = useCallback(async () => {
    if (!isSupported) {
      setError("เบราว์เซอร์ไม่รองรับ Web Serial API — ใช้ Chrome หรือ Edge");
      setStatus("error");
      return;
    }

    try {
      setStatus("connecting");
      setError(null);

      // Prompt user to select serial port
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });

      portRef.current = port;
      setStatus("connected");
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        // User cancelled port selection
        setStatus("disconnected");
        return;
      }
      setError(`เชื่อมต่อไม่ได้: ${err.message}`);
      setStatus("error");
    }
  }, [baudRate, isSupported]);

  /** Read a single stable value from the scale */
  const readOnce = useCallback(async (): Promise<number | null> => {
    const port = portRef.current;
    if (!port || !port.readable) {
      setError("ยังไม่ได้เชื่อมต่อเครื่องชั่ง");
      return null;
    }

    try {
      setStatus("reading");
      const decoder = new TextDecoderStream();
      const readableStreamClosed = port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      let buffer = "";
      const timeout = 5000; // 5 seconds
      const start = Date.now();

      while (Date.now() - start < timeout) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;

        // Look for complete lines
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const weight = parseWeight(line);
          if (weight !== null) {
            // Got a valid reading
            setLastValue(weight);
            setStatus("connected");
            onReading?.(weight, line);

            // Cleanup
            reader.releaseLock();
            return weight;
          }
        }
      }

      // Timeout — no valid reading
      reader.releaseLock();
      setError("ไม่ได้รับค่าจากเครื่องชั่ง — ตรวจสอบการเชื่อมต่อ");
      setStatus("connected");
      return null;
    } catch (err: any) {
      setError(`อ่านค่าไม่ได้: ${err.message}`);
      setStatus("error");
      return null;
    }
  }, [onReading]);

  /** Send command to scale (e.g., request weight) */
  const sendCommand = useCallback(async (cmd: string) => {
    const port = portRef.current;
    if (!port || !port.writable) return;

    const encoder = new TextEncoder();
    const writer = port.writable.getWriter();
    await writer.write(encoder.encode(cmd + "\r\n"));
    writer.releaseLock();
  }, []);

  /** Disconnect from scale */
  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch {
      // ignore close errors
    }
    setStatus("disconnected");
    setLastValue(null);
  }, []);

  return {
    isSupported,
    status,
    lastValue,
    error,
    connect,
    readOnce,
    sendCommand,
    disconnect,
  };
}
