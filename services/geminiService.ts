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

const getRoleDescription = (role: Role) => {
  switch (role) {
    case Role.WEREWOLF: return "あなたは【人狼】です。目的：正体がバレないように振る舞い、村人陣営を敗北させること。仲間（他の人狼）と連携し、村人を欺いてください。";
    case Role.SEER: return "あなたは【占い師】です。目的：人狼を見つけること。毎晩一人を占って正体を知ることができます。結果を村に伝えるタイミングが重要です。";
    case Role.BODYGUARD: return "あなたは【騎士】です。目的：村人を守ること。毎晩一人を護衛して襲撃から守ります。自分自身は守れません。";
    case Role.MEDIUM: return "あなたは【霊媒師】です。目的：死者の正体を知ること。処刑された人が人狼だったかわかります。";
    default: return "あなたは【村人】です。特別な能力はありません。議論を通じて矛盾を探し、人狼を見つけ出してください。";
  }
};

const buildContext = (activePlayer: Player, players: Player[], logs: LogEntry[], currentPhase: GamePhase, currentDay: number) => {
  // Use last 50 logs to provide better history
  const visibleLogs = logs.slice(-50).map(l => {
    const dayPrefix = `[${l.day}日目/${l.phase === GamePhase.NIGHT_ACTION ? '夜' : '昼'}]`;
    if (l.type === 'system' || l.type === 'death') return `${dayPrefix} [システム]: ${l.content}`;
    
    const speaker = players.find(p => p.id === l.speakerId);
    // Hide name if it's night action unless it's the actor themselves (which shouldn't happen in logs usually, but good safety)
    return `${dayPrefix} [${speaker?.name || '不明'}]: ${l.content}`;
  });

  const alivePlayersList = players.filter(p => p.isAlive).map(p => {
    // If active player is Wolf, show other wolves? (Not implemented in this simple version, assumes local view)
    // For now, simple list.
    return `ID:${p.id} 名前:${p.name}`;
  }).join('\n');

  return `
    【現在の状況】
    日数: ${currentDay}日目
    フェーズ: ${currentPhase}
    
    【現在の生存者リスト】
    ${alivePlayersList}

    【直近の会話・行動ログ（古い順）】
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
  currentDay: number
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    これはフィクションの「人狼ゲーム」のシミュレーションです。
    あなたはプレイヤー「${activePlayer.name}」として振る舞ってください。
    
    【キャラクター情報】
    役職: ${ROLE_LABELS[activePlayer.role]}
    性格: ${activePlayer.personality}
    ${getRoleDescription(activePlayer.role)}
    
    【指示】
    - フェーズ: 昼の議論
    - 他のプレイヤーの発言内容（ログ）をよく読み、文脈に沿って応答してください。
    - 矛盾点を指摘したり、自分の潔白を主張したり、あるいは同意したりなど、会話を成立させてください。
    - 1〜2文の短い口語で、自然に会話してください。
    - あなたの出力は自動的にXMLとして解析されます。
    
    【出力テンプレート】
    <speech>
    ここに発言内容を入れる
    </speech>
  `;

  const context = buildContext(activePlayer, players, logs, currentPhase, currentDay);

  const operation = async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        ${context}
        
        上記のログを踏まえ、${activePlayer.name}として発言してください。
        必ず <speech> タグで囲んでください。
      `,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.8, // Slightly lower for more coherent conversation
        safetySettings: SAFETY_SETTINGS,
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
       throw new Error(`Gemini Stopped: ${candidate.finishReason}`);
    }

    const rawText = response.text || "";
    
    // XML Parsing
    const match = rawText.match(/<speech>([\s\S]*?)<\/speech>/);
    if (match && match[1]) {
        return cleanText(match[1]);
    }

    console.warn("XML parsing failed, using raw text:", rawText);
    return cleanText(rawText);
  };

  try {
    return await withRetry(operation);
  } catch (error) {
    console.error("Gemini Discussion Error:", error);
    throw error;
  }
};

// 2. Generate Action (Vote / Night Ability) - Specific XML Templates
export const generateAction = async (
  activePlayer: Player,
  players: Player[],
  logs: LogEntry[],
  phase: GamePhase,
  currentDay: number
): Promise<{ targetId: string; reasoning: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const validTargets = players.filter(p => p.isAlive && p.id !== activePlayer.id).map(p => p.id);
  
  let taskDescription = '';
  let template = '';
  
  // Define template based on phase and role
  if (phase === GamePhase.DAY_VOTE) {
      taskDescription = '処刑投票の対象を1名選んでください。直前の議論の内容に基づき、最も怪しい人物（人狼だと思う人物）を選んでください。自分が人狼の場合は、疑われていない村人や、逆に自分を疑っている人物に投票するなど戦略的に振る舞ってください。';
      template = `
<vote>
  <target>対象ID</target>
  <reason>理由</reason>
</vote>`;
  } else if (phase === GamePhase.NIGHT_ACTION) {
      switch (activePlayer.role) {
          case Role.WEREWOLF:
              taskDescription = '今晩襲撃して排除する対象を1名選んでください。村人陣営の重要人物（占い師など）を狙うのが定石です。';
              template = `
<attack>
  <target>対象ID</target>
  <reason>理由</reason>
</attack>`;
              break;
          case Role.SEER:
              taskDescription = '今晩占う対象を1名選んでください。人狼かどうか知りたい人物を選んでください。';
              template = `
<divine>
  <target>対象ID</target>
  <reason>理由</reason>
</divine>`;
              break;
          case Role.BODYGUARD:
              taskDescription = '今晩護衛する対象を1名選んでください。人狼に襲われそうな重要人物を選んでください。';
              template = `
<guard>
  <target>対象ID</target>
  <reason>理由</reason>
</guard>`;
              break;
          default:
              return { targetId: "NONE", reasoning: "行動なし" };
      }
  }

  const systemInstruction = `
    あなたは「${activePlayer.name}」です。
    役職: ${ROLE_LABELS[activePlayer.role]}
    性格: ${activePlayer.personality}
    
    【有効なターゲットIDリスト】
    ${JSON.stringify(validTargets)}
    
    【タスク】
    ${taskDescription}
    
    【重要】
    以下のXMLテンプレートをそのまま使用し、中身を埋めて出力してください。
    ${template}
  `;

  const context = buildContext(activePlayer, players, logs, phase, currentDay);

  const operation = async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${context}\n\nターゲットと理由をXML形式で決定してください。`,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.5,
        safetySettings: SAFETY_SETTINGS,
      }
    });

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Gemini Action Stopped: ${candidate.finishReason}`);
    }

    const rawText = response.text || "";
    
    // Robust XML Parsing
    const targetMatch = rawText.match(/<target>(.*?)<\/target>/);
    const reasonMatch = rawText.match(/<reason>([\s\S]*?)<\/reason>/);

    if (targetMatch && reasonMatch) {
        const result = {
            targetId: cleanText(targetMatch[1]),
            reasoning: cleanText(reasonMatch[1])
        };

        // Validate target
        if (!validTargets.includes(result.targetId)) {
            console.warn(`Invalid target ${result.targetId} chosen by ${activePlayer.name}. Picking random.`);
            const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
            return { targetId: randomTarget, reasoning: `(自動修正: ID不一致) ${result.reasoning}` };
        }
        return result;
    }

    console.error("Action Parsing Failed. Raw:", rawText);
    throw new Error("Invalid XML response format");
  };

  try {
    return await withRetry(operation);
  } catch (error) {
    console.error("Gemini Action Error:", error);
    const randomTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
    const errorMsg = error instanceof Error ? error.message : "Unknown Error";
    return { targetId: randomTarget, reasoning: `（エラー: ${errorMsg} のためランダム選択）` };
  }
};