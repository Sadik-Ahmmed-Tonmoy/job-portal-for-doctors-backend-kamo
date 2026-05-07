import { Response } from "express";

export const sseConnections: Record<string, Response[]> = {};