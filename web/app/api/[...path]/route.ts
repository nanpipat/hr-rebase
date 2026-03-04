/**
 * Catch-all API proxy → BFF
 *
 * Next.js rewrites ใน next.config.js ถูก bake ตอน build time
 * แต่ Railway inject env vars ตอน runtime เท่านั้น
 * Route handler นี้แก้ปัญหาโดยอ่าน BFF_INTERNAL_URL ตอน request time
 */

import { NextRequest, NextResponse } from "next/server";

const BFF_URL = process.env.BFF_INTERNAL_URL ?? "http://localhost:8080";

async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname, search } = req.nextUrl;
  const target = `${BFF_URL}${pathname}${search}`;

  // Forward request headers (ยกเว้น host ที่ต้องชี้ไป BFF)
  const headers = new Headers(req.headers);
  headers.delete("host");

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      // @ts-ignore — Node.js fetch duplex
      duplex: "half",
    });

    // Forward response headers กลับ
    const resHeaders = new Headers(upstream.headers);
    resHeaders.delete("content-encoding"); // ป้องกัน double-decompress

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    console.error("[proxy] failed to reach BFF:", target, err);
    return NextResponse.json(
      { error: "BFF unreachable", target },
      { status: 502 }
    );
  }
}

export const GET     = proxy;
export const POST    = proxy;
export const PUT     = proxy;
export const PATCH   = proxy;
export const DELETE  = proxy;
export const OPTIONS = proxy;
