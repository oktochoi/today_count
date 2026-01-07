import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString('base64');
}

export default async function OpenGraphImage(_req: NextRequest) {
  const logoBuffer = await fetch(new URL('./logo.png', import.meta.url)).then(res => res.arrayBuffer());
  const logoDataUrl = `data:image/png;base64,${arrayBufferToBase64(logoBuffer)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0b0b10, #190a2d, #071a2b)',
          color: 'white',
          padding: 64,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoDataUrl}
            width={160}
            height={160}
            style={{ borderRadius: 32 }}
            alt="logo"
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: -1 }}>
              오늘의 나 순위
            </div>
            <div style={{ fontSize: 30, opacity: 0.9, marginTop: 10 }}>
              전국 5,184만명 중 내 순위는?
            </div>
          </div>
        </div>

        <div style={{ marginTop: 40, fontSize: 26, opacity: 0.85 }}>
          매일 자정 리셋 · 하루 1회 측정
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}


