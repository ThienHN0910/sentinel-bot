export const channelChainState = new Map<string, string>(); // channelId -> lastWord

export function validateWordChain(prevWord: string, nextWord: string): boolean {
  const prevTokens = prevWord.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const nextTokens = nextWord.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (prevTokens.length < 2 || nextTokens.length < 2) return false;
  return prevTokens[prevTokens.length - 1] === nextTokens[0];
}

export class WordChainGame {
  public static processWord(channelId: string, word: string): { success: boolean; message: string } {
    const trimmedWord = word.trim();
    const tokens = trimmedWord.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) {
      return {
        success: false,
        message: 'Từ nối tiếng Việt phải có ít nhất 2 từ (ví dụ: hoa hồng)!'
      };
    }

    const lastWord = channelChainState.get(channelId);
    if (!lastWord) {
      channelChainState.set(channelId, trimmedWord);
      return { success: true, message: `Bắt đầu chuỗi với: **${trimmedWord}**` };
    }

    if (!validateWordChain(lastWord, trimmedWord)) {
      const lastToken = lastWord.trim().split(/\s+/).pop();
      return {
        success: false,
        message: `Sai rồi! Từ tiếp theo phải bắt đầu bằng **${lastToken}**.`
      };
    }

    channelChainState.set(channelId, trimmedWord);
    const nextToken = trimmedWord.split(/\s+/).pop();
    return {
      success: true,
      message: `Hợp lệ! Từ tiếp theo phải bắt đầu bằng **${nextToken}**.`
    };
  }

  public static submitWord(channelId: string, word: string) {
    return this.processWord(channelId, word);
  }

  public static getLastWord(channelId: string): string | undefined {
    return channelChainState.get(channelId);
  }

  public static reset(channelId?: string): void {
    if (channelId) {
      channelChainState.delete(channelId);
    } else {
      channelChainState.clear();
    }
  }
}
