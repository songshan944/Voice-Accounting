import { Router } from 'express';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const router = Router();

// 合法的分类类型白名单
const VALID_TYPES = [
  'dining', 'transport', 'shopping', 'entertainment',
  'medical', 'housing', 'social', 'other',
  'education', 'digital', 'pet', 'beauty', 'travel', 'communication'
];

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
  "type": 分类（必须是以下之一：dining, transport, shopping, entertainment, medical, housing, social, education, digital, pet, beauty, travel, communication, other）,
  "note": 备注说明,
  "date": 日期（格式：YYYY-MM-DD，今天的日期是 ${new Date().toISOString().split('T')[0]}）
}

分类规则：
- dining（餐饮）：吃饭、点外卖、买奶茶、咖啡、零食、水果、早午晚餐、火锅、烧烤等
- transport（交通）：打车、地铁、公交、加油、停车、火车、高铁、滴滴、机票等
- shopping（购物）：买衣服、网购、买日用品、电子产品、化妆品、鞋包等
- entertainment（娱乐）：电影、游戏、旅游、健身、KTV、演唱会、演出等
- medical（医疗）：医院、药店、买药、体检、挂号等
- housing（住房）：房租、水电费、物业费、装修、家具等
- social（人情）：红包、送礼、请客吃饭、份子钱、礼物等
- education（学习）：课程、培训、书籍、学习用品、辅导班、在线课程等
- digital（数码订阅）：手机话费、宽带费、视频会员、音乐会员、云存储、软件订阅、游戏充值等
- pet（宠物）：宠物粮、宠物用品、宠物医院、洗澡美容等
- beauty（美妆护理）：护肤品、化妆品、美容院、美发、美甲、SPA等
- travel（旅行）：酒店、机票、火车票、景点门票、旅游团、签证等
- communication（通讯）：手机话费、宽带、网络、电话费、快递等
- other（其他）：不属于以上分类的消费

金额提取规则：
- "50块"、"50块钱"、"50元" → 50
- "花了100"、"消费200" → 100、200
- "30.5元" → 30.5

注意：
1. 如果描述中没有明确金额，尝试从上下文推断合理金额
2. 如果无法确定金额，返回 amount: 0（这是合法的）
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

    // 验证 type 是否在白名单中
    let type = result.type;
    if (!VALID_TYPES.includes(type)) {
      console.warn(`AI returned invalid type: ${type}, falling back to other`);
      type = 'other';
    }

    // 确保日期是今天
    if (!result.date) {
      result.date = new Date().toISOString().split('T')[0];
    }

    res.json({
      success: true,
      data: {
        amount: parseFloat(result.amount) || 0,
        type: type,
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
