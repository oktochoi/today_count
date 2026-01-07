'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function Home() {
  const [userId, setUserId] = useState<string>('');
  const [todayRank, setTodayRank] = useState<number>(0);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [yesterdayRank, setYesterdayRank] = useState<number>(0);
  const [rankChange, setRankChange] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [canReroll, setCanReroll] = useState<boolean>(true);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [displayRank, setDisplayRank] = useState<number>(0);
  const [displayTotal, setDisplayTotal] = useState<number>(0);
  const [rankHistory, setRankHistory] = useState<Array<{ at: string; rank: number }>>([]);
  const [hasMeasured, setHasMeasured] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<string>(() => {
    try {
      return new Date().toISOString().split('T')[0];
    } catch {
      return getTodayDate();
    }
  });

  const seededRandom = (seed: string): number => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const x = Math.sin(Math.abs(hash)) * 10000;
    return x - Math.floor(x);
  };

  const generateRankData = (userId: string, date: string, salt: string = '') => {
    const seed = userId + date + salt;
    const random1 = seededRandom(seed);
    const random2 = seededRandom(seed + 'total');
    const random3 = seededRandom(seed + 'rank');

    // 총 인원 고정: 5,184만명 (= 51,840,000명)
    const total = 51_840_000;

    // 순위는 측정(버튼 클릭) 시점에만 결정되며, 같은 salt면 동일하게 재현됨
    const minRank = Math.floor(total * 0.05);
    const maxRank = Math.floor(total * 0.90);
    const rank = Math.floor(minRank + random3 * (maxRank - minRank));

    return { rank, total };
  };

  const formatTotalUsers = (total: number) => {
    // 51,840,000 -> 5,184만 형태로 표기
    if (total >= 10_000) {
      const man = Math.floor(total / 10_000);
      return `${man.toLocaleString()}만`;
    }
    return total.toLocaleString();
  };

  const resetDailyState = (uid: string) => {
    try {
      localStorage.removeItem('lastReroll');
      localStorage.removeItem('rerollSalt');
    } catch {
      // ignore
    }
    setHasMeasured(false);
    setCanReroll(true);
    setTodayRank(0);
    setYesterdayRank(0);
    setRankChange(0);
    setPercentage(0);
    setDisplayRank(0);
    setDisplayTotal(51_840_000);
  };

  const handleShare = async () => {
    try {
      const title = '오늘의 나 순위';
      const text = hasMeasured
        ? `오늘의 나 순위: ${todayRank.toLocaleString()}위 (상위 ${percentage.toFixed(2)}%)`
        : '오늘의 나 순위를 확인해보세요';
      const url = typeof window !== 'undefined' ? window.location.href : '';
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else if (navigator.clipboard && url) {
        await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
        // 간단 안내
        alert('링크를 클립보드에 복사했어요.');
      }
    } catch {
      // 사용자 취소 등은 무시
    }
  };

  const getTodayDate = (): string => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getYesterdayDate = (): string => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  const initializeUser = () => {
    let storedUserId = localStorage.getItem('userId');
    if (!storedUserId) {
      storedUserId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('userId', storedUserId);
    }
    return storedUserId;
  };

  const updateStreak = () => {
    const today = getTodayDate();
    const lastVisit = localStorage.getItem('lastVisit');
    let currentStreak = parseInt(localStorage.getItem('streak') || '0');

    if (lastVisit) {
      const lastDate = new Date(lastVisit);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak += 1;
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    } else {
      currentStreak = 1;
    }

    localStorage.setItem('lastVisit', today);
    localStorage.setItem('streak', currentStreak.toString());
    return currentStreak;
  };

  const checkRerollAvailability = (): boolean => {
    const today = getTodayDate();
    const lastReroll = localStorage.getItem('lastReroll');
    return lastReroll !== today;
  };

  const getOrInitHistoryStartDate = (uid: string) => {
    const key = `rankHistoryStart:${uid}`;
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const today = getTodayDate();
    try {
      localStorage.setItem(key, today);
    } catch {
      // ignore
    }
    return today;
  };

  const loadRankHistory = (uid: string, startDate: string) => {
    const key = `rankHistory:${uid}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      // 과거 버전({ date, rank })도 지원
      const parsed = JSON.parse(raw) as Array<{ at?: unknown; date?: unknown; rank?: unknown }>;
      if (!Array.isArray(parsed)) return [];
      const filtered = parsed
        .map(item => {
          const rank = typeof item?.rank === 'number' ? item.rank : Number(item?.rank);
          const at =
            typeof item?.at === 'string'
              ? item.at
              : typeof item?.date === 'string'
                ? item.date
                : null;
          if (!at || !Number.isFinite(rank)) return null;
          return { at, rank };
        })
        .filter((x): x is { at: string; rank: number } => x !== null);
      
      // 시작일 이전 기록은 제거 (오늘 시작했으면 오늘부터만 보이게)
      const start = typeof startDate === 'string' ? startDate : getTodayDate();
      const result = filtered.filter(item => {
        const d = item.at.slice(0, 10); // YYYY-MM-DD
        return d >= start;
      });

      // 로컬스토리지도 정리해서 다음 로드부터 깔끔하게
      if (result.length !== filtered.length) {
        saveRankHistory(uid, result);
      }
      return result;
    } catch {
      return [];
    }
  };

  const saveRankHistory = (uid: string, history: Array<{ at: string; rank: number }>) => {
    const key = `rankHistory:${uid}`;
    try {
      localStorage.setItem(key, JSON.stringify(history));
    } catch {
      // ignore
    }
  };

  const handleReroll = () => {
    if (!canReroll) return;

    const today = getTodayDate();
    // 시작일이 없으면 오늘로 초기화
    getOrInitHistoryStartDate(userId);
    const salt = Math.random().toString(36).substr(2, 9);
    localStorage.setItem('rerollSalt', salt);
    localStorage.setItem('lastReroll', today);

    const { rank, total } = generateRankData(userId, today, salt);
    const yesterday = getYesterdayDate();
    const { rank: yRank } = generateRankData(userId, yesterday, '');

    setTodayRank(rank);
    setTotalUsers(total);
    setYesterdayRank(yRank);
    setRankChange(yRank - rank);
    setPercentage((rank / total) * 100);
    setCanReroll(false);
    setIsAnimating(true);
    setHasMeasured(true);
    animateNumbers(rank, total);

    // 버튼을 누를 때마다 기록 1개 추가
    setRankHistory(prev => {
      const next = [...prev, { at: new Date().toISOString(), rank }];
      saveRankHistory(userId, next);
      return next;
    });
  };

  const animateNumbers = (targetRank: number, targetTotal: number) => {
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setDisplayRank(Math.floor(targetRank * easeProgress));
      setDisplayTotal(Math.floor(targetTotal * easeProgress));

      if (currentStep >= steps) {
        clearInterval(interval);
        setDisplayRank(targetRank);
        setDisplayTotal(targetTotal);
        setIsAnimating(false);
      }
    }, stepDuration);
  };

  useEffect(() => {
    const uid = initializeUser();
    setUserId(uid);

    const today = getTodayDate();
    const yesterday = getYesterdayDate();
    const salt = localStorage.getItem('rerollSalt') || '';

    // 총 인원은 항상 고정 표시 (순위는 '측정' 전엔 표시하지 않음)
    setTotalUsers(51_840_000);
    setDisplayTotal(51_840_000);

    // 규칙 적용 초기화(최초 1회): 이전 일일 상태 제거
    if (!localStorage.getItem('init_v2')) {
      try {
        localStorage.removeItem('lastReroll');
        localStorage.removeItem('rerollSalt');
        localStorage.setItem('init_v2', '1');
      } catch {
        // ignore
      }
    }

    // 오늘 이미 측정했으면 그 값만 복구해서 보여주기
    const lastReroll = localStorage.getItem('lastReroll');
    if (lastReroll === today) {
      const { rank, total } = generateRankData(uid, today, salt);
      const { rank: yRank } = generateRankData(uid, yesterday, '');
      setTodayRank(rank);
      setYesterdayRank(yRank);
      setRankChange(yRank - rank);
      setPercentage((rank / total) * 100);
      setHasMeasured(true);
      animateNumbers(rank, total);
    } else {
      // 측정 전 상태
      setTodayRank(0);
      setYesterdayRank(0);
      setRankChange(0);
      setPercentage(0);
      setDisplayRank(0);
      setHasMeasured(false);
    }

    const currentStreak = updateStreak();
    setStreak(currentStreak);

    setCanReroll(checkRerollAvailability());
    
    // 순위 추이는 "버튼을 눌러 기록한 것"만 누적 (처음엔 비어있음)
    const startDate = getOrInitHistoryStartDate(uid);
    setRankHistory(loadRankHistory(uid, startDate));
  }, []);

  // 자정 감지: 날짜 변경 시 일일 상태 리셋
  useEffect(() => {
    const timer = setInterval(() => {
      const today = getTodayDate();
      if (today !== currentDate) {
        setCurrentDate(today);
        resetDailyState(userId);
      }
    }, 30000); // 30초마다 체크
    return () => clearInterval(timer);
  }, [currentDate, userId]);
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-blue-900/20"></div>
      
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 bg-pink-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-40 h-40 bg-blue-500 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-20 left-1/4 w-36 h-36 bg-purple-500 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-40 right-1/3 w-44 h-44 bg-yellow-500 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 blur-xl opacity-50 animate-pulse"></div>
            <h1 className="relative text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 tracking-wider" style={{textShadow: '0 0 30px rgba(236, 72, 153, 0.5)'}}>
              오늘의 나 순위
            </h1>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl shadow-2xl p-8 mb-6 border-4 border-purple-500/30 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
          
          <div className="text-center mb-8 relative z-10">
            <div className="text-pink-400 text-xl mb-4 font-bold tracking-wide">🇰🇷 전국</div>
            <div className="text-5xl font-black text-white mb-2 drop-shadow-lg">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                {formatTotalUsers(displayTotal)}
              </span>
              <span className="text-gray-300">명 중</span>
            </div>
            <div className="relative inline-block my-6">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 blur-2xl opacity-50 animate-pulse"></div>
              {hasMeasured ? (
                <div className="relative text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400" style={{textShadow: '0 0 40px rgba(168, 85, 247, 0.8)'}}>
                  {displayRank.toLocaleString()}위
                </div>
              ) : (
                <div className="relative text-3xl md:text-4xl font-black text-gray-200/80 px-6 py-4 rounded-2xl border border-purple-500/30 bg-black/30">
                  아직 측정 전 · 아래에서 <span className="text-purple-300">재측정</span>을 눌러주세요
                </div>
              )}
            </div>
            {hasMeasured && (
              <div className="text-3xl font-bold text-cyan-400 drop-shadow-lg">
                상위 {percentage.toFixed(2)}%
              </div>
            )}
          </div>

          <div className="flex justify-center mb-6">
            {!hasMeasured ? (
              <div className="flex items-center bg-gray-500/20 border-2 border-gray-400 rounded-full px-6 py-3 text-gray-300 text-xl font-black">
                <i className="ri-subtract-line text-3xl mr-2"></i>
                아직 변동 없음 (측정 전)
              </div>
            ) : rankChange > 0 ? (
              <div className="flex items-center bg-green-500/20 border-2 border-green-400 rounded-full px-6 py-3 text-green-400 text-xl font-black">
                <i className="ri-arrow-up-line text-3xl mr-2"></i>
                {Math.abs(rankChange).toLocaleString()}위 상승 🚀
              </div>
            ) : rankChange < 0 ? (
              <div className="flex items-center bg-red-500/20 border-2 border-red-400 rounded-full px-6 py-3 text-red-400 text-xl font-black">
                <i className="ri-arrow-down-line text-3xl mr-2"></i>
                {Math.abs(rankChange).toLocaleString()}위 하락 📉
              </div>
            ) : (
              <div className="flex items-center bg-gray-500/20 border-2 border-gray-400 rounded-full px-6 py-3 text-gray-400 text-xl font-black">
                <i className="ri-subtract-line text-3xl mr-2"></i>
                변동 없음 ➖
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-2xl p-6 mb-6 border-2 border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-purple-300 font-bold mb-2 text-lg">📅 어제의 나</div>
                <div className="text-4xl font-black text-white drop-shadow-lg">
                  {hasMeasured ? `${yesterdayRank.toLocaleString()}위` : '—'}
                </div>
              </div>
              <div className="w-20 h-20 flex items-center justify-center bg-purple-500/20 rounded-full border-2 border-purple-400">
                <i className="ri-calendar-line text-5xl text-purple-400"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl shadow-2xl p-8 mb-6 border-4 border-pink-500/30 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-purple-500"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-6 flex items-center">
            <div className="w-10 h-10 flex items-center justify-center mr-3">
              <i className="ri-refresh-line text-3xl text-pink-400"></i>
            </div>
            재측정
          </h2>
          <button
            onClick={handleReroll}
            disabled={!canReroll || isAnimating}
            className={`w-full py-5 rounded-2xl font-black text-xl transition-all whitespace-nowrap border-4 ${
              canReroll && !isAnimating
                ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 text-white border-pink-400 hover:shadow-2xl hover:shadow-pink-500/50 hover:scale-105 cursor-pointer animate-pulse'
                : 'bg-gray-800 text-gray-600 border-gray-700 cursor-not-allowed'
            }`}
          >
            {canReroll && !isAnimating ? '🔄 오늘의 나 다시 측정하기 (하루 1회)' : '⏰ 오늘은 이미 측정했습니다'}
          </button>
        </div>

        {/* 공유하기 */}
        <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl shadow-2xl p-8 mb-6 border-4 border-sky-500/30 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-cyan-500"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-sky-500"></div>
          
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-400 mb-6 flex items-center">
            <div className="w-10 h-10 flex items-center justify-center mr-3">
              <i className="ri-share-forward-line text-3xl text-sky-400"></i>
            </div>
            공유하기
          </h2>
          <button
            onClick={handleShare}
            className="w-full py-5 rounded-2xl font-black text-xl transition-all whitespace-nowrap border-4 bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600 text-white border-sky-400 hover:shadow-2xl hover:shadow-sky-500/40 hover:scale-105"
          >
            {hasMeasured ? '현재 순위 공유하기' : '링크 공유하기'}
          </button>
        </div>

        <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl shadow-2xl p-8 mb-6 border-4 border-orange-500/30 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
          
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 mb-6 flex items-center">
            <div className="w-10 h-10 flex items-center justify-center mr-3">
              <i className="ri-fire-line text-3xl text-orange-400"></i>
            </div>
            출석 현황
          </h2>
          <div className="flex items-center justify-between bg-gradient-to-r from-orange-900/50 to-red-900/50 rounded-2xl p-6 border-2 border-orange-500/30">
            <div>
              <div className="text-orange-300 font-bold mb-2 text-lg">🔥 연속 방문</div>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400 drop-shadow-lg">
                {streak}일
              </div>
            </div>
            <div className="w-20 h-20 flex items-center justify-center bg-orange-500/20 rounded-full border-2 border-orange-400">
              <i className="ri-calendar-check-line text-5xl text-orange-400"></i>
            </div>
          </div>
          {streak >= 3 && (
            <div className="mt-4 bg-yellow-500/20 border-2 border-yellow-400 p-4 rounded-xl">
              <div className="flex items-center">
                <div className="w-8 h-8 flex items-center justify-center mr-2">
                  <i className="ri-star-fill text-2xl text-yellow-400"></i>
                </div>
                <span className="text-yellow-400 font-black text-lg">⚡ 보정치 적용 중</span>
              </div>
            </div>
          )}
        </div>

        {/* 순위 추이 그래프 */}
        <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl shadow-2xl p-8 mb-6 border-4 border-emerald-500/30 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-emerald-500"></div>
          
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 mb-6 flex items-center">
            <div className="w-10 h-10 flex items-center justify-center mr-3">
              <i className="ri-line-chart-line text-3xl text-emerald-400"></i>
            </div>
            순위 추이 (최근 30일)
          </h2>

          <div className="bg-black/30 rounded-2xl p-4 border border-emerald-500/20">
            {rankHistory.length === 0 ? (
              <div className="py-10 text-center text-emerald-200/80 font-semibold">
                아직 기록이 없어요. <span className="text-emerald-300 font-black">재측정</span>을 눌러서 순위 추이를 쌓아보세요.
              </div>
            ) : (
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={rankHistory} margin={{ top: 20, right: 24, left: 40, bottom: 16 }}>
                    <CartesianGrid stroke="rgba(16, 185, 129, 0.1)" />
                    <XAxis
                      dataKey="at"
                      tickFormatter={(value: unknown) => {
                        const s = typeof value === 'string' ? value : '';
                        // 값이 비정상이면 빈 문자열 처리
                        if (!s) return '';
                        // ISO(YYYY-MM-DD...) 또는 YYYY-MM-DD 라고 가정하고 MM/DD로 축약
                        return s.length >= 10 ? s.slice(5, 10).replace('-', '/') : s;
                      }}
                      stroke="#86efac"
                      tick={{ fill: '#86efac' }}
                      tickMargin={8}
                    />
                    <YAxis
                      dataKey="rank"
                      reversed
                      tickFormatter={(v: number) => `${v.toLocaleString()}위`}
                      stroke="#86efac"
                      tick={{ fill: '#86efac' }}
                      tickMargin={8}
                      domain={['dataMin', 'dataMax']}
                    />
                    <Tooltip
                      formatter={(value?: number) => [value == null ? '—' : `${value.toLocaleString()}위`, '순위']}
                      labelFormatter={(label: unknown) => {
                        const s = typeof label === 'string' ? label : '';
                        if (!s) return '기록';
                        return `기록: ${s.slice(0, 19).replace('T', ' ')}`;
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="rank"
                      stroke="rgba(16, 185, 129, 1)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}