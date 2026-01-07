import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
// next.config.ts에서 output: "export" 사용 중이므로, 이 라우트는 정적으로 고정되어야 빌드가 통과함
export const dynamic = 'force-static';
export const revalidate = false;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function OpenGraphImage(_req: NextRequest) {
  // 정적 export 빌드 단계에서만 프리렌더되므로, 프로젝트 루트의 파일을 직접 읽는다.
  const logoFilePath = path.join(process.cwd(), 'app', 'logo.png');
  const logoBuffer = await readFile(logoFilePath);
  const logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;

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


