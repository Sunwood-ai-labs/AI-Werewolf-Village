import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Player, Role, GamePhase, LogEntry, ROLE_LABELS } from "../types";

// Helper to sanitize text
const cleanText = (text: string) => text.replace(/`/g, '').trim();

// Retry helper
async function withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

// Strategic Advice based on Role and Day
const getStrategicAdvice = (role: Role, day: number, phase: GamePhase): string => {
  const common = "感情的にならず、論理的に振る舞ってください。";

  switch (role) {
    case Role.VILLAGER:
      return `
        【村人の戦略】
        - 情報を隠している人物や、発言に矛盾がある人物を探してください。
        - 寡黙な人物は疑われやすいので、適度に発言して潔白をアピールしてください。
        - 占い師が二人出た場合は、両方の真偽を慎重に見極めてください。
      `;
    
    case Role.SEER:
      if (day === 1) {
        return `
          【占い師の戦略：重要】
          - 初日または2日目の早い段階で、必ず「自分が占い師である」とカミングアウト（CO）してください。
          - 誰を占ってどういう結果だったか（白＝人間、黒＝人狼）を明確に伝えてください。
          - 潜伏（COしないこと）は、村の不利益になります。
        `;
      }
      return `
        【占い師の戦略】
        - 昨晩の占い結果を速やかに報告してください。
        - 対抗（偽の占い師）がいる場合は、自分が本物であることを論理的に主張してください。
      `;

    case Role.BODYGUARD:
      return `
        【騎士の戦略：最重要】
        - **絶対に自分が騎士であることを明かさない（カミングアウトしない）でください**。正体がバレると人狼に襲撃されます。
        - 議論ではただの村人として振る舞ってください。
        - 夜の護衛は、本物だと思われる占い師を優先して守ってください。
      `;

    case Role.WEREWOLF:
      return `
        【人狼の戦略】
        - 自分が人狼であることは絶対に悟られないでください。
        - 村人のふりをして、もっともらしい推理でミスリードを誘ってください。
        - 占い師が本物を名乗り出た場合、あえて自分も「私が占い師だ」と嘘をついて（対抗CO）、場を混乱させるのも有効な戦略です。
        - 仲間（他の人狼）を露骨にかばうと怪しまれます。時には仲間に投票するライン切りも必要です。
      `;
      
    default:
      return common;
  }
};

const getRoleDescription = (role: Role) => {
  switch (role) {
    case Role.WEREWOLF: return "あなたは【人狼】です。目的：正体がバレないように振る舞い、村人陣営を敗北させること。";
    case Role.SEER: return "あなたは【占い師】です。目的：人狼を見つけること。毎晩一人を占えます。";
    case Role.BODYGUARD: return "あなたは【騎士】です。目的：村人を守ること。毎晩一人を護衛できます。";
    default: return "あなたは【村人】です。特別な能力はありません。議論で人狼を探してください。";
  }
};

const buildContext = (activePlayer: Player, players: Player[], logs: LogEntry[], currentPhase: GamePhase, currentDay: number) => {
  // Optimize: Use only last 30 logs to prevent token overflow and focus on immediate context
  const recentLogs = logs.slice(-30);
  
  // FILTER: Only show public logs OR logs visible to this specific player
  const visibleLogs = recentLogs
    .filter(l => !l.visibleTo || l.visibleTo.includes(activePlayer.id))
    .map(l => {
      const dayPrefix = `[${l.day}日目/${l.phase === GamePhase.NIGHT_ACTION ? '夜' : '昼'}]`;
      if (l.type === 'system' || l.type === 'death') return `${dayPrefix} [GM]: ${l.content}`;
      
      const speaker = players.find(p => p.id === l.speakerId);
      // Mark private logs explicitly in context
      const privateMark = l.visibleTo ? "【(重要) あなただけの秘密情報】" : "";
      return `${dayPrefix} [${speaker?.name || '不明'}]: ${privateMark} ${l.content}`;
    });

  const alivePlayersList = players.filter(p => p.isAlive).map(p => {
    // If active player is Wolf, denote teammates
    let info = `ID:${p.id} 名前:${p.name}`;
    if (activePlayer.role === Role.WEREWOLF && p.role === Role.WEREWOLF && p.id !== activePlayer.id) {
        info += " (味方の人狼)";
    }
    return info;
  }).join('\n');

  return `
    【現在の状況】
    日数: ${currentDay}日目
    フェーズ: ${currentPhase}
    
    【生存者リスト】
    ${alivePlayersList}

    【直近の会話ログ（公開情報 + あなたの記憶）】
    ${visibleLogs.join('\n')}
  `;
};

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// 1. Generate Discussion (XML)
export const generateDiscussion = async (
  activePlayer: Player,
  players: Player[],
  logs: LogEntry[],
  currentPhase: GamePhase,
  currentDay: number,
  modelName: string = 'gemini-2.5-flash'
): Promise<string> => {
  
  // Strategy Injection
  const strategicAdvice = getStrategicAdvice(activePlayer.role, currentDay, currentPhase);

  const systemInstruction = `
    これはフィクションの「人狼ゲーム」のシミュレーションです。
    あなたはプレイヤー「${activePlayer.name}」として振る舞ってください。
    
    【キャラクター情報】
    役職: ${ROLE_LABELS[activePlayer.role]}
    性格: ${activePlayer.personality}
    ${getRoleDescription(activePlayer.role)}

    【戦略・行動指針】
    ${strategicAdvice}
    
    【指示】
    - フェーズ: 昼の議論
    - 他のプレイヤーの直近の発言（ログ）をよく読み、会話の流れを止めないでください。
    - 誰かが質問している場合は答えてください。
    - 1〜2文の短い日本語の口語で、簡潔に話してください。長演説は禁止です。
    - あなたの出力はシステムによって解析されます。必ずXML形式で出力してください。
    
    【出力テンプレート】
    <speech>
    ここに発言内容を入れる
    </speech>
  `;

  const context = buildContext(activePlayer, players, logs, currentPhase, currentDay);
  const prompt = `
    ${context}
    
    上記のログを踏まえ、${activePlayer.name}として発言してください。
    戦略ガイドラインに従い、${activePlayer.role}として最適な振る舞いを心がけてください。
  `;

  // --- OPENROUTER HANDLING ---
  if (modelName.startsWith('openrouter/')) {
      const realModel = modelName.replace('openrouter/', '');
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.API_KEY; // Fallback
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": realModel,
          "messages": [
            {"role": "system", "content": systemInstruction},
            {"role": "user", "content": prompt},
          ]
        })
      });
      
      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content || "";
      const match = rawText.match(/<speech>([\s\S]*?)<\/speech>/);
      return match && match[1] ? cleanText(match[1]) : cleanText(rawText);
  }

  // --- GEMINI HANDLING ---
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const operation = async () => {
    const response = await ai.models.generateContent({
      model: modelName, // e.g. 'gemini-2.5-flash'
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.8,
        safetySettings: SAFETY_SETTINGS,
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
       throw new Error(`Gemini Stopped: ${candidate.finishReason}`);
    }

    const rawText = response.text || "";
    const match = rawText.match(/<speech>([\s\S]*?)<\/speech>/);
    if (match && match[1]) {
        return cleanText(match[1]);
    }
    return cleanText(rawText);
  };

  try {
    return await withRetry(operation);
  } catch (error) {
    console.error("Discussion Error:", error);
    throw error;
  }
};

// 2. Generate Action (Vote / Night Ability)
export const generateAction = async (
  activePlayer: Player,
  players: Player[],
  logs: LogEntry[],
  phase: GamePhase,
  currentDay: number,
  modelName: string = 'gemini-2.5-flash'
): Promise<{ targetId: string; reasoning: string }> => {
  
  const validTargets = players.filter(p => p.isAlive && p.id !== activePlayer.id).map(p => p.id);
  
  let taskDescription = '';
  let template = '';
  
  if (phase === GamePhase.DAY_VOTE) {
      taskDescription = '処刑投票の対象を1名選んでください。直前の議論の内容に基づき、最も怪しい人物を選んでください。理由も簡潔に述べてください。';
      template = `<vote><target>対象ID</target><reason>理由</reason></vote>`;
  } else if (phase === GamePhase.NIGHT_ACTION) {
      switch (activePlayer.role) {
          case Role.WEREWOLF:
              taskDescription = '今晩襲撃して排除する対象を1名選んでください。占い師や、鋭い村人を狙うのが定石です。';
              template = `<attack><target>対象ID</target><reason>理由</reason></attack>`;
              break;
          case Role.SEER:
              taskDescription = '今晩占う対象を1名選んでください。白黒はっきりしていない人物（グレー）を占ってください。';
              template = `<divine><target>対象ID</target><reason>理由</reason></divine>`;
              break;
          case Role.BODYGUARD:
              taskDescription = '今晩護衛する対象を1名選んでください。占い師などの重要人物を守ってください。自分は守れません。';
              template = `<guard><target>対象ID</target><reason>理由</reason></guard>`;
              break;
          default:
              return { targetId: "NONE", reasoning: "行動なし" };
      }
  }

  const strategicAdvice = getStrategicAdvice(activePlayer.role, currentDay, phase);
  
  const systemInstruction = `
    あなたは「${activePlayer.name}」です。
    役職: ${ROLE_LABELS[activePlayer.role]}
    
    【有効ターゲットID】
    ${JSON.stringify(validTargets)}
    
    【戦略】
    ${strategicAdvice}
    
    【タスク】
    ${taskDescription}
    
    XMLテンプレートのみを出力してください。
    ${template}
  `;

  const context = buildContext(activePlayer, players, logs, phase, currentDay);
  const prompt = `${context}\n\n行動を決定してください。`;

  // --- OPENROUTER HANDLING ---
  if (modelName.startsWith('openrouter/')) {
    const realModel = modelName.replace('openrouter/', '');
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.API_KEY; 
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        "model": realModel,
        "messages": [
            {"role": "system", "content": systemInstruction},
            {"role": "user", "content": prompt},
          ]
      })
    });
    
    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "";
    const targetMatch = rawText.match(/<target>(.*?)<\/target>/);
    const reasonMatch = rawText.match(/<reason>([\s\S]*?)<\/reason>/);

    if (targetMatch && reasonMatch) {
        let tid = cleanText(targetMatch[1]);
        if (!validTargets.includes(tid)) tid = validTargets[0]; // fallback
        return { targetId: tid, reasoning: cleanText(reasonMatch[1]) };
    }
    return { targetId: validTargets[0], reasoning: "解析エラーのためランダム" };
  }

  // --- GEMINI HANDLING ---
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const operation = async () => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.5,
        safetySettings: SAFETY_SETTINGS,
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Stopped: ${candidate.finishReason}`);
    }
    const rawText = response.text || "";
    
    const targetMatch = rawText.match(/<target>(.*?)<\/target>/);
    const reasonMatch = rawText.match(/<reason>([\s\S]*?)<\/reason>/);

    if (targetMatch && reasonMatch) {
        const result = {
            targetId: cleanText(targetMatch[1]),
            reasoning: cleanText(reasonMatch[1])
        };
        if (!validTargets.includes(result.targetId)) {
            const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
            return { targetId: randomTarget, reasoning: `(ID自動修正) ${result.reasoning}` };
        }
        return result;
    }
    throw new Error("Invalid XML response");
  };

  try {
    return await withRetry(operation);
  } catch (error) {
    console.error("Action Error:", error);
    const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
    return { targetId: randomTarget, reasoning: `（エラー発生のためランダム選択）` };
  }
};