'use client';

// F8 — 실제 카메라 QR 스캐너 (05 P3 · P4 · R8 · 08 · 6번 · Issue #6).
//
// 예전 홈 화면(page.tsx)의 "QR 스캔" 모달은 카메라 없이 CSS 애니메이션만 그리는
// 연출이었다. 이 컴포넌트가 그 자리를 대신한다:
//   후면 카메라 요청 → 일정 간격으로 <video> 프레임을 <canvas> 로 옮겨 jsQR 로
//   디코딩 → 성공하면 즉시 추가 디코딩을 멈추고(6번 「중복 인증 방지」) 서버에
//   검증 요청 → 서버 판정(성공/실패)을 그대로 화면에 반영한다. 클라이언트는
//   스스로 성공을 판단하지 않는다(10번 요구사항 — 최종 판정은 서버).
//
// 카메라 스트림은 닫기(×) · 인증 성공 · 언마운트 어느 경로로든 반드시 정리한다
// (stopCamera() 를 그 세 경로 전부에서 부른다).

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

export type QrVerifiedResult = {
  machineId: string;
  machineName: string | null;
  machineKind: 'washer' | 'dryer';
  endsAt: string;
  serverNow: string;
};

// 'denied' · 'no-camera' 는 카메라 자체를 못 얻은 상태 — 「다시 시도」가 카메라
// 요청부터 다시 한다. 'error' 는 카메라는 켜져 있는데 인식·인증이 실패한 상태 —
// 「다시 시도」가 스트림은 그대로 두고 디코딩만 다시 켠다.
type Phase = 'starting' | 'scanning' | 'verifying' | 'denied' | 'no-camera' | 'error';

type Props = {
  onClose: () => void;
  onVerified: (result: QrVerifiedResult) => void;
};

const SCAN_INTERVAL_MS = 150; // 초당 약 6~7 프레임 — QR 디코딩에는 충분하다

