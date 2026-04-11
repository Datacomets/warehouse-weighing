"use client";
import { useCallback, useRef, useState } from "react";

/**
 * Web Serial API hook for reading weight from digital scales.
 *
 * Supported protocols (auto-detect):
 * - Generic ASCII: lines like "ST,GS,  0.450 kg\r\n"
 * - A&D: "ST,+  0.4500  g\r\n"
 * - Ohaus: "   0.450 kg\r\n"
 * - Mettler Toledo: "S S     0.450 kg\r\n"
 *
 * Extracts the first numeric value from each line.
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

  /** Parse weight value from raw scale output */
  function parseWeight(raw: string): number | null {
    // Remove control characters and trim
    const cleaned = raw.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, "").trim();
    if (!cleaned) return null;

    // Extract number pattern: optional sign, digits, optional decimal
    const match = cleaned.match(/[+-]?\s*\d+\.?\d*/);
    if (!match) return null;

    const val = parseFloat(match[0].replace(/\s/g, ""));
    if (!Number.isFinite(val)) return null;
    if (val <= 0) return null; // skip zero/negative (scale not stable)

    return val;
  }

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
