/* Explicit, hand-reviewed fixtures only. No arbitrary-text understanding. */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var content = Today.content || (Today.content = {});
  var fixtures = [
    {
      name: 'showcase_travel',
      raw_text: '今天去了海边。\n\n早上坐了很久的车，\n到的时候刚好赶上太阳升起来。\n\n中午在海边吃了披萨，\n下午沿着海边慢慢走，\n拍了很多照片。\n\n晚上坐在沙滩上看了一会儿海，\n感觉这一天特别安静。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '早上坐了很久的车', time: '早上', location: null, action: '坐车', object: null, goal: '去海边', emotion: null },
        { id: 'e2', kind: 'occurred', quote: '到的时候刚好赶上太阳升起来', time: '早上', location: '海边', action: '看到日出', object: null, goal: null, emotion: null },
        { id: 'e3', kind: 'occurred', quote: '中午在海边吃了披萨', time: '中午', location: '海边', action: '吃披萨', object: '披萨', goal: null, emotion: null },
        { id: 'e4', kind: 'occurred', quote: '下午沿着海边慢慢走', time: '下午', location: '海边', action: '散步', object: null, goal: null, emotion: null },
        { id: 'e5', kind: 'occurred', quote: '拍了很多照片', time: null, location: null, action: '拍照', object: '照片', goal: null, emotion: null },
        { id: 'e6', kind: 'occurred', quote: '晚上坐在沙滩上看了一会儿海', time: '晚上', location: '沙滩', action: '看海', object: '海', goal: null, emotion: '安静' }
      ],
      fragments: [
        { id: 'f1', title: '清晨抵达海边', event_ids: ['e1', 'e2'] },
        { id: 'f2', title: '海边的午后', event_ids: ['e3', 'e4', 'e5'] },
        { id: 'f3', title: '在沙滩上看海', event_ids: ['e6'] }
      ],
      title: '把海风留在今天这一页',
      scenes: [
        { id: 's1', fragment_id: 'f1', title: '清晨抵达海边', caption: '坐了很久的车，到海边时刚好看见太阳升起。', visual_prompt: '透明水彩手账插画：清晨海边日出，旅途抵达的安静一刻；仅描绘记录中出现的海、太阳与沙滩。', image_key: 'city' },
        { id: 's2', fragment_id: 'f2', title: '沿着海岸走了一段路', caption: '中午在海边吃了披萨，下午沿着海慢慢走，也拍下了许多照片。', visual_prompt: '透明水彩手账插画：海边的披萨午餐与沿岸散步，留白纸纹，不添加同行者。', image_key: 'walk' },
        { id: 's3', fragment_id: 'f3', title: '坐在沙滩上看海', caption: '晚上在沙滩上看了一会儿海，记住这一天安静的感觉。', visual_prompt: '透明水彩手账插画：夜晚沙滩与海面，克制的蓝灰色，不添加未提及的人物。', image_key: 'night' }
      ],
      reflection: { text: '从清晨的海，到夜晚的沙滩，这一天有车程、披萨、散步和许多照片。回头看时，最清晰的也许是那份安静。', event_ids: ['e1', 'e3', 'e4', 'e5', 'e6'] },
      ai_observation: null
    },
    {
      name: 'showcase_weekend',
      raw_text: '今天没有安排特别的事情。\n\n上午整理了房间，\n下午去市场买了一束花。\n\n晚上去吃了烤肉，\n第一次自己动手烤，\n虽然卖相一般，\n但是吃完觉得很满足。\n\n后来坐在窗边看了一会儿书。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '上午整理了房间', time: '上午', location: '房间', action: '整理', object: '房间', goal: null, emotion: null },
        { id: 'e2', kind: 'occurred', quote: '下午去市场买了一束花', time: '下午', location: '市场', action: '买花', object: '花', goal: null, emotion: null },
        { id: 'e3', kind: 'occurred', quote: '晚上去吃了烤肉', time: '晚上', location: null, action: '吃烤肉', object: '烤肉', goal: null, emotion: null },
        { id: 'e4', kind: 'occurred', quote: '第一次自己动手烤', time: null, location: null, action: '动手烤', object: '烤肉', goal: null, emotion: '满足' },
        { id: 'e5', kind: 'occurred', quote: '后来坐在窗边看了一会儿书', time: null, location: '窗边', action: '看书', object: '书', goal: null, emotion: null }
      ],
      fragments: [
        { id: 'f1', title: '整理房间与买花', event_ids: ['e1', 'e2'] },
        { id: 'f2', title: '第一次动手烤肉', event_ids: ['e3', 'e4'] },
        { id: 'f3', title: '窗边读书', event_ids: ['e5'] }
      ],
      title: '普通日子里的小小收藏',
      scenes: [
        { id: 's1', fragment_id: 'f1', title: '整理房间后的下午', caption: '上午整理房间，下午从市场带回一束花。', visual_prompt: '透明水彩手账插画：整洁的房间里放着一束花，暖白纸纹，不添加未提及的物品。', image_key: 'home' },
        { id: 's2', fragment_id: 'f2', title: '第一次尝试的新味道', caption: '晚上吃烤肉，第一次自己动手烤。卖相一般，吃完却很满足。', visual_prompt: '透明水彩手账插画：烤肉餐桌与一双正在动手烤的手，低饱和暖色，不添加同行者。', image_key: 'food' },
        { id: 's3', fragment_id: 'f3', title: '窗边的一会儿书', caption: '后来在窗边坐下，看了一会儿书。', visual_prompt: '透明水彩手账插画：窗边打开的书与安静角落，暖白纸纹，大面积留白。', image_key: 'study' }
      ],
      reflection: { text: '没有特别安排的一天，也留下了整理好的房间、一束花、第一次动手烤肉和窗边的书。这些小事已经让周末有了自己的样子。', event_ids: ['e1', 'e2', 'e3', 'e4', 'e5'] },
      ai_observation: null
    },
    {
      name: 'showcase_emotion',
      raw_text: '今天状态不太好。\n\n事情堆在一起，\n一整天都有点焦虑。\n\n晚上没有继续刷手机，\n出去走了一圈。\n\n回来以后泡了一杯热茶，\n感觉慢慢恢复了一些。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '事情堆在一起', time: '今天', location: null, action: '处理堆在一起的事情', object: null, goal: null, emotion: '焦虑' },
        { id: 'e2', kind: 'occurred', quote: '晚上没有继续刷手机，\n出去走了一圈', time: '晚上', location: null, action: '出去走', object: null, goal: null, emotion: null },
        { id: 'e3', kind: 'occurred', quote: '回来以后泡了一杯热茶', time: '晚上', location: '房间', action: '泡茶', object: '热茶', goal: null, emotion: null },
        { id: 'e4', kind: 'emotion_only', quote: '感觉慢慢恢复了一些', time: null, location: null, action: null, object: null, goal: null, emotion: '慢慢恢复了一些' }
      ],
      fragments: [
        { id: 'f1', title: '忙乱的一天', event_ids: ['e1'] },
        { id: 'f2', title: '晚上的短暂停靠', event_ids: ['e2'] },
        { id: 'f3', title: '一杯热茶', event_ids: ['e3'] }
      ],
      title: '给今天留下一点缓慢的时间',
      scenes: [
        { id: 's1', fragment_id: 'f1', title: '忙乱的一天', caption: '事情堆在一起，一整天都觉得有点焦虑。', visual_prompt: '透明水彩手账插画：桌上的零散待办纸片与柔和灯光，不添加具体工作或学业内容。', image_key: 'home' },
        { id: 's2', fragment_id: 'f2', title: '晚上的短暂停靠', caption: '晚上放下手机，出门走了一圈。', visual_prompt: '透明水彩手账插画：夜晚街道与散步的片刻，蓝灰色留白，不添加未提及的同行者。', image_key: 'walk' },
        { id: 's3', fragment_id: 'f3', title: '回来后的一杯热茶', caption: '回来泡了杯热茶，感觉慢慢恢复了一些。', visual_prompt: '透明水彩手账插画：温暖房间里的一杯热茶，浅棕与暖白，不夸大情绪好转。', image_key: 'home' }
      ],
      reflection: { text: '焦虑没有一下子消失。走了一圈，泡一杯热茶之后，你说自己慢慢恢复了一些。今天也可以停在这一点点变化上。', event_ids: ['e1', 'e2', 'e3', 'e4'] },
      ai_observation: { source: 'mock_observation', text: '你记录了白天的焦虑，也记录了散步和热茶之后的缓和。', event_ids: ['e1', 'e2', 'e3', 'e4'] }
    },
    {
      name: 'ordinary_day',
      raw_text: '早上去学校上课，中午在食堂吃饭，晚上回家读了半小时书。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '早上去学校上课', time: '早上', location: '学校', action: '上课', object: null, goal: null, emotion: null },
        { id: 'e2', kind: 'occurred', quote: '中午在食堂吃饭', time: '中午', location: '食堂', action: '吃饭', object: null, goal: null, emotion: null },
        { id: 'e3', kind: 'occurred', quote: '晚上回家读了半小时书', time: '晚上', location: '家', action: '读书', object: '书', goal: null, emotion: null }
      ],
      fragments: [
        { id: 'f1', title: '早上的课堂', event_ids: ['e1'] },
        { id: 'f2', title: '中午的食堂', event_ids: ['e2'] },
        { id: 'f3', title: '晚上的阅读', event_ids: ['e3'] }
      ],
      title: '从课堂到书页',
      scenes: [
        { id: 's1', fragment_id: 'f1', title: '早晨，在学校', caption: '早上去了学校上课。', visual_prompt: '克制的透明水彩墨线手账插画：学校课堂中的上课场景；灰蓝与暖白，纸张留白；不添加未提及的人物或天气。', image_key: 'study' },
        { id: 's2', fragment_id: 'f2', title: '食堂的午间', caption: '中午在食堂吃了饭。', visual_prompt: '透明水彩线稿手账插画：食堂里吃饭的生活片段；低饱和赭石和奶油白，大面积留白；不添加具体菜品。', image_key: 'food' },
        { id: 's3', fragment_id: 'f3', title: '回家后，读半小时书', caption: '晚上回到家，留了半小时给书。', visual_prompt: '透明水彩线稿手账插画：家中阅读半小时书的场景；暖白纸纹、松散深棕墨线、轻微水彩晕染。', image_key: 'home' }
      ],
      reflection: { text: '学校、食堂和晚上家里的书页，是今天地图上的三个记号。没有远行，也有一条属于这一天的路线。', event_ids: ['e1', 'e2', 'e3'] },
      ai_observation: null
    },
    {
      name: 'future_plan',
      raw_text: '下午去了自习室改简历，明天准备投递。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '下午去了自习室改简历', time: '下午', location: '自习室', action: '改简历', object: '简历', goal: '求职准备', emotion: null },
        { id: 'e2', kind: 'planned', quote: '明天准备投递', time: '明天', location: null, action: '投递', object: null, goal: '求职准备', emotion: null }
      ],
      fragments: [{ id: 'f1', title: '下午的求职准备', event_ids: ['e1'] }],
      title: '在自习室修改简历',
      scenes: [
        { id: 's1', fragment_id: 'f1', title: '自习室里的简历', caption: '下午去了自习室，把简历改了一遍。', visual_prompt: '透明水彩墨线手账插画：自习室里修改简历，桌上只有简历纸张；低饱和灰蓝、奶油白，纸纹与留白；不表现尚未发生的投递。', image_key: 'study' }
      ],
      reflection: { text: '明天还没有到来，投递也还在纸页之外。今天只记下那个在自习室里修改简历的下午，已做过的事不用被未发生的事盖住。', event_ids: ['e1'] },
      ai_observation: null
    },
    {
      name: 'multi_stage',
      raw_text: '早上赶地铁上班，中午和同事吃饭，下午开会并整理方案，晚上回家做了晚饭，又读了半小时书。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '早上赶地铁上班', time: '早上', location: '地铁', action: '上班', object: null, goal: null, emotion: null },
        { id: 'e2', kind: 'occurred', quote: '中午和同事吃饭', time: '中午', location: null, action: '吃饭', object: null, goal: null, emotion: null },
        { id: 'e3', kind: 'occurred', quote: '下午开会并整理方案', time: '下午', location: null, action: '开会并整理', object: '方案', goal: null, emotion: null },
        { id: 'e4', kind: 'occurred', quote: '晚上回家做了晚饭', time: '晚上', location: '家', action: '做晚饭', object: '晚饭', goal: null, emotion: null },
        { id: 'e5', kind: 'occurred', quote: '又读了半小时书', time: null, location: null, action: '读书', object: '书', goal: null, emotion: null }
      ],
      fragments: [
        { id: 'f1', title: '早上的通勤', event_ids: ['e1'] },
        { id: 'f2', title: '中午的相聚', event_ids: ['e2'] },
        { id: 'f3', title: '下午的工作', event_ids: ['e3'] },
        { id: 'f4', title: '回家后的晚间时光', event_ids: ['e4', 'e5'] }
      ],
      title: '从地铁到晚饭与书',
      scenes: [
        { id: 's1', fragment_id: 'f1', title: '赶地铁的早晨', caption: '早上赶地铁去上班。', visual_prompt: '透明水彩墨线手账插画：早晨赶地铁上班，地铁车门与通勤人物；灰蓝、暖白，大留白。', image_key: 'commute' },
        { id: 's2', fragment_id: 'f2', title: '同事与午饭', caption: '中午和同事一起吃了饭。', visual_prompt: '透明水彩墨线手账插画：中午与同事吃饭，简洁餐桌和两个人物轮廓；不指定菜品或谈话。', image_key: 'food' },
        { id: 's3', fragment_id: 'f3', title: '会议之后的方案', caption: '下午开了会，接着整理方案。', visual_prompt: '透明水彩墨线手账插画：下午开会并整理方案，桌上文件和手写线条；不表现未提及的结果。', image_key: 'work' },
        { id: 's4', fragment_id: 'f4', title: '晚饭与半小时的书', caption: '晚上回家做了晚饭，后来又读了半小时书。', visual_prompt: '透明水彩墨线手账插画：家中做晚饭与读书的连续生活场景，可用同页双场景构图；暖白纸张、大留白。', image_key: 'home' }
      ],
      reflection: { text: '早晨沿着地铁的线路去上班，夜里回到家，做晚饭、读半小时书。白天的去处与晚上的归处，接成了今天的轮廓。', event_ids: ['e1', 'e4', 'e5'] },
      ai_observation: null
    },
    {
      name: 'expressed_emotion',
      raw_text: '下午改论文时很烦躁，晚上出去散步后平静下来。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '下午改论文时很烦躁', time: '下午', location: null, action: '改论文', object: '论文', goal: null, emotion: '烦躁' },
        { id: 'e2', kind: 'occurred', quote: '晚上出去散步后平静下来', time: '晚上', location: null, action: '散步', object: null, goal: null, emotion: '平静' }
      ],
      fragments: [
        { id: 'f1', title: '下午改论文', event_ids: ['e1'] },
        { id: 'f2', title: '晚上的散步', event_ids: ['e2'] }
      ],
      title: '从改论文到晚间散步',
      scenes: [
        { id: 's1', fragment_id: 'f1', title: '改论文的下午', caption: '下午改论文时，心里很烦躁。', visual_prompt: '透明水彩墨线手账插画：下午修改论文，桌上论文稿件；低饱和灰蓝、克制线条与留白；不添加其他人物。', image_key: 'study' },
        { id: 's2', fragment_id: 'f2', title: '走过晚上的一段路', caption: '晚上出去散了步，之后感觉平静了一些。', visual_prompt: '透明水彩墨线手账插画：夜晚散步的人物与简洁道路；鼠尾草绿和灰蓝晕染，大面积留白。', image_key: 'walk' }
      ],
      reflection: { text: '下午改论文时的烦躁，不必因为晚上的平静就被抹去。散步之后，心绪与下午不同了；今天可以同时留下这两种感受。', event_ids: ['e1', 'e2'] },
      ai_observation: { source: 'mock_observation', text: '下午的烦躁和晚间的平静，都是你在记录里提到的感受。', event_ids: ['e1', 'e2'] }
    },
    {
      name: 'a1_single_stage',
      raw_text: '今天一直在家看书。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '今天一直在家看书', time: '今天', location: '家', action: '看书', object: '书', goal: null, emotion: null }
      ],
      fragments: [{ id: 'f1', title: '在家阅读的一天', event_ids: ['e1'] }],
      title: '在家读书的一天',
      scenes: [{ id: 's1', fragment_id: 'f1', title: '一整天，在家读书', caption: '今天一直待在家里看书。', visual_prompt: '透明水彩线稿手账插画：在家中看书的人物与书本；暖白纸张、松散深棕墨线、大面积留白。', image_key: 'home' }],
      reflection: { text: '外面的时间照常流动，你把今天留给了家里的书。只有这一件事，也足够让这一天与别的日子不同。', event_ids: ['e1'] },
      ai_observation: null
    },
    {
      name: 'a1_multi_stage',
      raw_text: '上午上课，下午去图书馆学习，晚上散步。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '上午上课', time: '上午', location: null, action: '上课', object: null, goal: null, emotion: null },
        { id: 'e2', kind: 'occurred', quote: '下午去图书馆学习', time: '下午', location: '图书馆', action: '学习', object: null, goal: null, emotion: null },
        { id: 'e3', kind: 'occurred', quote: '晚上散步', time: '晚上', location: null, action: '散步', object: null, goal: null, emotion: null }
      ],
      fragments: [
        { id: 'f1', title: '上午的课堂', event_ids: ['e1'] },
        { id: 'f2', title: '下午的图书馆', event_ids: ['e2'] },
        { id: 'f3', title: '晚上的散步', event_ids: ['e3'] }
      ],
      title: '从课堂走到晚间散步',
      scenes: [
        { id: 's1', fragment_id: 'f1', title: '上午的课', caption: '上午去上了课。', visual_prompt: '透明水彩墨线手账插画：上午课堂上课的简洁场景；暖白纸张与低饱和灰蓝，保留空白。', image_key: 'study' },
        { id: 's2', fragment_id: 'f2', title: '图书馆里的下午', caption: '下午去了图书馆学习。', visual_prompt: '透明水彩墨线手账插画：下午在图书馆学习，书本与阅读桌；暖白纸张，低饱和蓝绿色。', image_key: 'study' },
        { id: 's3', fragment_id: 'f3', title: '晚间散步', caption: '晚上出门散了步。', visual_prompt: '透明水彩墨线手账插画：夜晚散步的简洁道路和人物；克制灰蓝与鼠尾草绿，大留白。', image_key: 'walk' }
      ],
      reflection: { text: '上午在课堂，下午在图书馆，晚上走到路上。今天的几个地点连起来，像一条只属于你的路线；走到末尾，不必急着给它取一个宏大的名字。', event_ids: ['e1', 'e2', 'e3'] },
      ai_observation: null
    },
    {
      name: 'a1_future_plan',
      raw_text: '今天吃了饭，明天准备继续吃这家店。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '今天吃了饭', time: '今天', location: null, action: '吃饭', object: null, goal: null, emotion: null },
        { id: 'e2', kind: 'planned', quote: '明天准备继续吃这家店', time: '明天', location: '这家店', action: '吃这家店', object: null, goal: null, emotion: null }
      ],
      fragments: [{ id: 'f1', title: '今天的一顿饭', event_ids: ['e1'] }],
      title: '今天吃的那顿饭',
      scenes: [{ id: 's1', fragment_id: 'f1', title: '今天吃过的一顿饭', caption: '今天吃了饭，先记下这一顿。', visual_prompt: '透明水彩墨线手账插画：一顿日常饭食，简洁桌面与餐具；不指定菜品、餐厅和人物关系；暖白纸张留白。', image_key: 'food' }],
      reflection: { text: '今天确实吃过这顿饭。至于明天是否还会走进那家店，就留给尚未翻开的那一页。', event_ids: ['e1'] },
      ai_observation: null
    },
    {
      name: 'a1_emotion',
      raw_text: '今天压力很大，晚上洗澡后舒服了一些。',
      events: [
        { id: 'e1', kind: 'emotion_only', quote: '今天压力很大', time: '今天', location: null, action: null, object: null, goal: null, emotion: '压力很大' },
        { id: 'e2', kind: 'occurred', quote: '晚上洗澡后舒服了一些', time: '晚上', location: null, action: '洗澡', object: null, goal: null, emotion: '舒服了一些' }
      ],
      fragments: [{ id: 'f1', title: '晚上的放松片刻', event_ids: ['e2'] }],
      title: '洗澡之后，舒服了一些',
      scenes: [{ id: 's1', fragment_id: 'f1', title: '洗澡以后的晚上', caption: '晚上洗过澡，感觉比之前舒服了一些。', visual_prompt: '透明水彩墨线手账插画：洗澡后的舒缓片刻，浴室水汽与毛巾作为生活道具；低饱和暖白和灰蓝；不额外描绘快乐情绪。', image_key: 'home', image_asset: 'assets/scenes/after-shower-v05.webp' }],
      reflection: { text: '今天的压力并没有被一句话消解。只是到了晚上，洗过澡后，你觉得舒服了一些。日子往前走，有时就是这样一点点松开。', event_ids: ['e1', 'e2'] },
      ai_observation: { source: 'mock_observation', text: '你记下了压力很大，也记下了洗澡后舒服了一些。', event_ids: ['e1', 'e2'] }
    },
    {
      name: 'a1_grouped_stage',
      raw_text: '下午去自习室修改简历，完成四场测评，晚上回来洗澡休息。',
      events: [
        { id: 'e1', kind: 'occurred', quote: '下午去自习室修改简历', time: '下午', location: '自习室', action: '修改简历', object: '简历', goal: null, emotion: null },
        { id: 'e2', kind: 'occurred', quote: '完成四场测评', time: null, location: null, action: '完成测评', object: '四场测评', goal: null, emotion: null },
        { id: 'e3', kind: 'occurred', quote: '晚上回来洗澡休息', time: '晚上', location: null, action: '洗澡休息', object: null, goal: null, emotion: null }
      ],
      fragments: [
        { id: 'f1', title: '下午的求职准备', event_ids: ['e1', 'e2'] },
        { id: 'f2', title: '晚上的恢复时间', event_ids: ['e3'] }
      ],
      title: '自习室与晚上的休息',
      scenes: [
        { id: 's1', fragment_id: 'f1', title: '自习室里的求职准备', caption: '下午在自习室修改简历，接着做完了四场测评。', visual_prompt: '克制的透明水彩墨线手账插画：自习室里修改简历和完成四场测评，桌上简历与测评材料；暖白纸张、灰蓝与浅棕、大留白。', image_key: 'study', image_asset: 'assets/scenes/resume-assessments-v05.webp' },
        { id: 's2', fragment_id: 'f2', title: '回来后，洗澡休息', caption: '晚上回来，洗过澡，随后休息。', visual_prompt: '透明水彩墨线手账插画：夜晚回家洗澡休息的生活片段，以毛巾和安静的居家空间表现；低饱和暖白、大留白；不添加宠物或他人。', image_key: 'home', image_asset: 'assets/scenes/after-shower-v05.webp' }
      ],
      reflection: { text: '下午在自习室修改简历、完成四场测评；晚上回来，洗澡休息。同一天里有紧凑的部分，也有慢下来的部分。把它们并排放着，才更像你真正经历的今天。', event_ids: ['e1', 'e2', 'e3'] },
      ai_observation: null
    }
  ];

  function span(raw, quote) {
    var start = raw.indexOf(quote);
    if (start === -1) throw new Error('Broken Mock fixture evidence: ' + quote);
    return { quote: quote, start: start, end: start + quote.length };
  }
  function findFixture(raw) {
    var key = String(raw).replace(/\s+/g, '');
    var match = fixtures.filter(function (item) { return item.raw_text.replace(/\s+/g, '') === key; })[0];
    if (!match) throw new Error('MOCK_SAMPLE_NOT_FOUND: exact fixture text required');
    return match;
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  var mockProvider = {
    samples: fixtures.map(function (item) { return { name: item.name, raw_text: item.raw_text, story_ready: !!item.scenes }; }),
    analyzeMemory: function (rawMemory) {
      var fixture = findFixture(rawMemory.raw_text);
      return {
        events: fixture.events.map(function (item) {
          var event = copy(item);
          delete event.quote;
          event.evidence = [span(rawMemory.raw_text, item.quote)];
          return event;
        }),
        fragments: fixture.fragments.map(function (item) {
          return { id: item.id, title: item.title, event_ids: copy(item.event_ids), status: 'draft' };
        })
      };
    },
    composeReplay: function (analysis) {
      var fixture = findFixture(analysis.raw_memory.raw_text);
      if (!fixture.scenes) throw new Error('MOCK_STORY_NOT_AVAILABLE: A1 sample has no A2 Story fixture');
      var events = {}, fragments = {};
      analysis.events.forEach(function (event) { events[event.id] = event; });
      analysis.fragments.forEach(function (fragment) { fragments[fragment.id] = fragment; });
      return {
        title: fixture.title,
        scenes: fixture.scenes.map(function (item) {
          var fragment = fragments[item.fragment_id];
          if (!fragment) throw new Error('Broken Mock fixture Fragment: ' + item.fragment_id);
          var scene = copy(item);
          scene.event_ids = copy(fragment.event_ids);
          scene.evidence = [].concat.apply([], scene.event_ids.map(function (id) { return copy(events[id].evidence); }));
          scene.time = null; // A0 does not invent an HH:MM from a vague time-of-day.
          scene.photo_id = null;
          scene.provenance = 'mock_draft';
          return scene;
        }),
        reflection: copy(fixture.reflection),
        ai_observation: copy(fixture.ai_observation),
        generation_meta: { mode: 'mock', provider: 'exact_fixture_v1', image_status: 'static_asset' }
      };
    }
  };

  content.mockProvider = mockProvider;
  if (typeof module !== 'undefined' && module.exports) module.exports = mockProvider;
})(typeof window !== 'undefined' ? window : globalThis);
