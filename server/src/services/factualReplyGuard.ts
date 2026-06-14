const PLACEHOLDER_TEAMS = /A队|B队|C队|D队|某队|某国|某球队/;
const FAKE_SEARCH_PHRASE = /让我查一下|稍等|等我查|正在查|我去查/;

/** 联网成功时：仅拦截明显幻觉与假搜索口吻，禁止把摘要原文当最终回复 */
export function guardFactualReply(
  reply: string,
  _webContext: string | null,
  webSearchSucceeded: boolean,
  webSearchFailed: boolean,
): string {
  let out = reply.trim();

  if (webSearchFailed) {
    if (PLACEHOLDER_TEAMS.test(out) || FAKE_SEARCH_PHRASE.test(out)) {
      return '我这边暂时查不到可靠的实时信息，没法给你准确回答，换个说法再问我试试喵～';
    }
    return out;
  }

  if (!webSearchSucceeded) return out || reply;

  if (FAKE_SEARCH_PHRASE.test(out)) {
    out = out.replace(/好的，?让我查一下[^。！？]*[。！？]?/g, '');
    out = out.replace(/稍等[^。！？]*[。！？]?/g, '').trim();
  }

  if (PLACEHOLDER_TEAMS.test(out)) {
    return '联网结果里没有足够清晰、可核对的信息，我暂时没法给出准确对阵或比分，你可以换个问法再试喵～';
  }

  return out || reply;
}
