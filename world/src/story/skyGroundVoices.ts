// The live observation feed and the return radio carry the civilian outcome the player witnessed.
import type { Localized } from '../settlements/types';
import { OF } from './orleansFinale';

export function orleansGroundVoice(done: ReadonlySet<string>, scene: 'monitor' | 'home'): Localized | null {
  if (done.has(OF.quayBell)) return scene === 'monitor'
    ? ['左屏里渡船系着缆。右屏传来两声铃，玛戈划出了画面，左屏的船还在原处。', 'The left screen shows a moored ferry. Two bells sound on the right. Margot rows out of frame. The boat on the left stays put.']
    : ['桥上电台响了两声。玛戈喘着气说：“等会儿，末班船还有个人要上。”你把话筒搁回去，等她把人接过河。', 'The bridge radio rings twice. Margot is out of breath. “Give me a minute. One more for the last boat.” You set the handset down while she rows across.'];
  if (done.has(OF.bridgeBell)) return scene === 'monitor'
    ? ['左屏里横杆压着桥面。右屏响过一声手铃，横杆升起，送面包的车从镜头前经过。', 'The bar lies across the bridge on the left screen. On the right a handbell rings once. The bar rises and the bread cart rolls past the lens.']
    : ['回望桥的电台里响了一声铃，接着是车轮压过木板。马丁说：“听见了？她现在一个人就抬得动。”', 'One bell comes over the bridge radio, followed by wheels on timber. Martin says, “Hear that? She can lift the bar on her own now.”'];
  if (scene === 'home' && done.has(OF.lower)) return ['电台里有人问西营的伤员到了没有。隔了一会儿，另一岸自己报平安。你松开了通话键。', 'Someone on the radio asks if the wounded made the western camp. After a pause the other bank answers for itself. You let go of the transmit key.'];
  if (scene === 'home' && done.has(OF.disarm)) return ['电台里的点名声停了一拍，又从南岸栅门接上。最后一个人报完，守门人收起了名单。', 'The roll call on the radio pauses, then resumes at the south-bank gate. When the last person answers, the gatekeeper folds the list.'];
  return null;
}
