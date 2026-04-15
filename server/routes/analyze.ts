import { Router } from 'express';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const router = Router();

// AI 智能分类接口
router.post('/api/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '请提供记账内容' });
    }

    const config = new Config();
    const client = new LLMClient(config);

    const systemPrompt = `你是一个智能记账助手，负责分析用户的记账描述并提取信息。

请分析以下记账描述，返回 JSON 格式的结果：
{
  "amount": 金额数字,
  "type": 分类（必须是以下之一：dining, transport, shopping, entertainment, medical, housing, social, other）,
  "note": 备注说明,
  "date": 日期（格式：YYYY-MM-DD，今天的日期是 ${new Date().toISOString().split('T')[0]}）
}

分类规则：
- dining（餐饮）：吃饭、点外卖、买奶茶、咖啡、零食、水果、早午晚餐等
- transport（交通）：打车、地铁、公交、加油、停车、火车、高铁等
- shopping（购物）：买衣服、网购、买日用品、电子产品、化妆品等
- entertainment（娱乐）：电影、游戏、旅游、健身、KTV、演唱会等
- medical（医疗）：医院、药店、买药、体检等
- housing（住房）：房租、水电费、物业费、装修等
- social（人情）：红包、送礼、请客吃饭、份子钱等
- other（其他）：不属于以上分类的消费

金额提取规则：
- "50块"、"50块钱"、"50元" → 50
- "花了100"、"消费200" → 100、200
- "30.5元" → 30.5

注意：
1. 如果描述中没有明确金额，尝试从上下文推断合理金额
2. 如果无法确定金额，返回 amount: 0
3. type 必须从给定选项中选择
4. date 默认为今天

只返回 JSON，不要返回其他内容。`;

    const response = await client.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ], {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.3
    });

    // 解析 AI 返回的 JSON
    let result;
    try {
      // 尝试提取 JSON
      const content = response.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(500).json({ error: 'AI 返回格式错误' });
    }

    // 验证结果
    if (!result.amount || !result.type) {
      return res.status(500).json({ error: 'AI 分析结果不完整' });
    }

    // 确保日期是今天
    if (!result.date) {
      result.date = new Date().toISOString().split('T')[0];
    }

    res.json({
      success: true,
      data: {
        amount: parseFloat(result.amount) || 0,
        type: result.type,
        note: result.note || '',
        date: result.date
      }
    });

  } catch (error: any) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: error.message || 'AI 分析失败' });
  }
});

export default router;
