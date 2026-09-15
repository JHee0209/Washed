'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NotificationsPage() {
  // --- 상태 관리 ---
  const [filter, setFilter] = useState('전체');
  
  // 초기 읽음 상태 (목업 데이터 기준)
  const [readState, setReadState] = useState<Record<string, boolean>>({
    n3: true, n6: true, n7: true, n8: true, n9: true
  });
  
  const [liveNotices, setLiveNotices] = useState<any[]>([]);
  const [liveReports, setLiveReports] = useState<any[]>([]);
  const [now, setNow] = useState<number>(0);

  // --- 클라이언트 데이터 로드 ---
  useEffect(() => {
    setNow(Date.now());
    try {
      setLiveNotices(JSON.parse(localStorage.getItem('washed_notices') || '[]'));
      setLiveReports(JSON.parse(localStorage.getItem('washed_reports') || '[]'));
    } catch (e) {}
  }, []);

  // --- 알림 타입별 스타일 매핑 ---
  const TYPES: Record<string, { pillBg: string, pillFg: string, dot: string }> = {
    공지: { pillBg: '#EEF2F8', pillFg: '#5A7CA8', dot: '#B4C2D6' },
    배정: { pillBg: 'rgba(47,99,184,.1)', pillFg: '#2F63B8', dot: '#2F63B8' },
    종료: { pillBg: 'rgba(0,191,64,.1)', pillFg: '#006E25', dot: '#00BF40' },
    경고: { pillBg: 'rgba(255,146,0,.12)', pillFg: '#9C5800', dot: '#FF9200' },
    신고: { pillBg: '#F1EAFB', pillFg: '#6B3FA0', dot: '#9B6FD1' },
  };

  // --- 날짜 계산 로직 ---
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const midnightTs = midnight.getTime();

  // 1. 공지사항 데이터 가공
  const noticeNotifs = liveNotices.map((n, i) => {
    const parts = String(n.date || '').split('.').map((x) => parseInt(x, 10));
    let offset = 0;
    if (parts.length === 3 && !isNaN(parts[0])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      offset = Math.max(0, Math.round((midnightTs - d.getTime()) / 86400000));
    }
    return { id: `notice-${i}-${n.date}`, type: '공지', offset, time: n.time || '', title: n.title, body: n.body, ts: n.ts || 0 };
  });

  // 2. 신고 결과 데이터 가공
  const resultNotifs = liveReports.filter((r) => r.status && r.status !== '접수됨').map((r) => {
    const statusMsg = r.status === '처리완료' ? '처리가 완료됐어요.' : r.status === '반려' ? '사실이 아닌 것으로 확인되어 반려됐어요.' : '확인 중이에요.';
    return {
      id: `report-${r.id}`, type: '신고', offset: 0, time: r.datetime.split(' ')[1] || '',
      title: `신고 결과: ${r.reason}`,
      body: `접수하신 신고가 ${statusMsg}`,
    };
  });

  // 3. 고정 목업 데이터 + 동적 데이터 병합
  const allNotifs = [
    ...resultNotifs,
    ...noticeNotifs,
    { id: 'n1', type: '배정', offset: 0, time: '09:41', title: '세탁기 3호기에 배정됐어요', body: '10분 안에 QR 코드를 찍어주세요. 그렇지 않으면 다음 사람에게 넘어가요' },
    { id: 'n2', type: '종료', offset: 0, time: '09:05', title: '세탁기 3호기 사용이 끝났어요', body: '3분 안에 세탁물을 수거해주세요' },
    { id: 'n3', type: '공지', offset: 0, time: '08:20', title: '1층 세탁실 점검 안내', body: '9월 12일 오전 10시부터 2시간 동안 이용할 수 없어요' },
    { id: 'n4', type: '경고', offset: 1, time: '21:34', title: '경고가 1회 추가됐어요', body: '건조기 1호기 · "다했어요" 버튼을 누르지 않아 경고를 받았어요' },
    { id: 'n5', type: '종료', offset: 1, time: '21:04', title: '건조기 1호기 사용이 끝났어요', body: '3분 안에 세탁물을 수거해주세요' },
    { id: 'n6', type: '배정', offset: 1, time: '20:58', title: '건조기 2호기에 배정됐어요', body: '10분 안에 QR 코드를 찍어주세요. 그렇지 않으면 다음 사람에게 넘어가요' },
    { id: 'n7', type: '종료', offset: 5, time: '18:33', title: '건조기 2호기 사용이 끝났어요', body: '3분 안에 세탁물을 수거해주세요' },
    { id: 'n8', type: '경고', offset: 5, time: '18:02', title: '경고가 1회 추가됐어요', body: '건조기 2호기 · 배정 후 미이용' },
    { id: 'n9', type: '공지', offset: 12, time: '11:00', title: '이용 규칙이 업데이트됐어요', body: '경고 3회 시 3일 동안 줄서기가 제한됩니다' },
  ];

  const dateLabel = (offset: number) => {
    if (offset === 0) return '오늘';
    if (offset === 1) return '어제';
    const d = new Date(midnight);
    d.setDate(d.getDate() - offset);
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday})`;
  };

  // 공지는 90일, 나머지는 30일 보관
  const KEEP_DAYS = (type: string) => (type === '공지' ? 90 : 30);
  const notExpiredEarly = allNotifs.filter((n) => n.offset < KEEP_DAYS(n.type));

  const TABS = ['전체', '공지', '배정', '종료', '경고', '신고'];

  // 읽지 않은 알림 개수 계산 및 로컬스토리지 동기화
  const unreadCount = allNotifs.filter((n) => !readState[n.id]).length;
  useEffect(() => {
    try { localStorage.setItem('washed_unread', String(unreadCount)); } catch (e) {}
  }, [unreadCount, readState]);

  // 필터링 적용된 목록
  const visible = notExpiredEarly.filter((n) => filter === '전체' || n.type === filter);

  // 날짜별 그룹핑 로직
  const offsets: number[] = [];
  visible.forEach((n) => { if (!offsets.includes(n.offset)) offsets.push(n.offset); });
  offsets.sort((a, b) => a - b);

  const groups = offsets.map((offset) => ({
    date: dateLabel(offset),
    items: visible
      .filter((n) => n.offset === offset)
      .sort((a: any, b: any) => (b.ts || 0) - (a.ts || 0))
      .map((n) => {
        const t = TYPES[n.type] || TYPES['공지'];
        const isRead = !!readState[n.id];
        return {
          ...n,
          typeLabel: n.type,
          pillBg: t.pillBg,
          pillFg: t.pillFg,
          dotColor: isRead ? 'transparent' : t.dot,
          rowBg: isRead ? '#fff' : '#FBFDFF',
          titleColor: isRead ? '#5A6E8F' : '#1E3557',
          titleWeight: isRead ? '600' : '700',
          onClick: () => setReadState((s) => ({ ...s, [n.id]: true })),
        };
      }),
  }));

  const isEmpty = groups.length === 0;
  const emptyTitle = filter === '전체' ? '받은 알림이 없어요' : filter === '배정' ? '배정된 알림이 없어요' : filter === '신고' ? '신고에 대한 결과가 없어요' : `${filter} 알림이 없어요`;

  // 모두 읽음 핸들러
  const markAllRead = () => {
    const newRead = { ...readState };
    allNotifs.forEach((n) => { newRead[n.id] = true; });
    setReadState(newRead);
  };

  return (
    <>
      <style>{`
        body { margin: 0; -webkit-font-smoothing: antialiased; background: #EAEBEC; overflow: hidden; }
        html { overflow: hidden; }
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; box-sizing: border-box; }
        a { color: #2F63B8; text-decoration: none; }
        a:hover { color: #1F4E9C; }
        .no-scrollbar { scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .card { background: #fff; border-radius: 16px; border: 1px solid #E6EDF7; overflow: hidden; }
        .pill { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 700; flex-shrink: 0; }
      `}</style>

      <div style={{ width: '390px', height: '844px', margin: '40px auto', position: 'relative', display: 'flex', flexDirection: 'column', background: '#F3F6FB', color: '#1E3557', overflow: 'hidden', borderRadius: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
        
        {/* 헤더 바 */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '63px 20px 12px', background: '#fff', borderBottom: '1px solid #EAF0FA', width: '396px', height: '96px' }}>
          <Link href="/home" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', flexShrink: 0 }}>
            <svg width="11" height="18" viewBox="0 0 11 18" fill="none"><path d="M9.5 1.5 1.5 9l8 7.5" stroke="#1E3557" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </Link>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#1E3557', letterSpacing: '-0.3px' }}>알림</span>
        </div>

        {/* 탭 & 카운트 영역 */}
        <div style={{ flexShrink: 0, padding: '18px 16px 12px', background: '#F3F6FB' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#8FAAD0' }}>읽지 않은 알림 {unreadCount}개</span>
            <button onClick={markAllRead} style={{ border: 'none', cursor: unreadCount > 0 ? 'pointer' : 'default', background: unreadCount > 0 ? '#fff' : 'transparent', color: unreadCount > 0 ? '#2F63B8' : '#C3D2E6', boxShadow: unreadCount > 0 ? 'inset 0 0 0 1px #E6EDF7' : 'none', borderRadius: '999px', padding: '7px 13px', fontSize: '12px', fontWeight: 700 }}>
              모두 읽음
            </button>
          </div>

          <div className="no-scrollbar" style={{ marginTop: '14px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: '6px', width: 'max-content', paddingBottom: '2px' }}>
              {TABS.map((label) => {
                const on = filter === label;
                const count = label === '전체'
                  ? notExpiredEarly.filter((n) => !readState[n.id]).length
                  : notExpiredEarly.filter((n) => n.type === label && !readState[n.id]).length;
                
                const tabLabel = count > 0 ? `${label} ${count}` : label;
                return (
                  <div key={label} onClick={() => setFilter(label)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', background: on ? '#4C86D8' : '#fff', color: on ? '#fff' : '#5A7CA8', boxShadow: on ? 'none' : 'inset 0 0 0 1px #E6EDF7' }}>
                    {tabLabel}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 메인 알림 스크롤 리스트 */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ padding: '6px 16px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {isEmpty ? (
              <div style={{ padding: '70px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#E8EFF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1 1 12 0c0 4 1.4 5.4 1.4 5.4H4.6S6 13 6 9Z" stroke="#A8BCD9" strokeWidth="1.8" strokeLinejoin="round"></path><path d="M10 18a2 2 0 0 0 4 0" stroke="#A8BCD9" strokeWidth="1.8" strokeLinecap="round"></path></svg>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#5A7CA8' }}>{emptyTitle}</div>
                <div style={{ fontSize: '12.5px', color: '#A8BCD9' }}>새 알림이 오면 여기에 쌓여요</div>
              </div>
            ) : (
              groups.map((grp, gIdx) => (
                <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#5A7CA8', marginLeft: '2px' }}>{grp.date}</div>
                  <div className="card">
                    {grp.items.map((n, iIdx) => (
                      <div key={n.id} onClick={n.onClick} style={{ display: 'flex', gap: '11px', padding: '14px 15px', borderBottom: iIdx === grp.items.length - 1 ? 'none' : '1px solid #EDF2F9', cursor: 'pointer', background: n.rowBg }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: n.dotColor, marginTop: '7px', flexShrink: 0 }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span className="pill" style={{ background: n.pillBg, color: n.pillFg }}>{n.typeLabel}</span>
                            <span style={{ fontSize: '11px', color: '#A8BCD9', marginLeft: 'auto', flexShrink: 0 }}>{n.time}</span>
                          </div>
                          <span style={{ fontSize: '13.5px', fontWeight: n.titleWeight as any, color: n.titleColor, lineHeight: 1.4 }}>{n.title}</span>
                          <span style={{ fontSize: '12px', color: '#8FAAD0', lineHeight: 1.5 }}>{n.body}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

          </div>
        </div>

      </div>
    </>
  );
}