import type { Request, Response, NextFunction } from "express";

export function requireApiToken(req: Request, res: Response, next: NextFunction) {
    const expected = process.env.BACKEND_BEARER_TOKEN
    if (!expected) return res.status(500).json({ detail: "Missing token" });
    const auth = req.header("authorization") || undefined
    if (auth !== `Bearer ${expected}`) {
        return res.status(401).json({ detail: "Unauthorized" });
    }
    next()
}
