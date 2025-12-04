import React, { useState, useEffect } from 'react';
import { GamePhase } from './types';
import { PlayerCard } from './components/PlayerCard';
import { GameLog } from './components/GameLog';
import { useGameMaster } from './hooks/useGameMaster';

const App: React.FC = () => {
  // Use the new Game Master hook
  const { state, initGame, proceed, setDiscussionRounds } = useGameMaster();
  const { players, phase, logs, dayCount, winner, activeSpeakerId, currentDiscussionRound, maxDiscussionRounds } = state;

  // UI Local State
  const [isGodMode, setIsGodMode] = useState<boolean>(false);
  const [gameSpeed, setGameSpeed] = useState<number>(2000); 
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);

  // Auto-play trigger
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (autoPlay && !isPaused && phase !== GamePhase.GAME_OVER && phase !== GamePhase.SETUP) {
       timer = setTimeout(() => {
           proceed();
       }, gameSpeed);
    }
    return () => clearTimeout(timer);
  }, [autoPlay, isPaused, phase, gameSpeed, proceed]);


  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col font-sans selection:bg-indigo-500/30 overflow-hidden">
      
      {/* Full Width Header Image */}
      <img 
        src="https://raw.githubusercontent.com/Sunwood-ai-labs/image-box/refs/heads/main/AI-Werewolf-Village_header.png" 
        alt="AI Werewolf Village" 
        className="w-full h-32 sm:h-48 object-cover object-center border-b-4 border-slate-900 shadow-2xl shrink-0 relative z-30" 
      />

      {/* Status Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 shadow-xl z-20 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          
          <div className="flex items-center gap-2 opacity-80">
             <span className="text-xl">🌕</span>
             <h1 className="font-horror text-indigo-400 tracking-wider font-bold">AI 人狼村</h1>
          </div>

          <div className="flex items-center gap-4 text-sm">
             <div className="flex flex-col items-end">
                <span className="font-bold text-amber-500 uppercase tracking-widest text-[10px]">フェーズ</span>
                <span className="text-base font-bold">
                    {phase === GamePhase.DAY_DISCUSSION && "昼：議論"}
                    {phase === GamePhase.DAY_VOTE && "夕方：投票"}
                    {phase === GamePhase.NIGHT_ACTION && "夜：行動"}
                    {phase === GamePhase.GAME_OVER && "ゲーム終了"}
                    {phase === GamePhase.SETUP && "準備中"}
                </span>
             </div>
             {phase === GamePhase.DAY_DISCUSSION && (
                 <div className="flex flex-col items-end animate-in fade-in">
                    <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">ラウンド</span>
                    <span className="text-base font-mono text-indigo-300">{currentDiscussionRound} / {maxDiscussionRounds}</span>
                 </div>
             )}
             <div className="h-8 w-px bg-slate-700 mx-2"></div>
             <div className="flex flex-col items-end">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">日数</span>
                <span className="text-base font-mono">{dayCount}日目</span>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        
        {/* Left: Game Board */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto pr-2">
           
           {/* Controls */}
           <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-wrap gap-4 items-center justify-between backdrop-blur-md shrink-0">
              <div className="flex gap-2">
                 {phase === GamePhase.SETUP ? (
                    <button onClick={initGame} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-indigo-900/20 transition-all active:scale-95">
                       ゲーム開始
                    </button>
                 ) : (
                    <>
                      <button onClick={() => setAutoPlay(!autoPlay)} className={`px-4 py-2 rounded-lg font-bold border ${autoPlay ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                         {autoPlay ? '⏸ 自動再生 ON' : '▶ 自動再生 OFF'}
                      </button>
                      <button onClick={() => proceed()} disabled={autoPlay || phase === GamePhase.GAME_OVER} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold border border-slate-600">
                         次へ進む
                      </button>
                      <button onClick={() => initGame()} className="text-red-400 hover:text-red-300 px-4 py-2 text-sm">
                         リセット
                      </button>
                    </>
                 )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">議論の長さ</span>
                      <input 
                        type="range" 
                        min="1" 
                        max="5" 
                        step="1" 
                        value={maxDiscussionRounds} 
                        onChange={(e) => setDiscussionRounds(Number(e.target.value))} 
                        className="w-20 accent-indigo-500"
                      />
                      <span className="text-xs font-mono w-4">{maxDiscussionRounds}</span>
                  </div>

                  <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">速度</span>
                      <input 
                        type="range" 
                        min="500" 
                        max="5000" 
                        step="500" 
                        value={gameSpeed} 
                        onChange={(e) => setGameSpeed(Number(e.target.value))} 
                        className="w-20 accent-indigo-500"
                      />
                  </div>
                  
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-slate-400 hover:text-white">
                      <input type="checkbox" checked={isGodMode} onChange={(e) => setIsGodMode(e.target.checked)} className="rounded bg-slate-800 border-slate-600 accent-indigo-500"/>
                      神の視点
                  </label>
              </div>
           </div>

           {/* Visualization Area */}
           <div className="bg-slate-900/30 rounded-2xl border border-slate-800 p-8 flex items-center justify-center relative min-h-[400px] shrink-0">
              
              {players.length === 0 ? (
                  <div className="text-center space-y-4">
                      <div className="text-6xl animate-bounce">🐺</div>
                      <p className="text-slate-500 max-w-md mx-auto">
                        AI人狼村へようこそ。<br/>
                        <span className="text-indigo-400 font-bold">ゲーム開始</span> をクリックすると、GMが村を作成します。
                      </p>
                  </div>
              ) : (
                  <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
                      {players.map(player => (
                          <PlayerCard 
                            key={player.id} 
                            player={player} 
                            isGodMode={isGodMode || phase === GamePhase.GAME_OVER} 
                            isSpeaking={player.id === activeSpeakerId}
                          />
                      ))}
                  </div>
              )}

              {/* Phase Indicator Overlay */}
              <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none opacity-50">
                  <div className={`w-3 h-3 rounded-full ${phase === GamePhase.DAY_DISCUSSION ? 'bg-yellow-500 shadow-[0_0_10px_orange]' : 'bg-slate-800'}`}></div>
                  <div className={`w-3 h-3 rounded-full ${phase === GamePhase.DAY_VOTE ? 'bg-red-500 shadow-[0_0_10px_red]' : 'bg-slate-800'}`}></div>
                  <div className={`w-3 h-3 rounded-full ${phase === GamePhase.NIGHT_ACTION ? 'bg-indigo-500 shadow-[0_0_10px_indigo]' : 'bg-slate-800'}`}></div>
              </div>

              {winner && (
                  <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center rounded-2xl backdrop-blur-sm animate-in fade-in duration-700">
                      <h2 className={`text-4xl sm:text-6xl font-horror mb-4 font-bold ${winner === 'WEREWOLVES' ? 'text-red-500' : 'text-green-400'}`}>
                          {winner === 'WEREWOLVES' ? '人狼チームの勝利' : '村人チームの勝利'}
                      </h2>
                      <p className="text-slate-400 mb-8">Game Over</p>
                      <button onClick={initGame} className="bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform">
                          もう一度プレイ
                      </button>
                  </div>
              )}
           </div>
        </div>

        {/* Right: Logs - Flex column to fill remaining height */}
        <div className="lg:col-span-1 flex flex-col h-full overflow-hidden">
           <GameLog logs={logs} players={players} activeSpeakerId={activeSpeakerId} />
        </div>
      </main>
    </div>
  );
};

export default App;