export default function QrScanner({ onClose, onVerified }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  // 인식 성공 후 추가 decode 를 멈추는 플래그 (6번 「중복 인증 방지」)
  const decodedRef = useRef(false);
  const verifyingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('starting');
  const [errorMessage, setErrorMessage] = useState('');

  // page.tsx는 1초마다 다시 렌더링되므로(카운트다운) onVerified가 매번 새 함수로
  // 내려올 수 있다 — ref로 최신 값만 참조해 아래 콜백들의 안정적인 클로저가 오래된
  // onVerified를 붙잡지 않게 한다. 렌더 중에는 ref를 쓰지 않고 effect에서 맞춘다.
  const onVerifiedRef = useRef(onVerified);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
  });

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const verify = useCallback(async (payload: string) => {
    if (verifyingRef.current) return; // API 요청 중 중복 요청 방지
    verifyingRef.current = true;
    setPhase('verifying');
    try {
      const res = await fetch('/api/queue/verify-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!mountedRef.current) return;
      if (!res.ok || !data.ok) {
        verifyingRef.current = false;
        decodedRef.current = false; // 다시 스캔할 수 있게 한다
        setErrorMessage(data.message || 'QR 인증에 실패했어요.');
        setPhase('error');
        return;
      }
      stopCamera();
      onVerifiedRef.current({
        machineId: data.machineId,
        machineName: data.machineName ?? null,
        machineKind: data.machineKind,
        endsAt: data.endsAt,
        serverNow: data.serverNow,
      });
    } catch {
      if (!mountedRef.current) return;
      verifyingRef.current = false;
      decodedRef.current = false;
      setErrorMessage('네트워크 오류로 인증에 실패했어요.');
      setPhase('error');
    }
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('no-camera');
      return;
    }
    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      decodedRef.current = false;
      setPhase('scanning');
    } catch (err) {
      if (!mountedRef.current) return;
      const name = (err as { name?: string } | null)?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        setPhase('denied');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
        setPhase('no-camera');
      } else {
        setErrorMessage('카메라를 시작하지 못했어요.');
        setPhase('error');
      }
    }
  }, []);

  // 마운트 시 카메라를 요청한다. 닫기 · 성공 · 언마운트 어느 경로로든
  // stopCamera() 가 정리한다.
  useEffect(() => {
    mountedRef.current = true;
    // home/page.tsx의 마운트 효과(loadMachines · loadMine)와 같은 자리 — 마운트 시
    // 외부 자원(카메라)을 요청하는 비동기 초기화는 구조적으로 setState를 동반한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // phase 가 'scanning' 인 동안만 일정 간격으로 프레임을 디코딩한다. setInterval 이
  // 반복을 맡으므로 rAF 자기 참조 루프가 필요 없다.
  useEffect(() => {
    if (phase !== 'scanning') return;
    const id = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || decodedRef.current) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA || video.videoWidth === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(frame.data, frame.width, frame.height);
      if (code?.data && !decodedRef.current) {
        decodedRef.current = true;
        void verify(code.data);
      }
    }, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase, verify]);

  const retry = () => {
    if (phase === 'denied' || phase === 'no-camera') {
      void startCamera();
      return;
    }
    // 'error' — 카메라는 이미 켜져 있으니 디코딩만 다시 켠다.
    decodedRef.current = false;
    verifyingRef.current = false;
    setErrorMessage('');
    setPhase('scanning');
  };

  const showVideo = phase === 'scanning' || phase === 'verifying';

  return (
    <div style={{ width: '100%', maxWidth: '300px', background: '#17233C', borderRadius: '20px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0px 20px 44px -12px rgba(8,20,46,.75)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', fontWeight: 800, color: '#EEF4FD' }}>QR 스캔</span>
        <div onClick={onClose} style={{ cursor: 'pointer', color: 'rgba(224,235,250,.62)', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>×</div>
      </div>

      <div style={{ position: 'relative', aspectRatio: 1, borderRadius: '18px', overflow: 'hidden', background: '#0D1728' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: showVideo ? 'block' : 'none' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {showVideo && (
          <>
            <div style={{ position: 'absolute', left: '12%', top: '12%', width: '20px', height: '20px', borderLeft: '3px solid #5B93E0', borderTop: '3px solid #5B93E0', borderRadius: '4px 0 0 0' }}></div>
            <div style={{ position: 'absolute', right: '12%', top: '12%', width: '20px', height: '20px', borderRight: '3px solid #5B93E0', borderTop: '3px solid #5B93E0', borderRadius: '0 4px 0 0' }}></div>
            <div style={{ position: 'absolute', left: '12%', bottom: '12%', width: '20px', height: '20px', borderLeft: '3px solid #5B93E0', borderBottom: '3px solid #5B93E0', borderRadius: '0 0 0 4px' }}></div>
            <div style={{ position: 'absolute', right: '12%', bottom: '12%', width: '20px', height: '20px', borderRight: '3px solid #5B93E0', borderBottom: '3px solid #5B93E0', borderRadius: '0 0 4px 0' }}></div>
          </>
        )}

        {phase === 'starting' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(224,235,250,.8)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
            카메라를 켜는 중이에요…
          </div>
        )}
        {phase === 'verifying' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,28,58,.6)', color: '#EEF4FD', fontSize: '12px', fontWeight: 700 }}>
            인증하는 중이에요…
          </div>
        )}
        {phase === 'denied' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(224,235,250,.85)', fontSize: '12px', textAlign: 'center', padding: '20px', lineHeight: 1.6 }}>
            카메라 권한이 필요해요.<br />브라우저 설정에서 카메라 접근을 허용해주세요.
          </div>
        )}
        {phase === 'no-camera' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(224,235,250,.85)', fontSize: '12px', textAlign: 'center', padding: '20px', lineHeight: 1.6 }}>
            이 기기에서 카메라를 찾지 못했어요.
          </div>
        )}
        {phase === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FCA5A5', fontSize: '12px', textAlign: 'center', padding: '20px', lineHeight: 1.6 }}>
            {errorMessage}
          </div>
        )}
      </div>

      <span style={{ fontSize: '11px', color: 'rgba(224,235,250,.62)', lineHeight: 1.5, textAlign: 'center' }}>
        {phase === 'error'
          ? 'QR이 찢어졌거나 오염됐다면 설정 > 신고하기에서 "기기가 고장났어요"로 접수해주세요.'
          : 'QR 코드를 사각형 안에 맞춰주세요.'}
      </span>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onClose}
          style={{ flex: 1, border: 'none', cursor: 'pointer', color: '#EEF4FD', background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(224,235,250,.26)', borderRadius: '12px', padding: '10px', fontSize: '13px', fontWeight: 700 }}
        >
          취소
        </button>
        {(phase === 'error' || phase === 'denied' || phase === 'no-camera') && (
          <button
            onClick={retry}
            style={{ flex: 1, border: 'none', cursor: 'pointer', color: '#fff', background: '#4C86D8', borderRadius: '12px', padding: '11px', fontSize: '13px', fontWeight: 700 }}
          >
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
}
