/* 三则虚构生活示例；文案与照片仅用于展示，不代表自由输入的生成结果。 */
(function (global) {
  'use strict';
  var Today = global.Today || (global.Today = {});
  var EXAMPLES = [
    {
      id: 'travel', title: '海边旅行的一天',
      preview: '旅行 · 从清晨出发，到晚霞落下', image_key: 'city',
      raw_text: '今天去了海边。\n\n早上坐了很久的车，\n到的时候刚好赶上太阳升起来。\n\n中午在海边吃了披萨，\n下午沿着海边慢慢走，\n拍了很多照片。\n\n晚上坐在沙滩上看了一会儿海，\n感觉这一天特别安静。',
      mood_hint: { emoji: '😌', label: '放松' },
      photos: [
        { path: 'assets/showcase/beach-morning.webp', label: '清晨的海边', scene: 0 },
        { path: 'assets/showcase/travel-pizza.webp', label: '海边吃的披萨', scene: 1 },
        { path: 'assets/showcase/beach-sunset.webp', label: '傍晚的海', scene: 2 }
      ]
    },
    {
      id: 'weekend', title: '一个普通周末',
      preview: '生活 · 买花、吃烤肉和慢下来的下午', image_key: 'home',
      raw_text: '今天没有安排特别的事情。\n\n上午整理了房间，\n下午去市场买了一束花。\n\n晚上去吃了烤肉，\n第一次自己动手烤，\n虽然卖相一般，\n但是吃完觉得很满足。\n\n后来坐在窗边看了一会儿书。',
      mood_hint: { emoji: '😌', label: '平静' },
      photos: [
        { path: 'assets/showcase/weekend-flowers.webp', label: '下午买的花', scene: 0 },
        { path: 'assets/showcase/weekend-barbecue.webp', label: '晚上的烤肉', scene: 1 },
        { path: 'assets/showcase/weekend-desk.webp', label: '窗边的书', scene: 2 }
      ]
    },
    {
      id: 'emotion', title: '重新找回一点平静',
      preview: '情绪 · 从混乱到慢慢放松', image_key: 'night',
      raw_text: '今天状态不太好。\n\n事情堆在一起，\n一整天都有点焦虑。\n\n晚上没有继续刷手机，\n出去走了一圈。\n\n回来以后泡了一杯热茶，\n感觉慢慢恢复了一些。',
      mood_hint: { emoji: '😫', label: '有点累' },
      photos: [
        { path: 'assets/showcase/emotion-street.webp', label: '夜晚街道', scene: 1 },
        { path: 'assets/showcase/emotion-tea.webp', label: '热茶', scene: 2 },
        { path: 'assets/showcase/emotion-room.webp', label: '房间灯光', scene: 0 }
      ]
    }
  ];
  Today.demo = { EXAMPLES: EXAMPLES };
  if (typeof module !== 'undefined' && module.exports) module.exports = Today.demo;
})(typeof window !== 'undefined' ? window : globalThis);
