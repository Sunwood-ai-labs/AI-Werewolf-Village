import React, { useEffect, useRef, memo } from 'react';
import { LogEntry } from '../types';
import { GM_ID, GM_NAME } from '../constants';

interface GameLogProps {
  logs: LogEntry[];
  players: any[]; 
  activeSpeakerId: string | null;
}

// Memoized Log Item to improve performance with long lists
const LogItem = memo(({ log, player }: { log: LogEntry, player: any }) => {
  const isGM = log.speakerId === GM_ID;
  const isPrivate = !!log.visibleTo;

  if (isGM) {
    return (
       <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-2 duration-500 my-4">
          <div className="flex items-center gap-2 mb-1">
             <span className="text-2xl filter drop-shadow-md">🎭</span>
             <span className="text-xs text-indigo-400 font-bold tracking-widest uppercase">{GM_NAME}</span>
          </div>
          <div className={`
            text-sm px-6 py-2 rounded-full border text-center shadow-lg max-w-[95%]
            ${log.type === 'death' ? 'bg-red-950/60 border-red-800 text-red-200' : 
              log.type === 'action' ? 'bg-indigo-950/60 border-indigo-800 text-indigo-200' :
              'bg-slate-800/90 border-slate-600 text-slate-200'}
            ${isPrivate ? 'border-yellow-500/50 bg-yellow-900/20' : ''}
          `}>
            {isPrivate && <span className="mr-2 text-yellow-500" title="あなただけの秘密情報">🔒</span>}
            {log.content}
          </div>
       </div>
    );
  }

  return (
    <div className={`flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300 group`}>
       <div className="flex flex-col items-center flex-shrink-0">
         <img 
           src={player?.avatar} 
           alt="avatar" 
           className="w-10 h-10 rounded-full border border-slate-600 object-cover shadow-sm group-hover:border-indigo-400 transition-colors"
         />
       </div>
       <div className="flex flex-col max-w-[85%]">
         <div className="flex items-baseline gap-2 mb-1 ml-1">
            <span className="text-xs text-slate-400 font-bold">{player?.name}</span>
            {log.type === 'action' && <span className="text-[10px] text-indigo-400 border border-indigo-900 px-1 rounded">ACTION</span>}
         </div>
         <div className={`
            px-4 py-2.5 rounded-2xl rounded-tl-none text-sm leading-relaxed shadow-md border 
            ${log.type === 'action' ? 'bg-slate-800/50 text-slate-400 border-slate-700/50 italic' : 'bg-slate-800 text-slate-200 border-slate-700/50'}
         `}>
           {log.content}
         </div>
       </div>
    </div>
  );
});

export const GameLog: React.FC<GameLogProps> = ({ logs, players, activeSpeakerId }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, activeSpeakerId]);

  const activeSpeaker = activeSpeakerId ? players.find(p => p.id === activeSpeakerId) : null;

  return (
    <div className="flex flex-col h-full bg-slate-900/80 rounded-lg border border-slate-700 overflow-hidden backdrop-blur-sm shadow-inner">
      <div className="p-3 bg-slate-800 border-b border-slate-700 font-bold text-slate-300 flex justify-between items-center shadow-md z-10 shrink-0">
        <span className="flex items-center gap-2">📜 ゲームログ</span>
        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-400">{logs.length} 件</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-900/50 scroll-smooth">
        {logs.length === 0 && (
          <div className="text-center text-slate-500 italic mt-10">
            村は静まり返っています... <br/> ゲームマスターが準備をしています。
          </div>
        )}
        
        {logs.map((log) => (
            <LogItem key={log.id} log={log} player={players.find(p => p.id === log.speakerId)} />
        ))}

        {/* Typing Indicator */}
        {activeSpeaker && (
           <div className="flex gap-3 animate-pulse opacity-80">
              <div className="flex flex-col items-center flex-shrink-0">
                 <img 
                   src={activeSpeaker.avatar} 
                   alt="avatar" 
                   className="w-10 h-10 rounded-full border-2 border-indigo-500/50 object-cover grayscale"
                 />
              </div>
               <div className="flex flex-col max-w-[85%]">
                 <span className="text-xs text-slate-400 mb-1 ml-1">{activeSpeaker.name}</span>
                 <div className="bg-slate-800/40 text-slate-400 px-4 py-3 rounded-2xl rounded-tl-none text-sm border border-slate-700/50 flex items-center gap-1.5 w-fit">
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                   <span className="text-xs ml-2 text-indigo-300/70">思考中...</span>
                 </div>
               </div>
           </div>
        )}

        <div ref={bottomRef} className="h-4 shrink-0" />
      </div>
    </div>
  );
};