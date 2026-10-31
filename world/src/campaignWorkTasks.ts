import type { Localized, RegionId } from './settlements/types';

export interface CampaignWorkOption { id: string; label: Localized; correct: boolean; feedback: Localized; }
export interface CampaignWorkStep { prompt: Localized; options: readonly CampaignWorkOption[]; success: Localized; }
/** Small physical decisions, not inventory errands or timers. Wrong approaches
 * are caught by the resident before harm; the workstation remains retryable.
 * IDs are step-specific, so stale confirmation cannot skip the next operation.
 */
export const CAMPAIGN_WORK_TASKS: Readonly<Record<RegionId, readonly [CampaignWorkStep, CampaignWorkStep]>> = {
  alpha: [
    {
      prompt: ['金属外壳一碰就发出刺耳嗡鸣。接地夹垂在桌边，音量旋钮还停在最大。先处理什么？', 'Touching the metal case produces a harsh hum. A grounding clip hangs beside the desk; the volume is already at maximum. What do you do first?'],
      options: [
        { id: 'work_1_ground', label: ['把接地夹固定在接地端子上', 'Fasten the clip to the grounding terminal'], correct: true, feedback: ['地线稳了。', 'The ground connection is secure.'] },
        { id: 'work_1_volume', label: ['把音量继续调高，盖过嗡鸣', 'Raise the volume to overpower the hum'], correct: false, feedback: ['岚拦住旋钮：“放大器也会把嗡鸣放大。先接地，再找声音。”', 'Lan stops your hand. “The amplifier raises the hum too. Ground it before searching for a voice.”'] },
      ], success: ['接地夹扣紧，外壳的嗡鸣消失了。刻度窗里还在跳动两种信号：刺耳的大峰，以及微弱但规律的回声。', 'The clip locks into place and the case stops humming. Two signals still move across the dial: a shrill peak and a faint but regular echo.'],
    },
    {
      prompt: ['大峰每次都在不同位置炸响；细小的回声却间隔相同。岚轻轻敲了两下桌面，让你听它的节奏。', 'The loud peak bursts in a different place each time. The faint echo returns at regular intervals. Lan taps the desk twice so you can hear its rhythm.'],
      options: [
        { id: 'work_2_peak', label: ['跟随最响的峰值', 'Follow the loudest peak'], correct: false, feedback: ['耳机里只有杂音。岚摇头：“响，不等于有人。找那个会回答的节奏。”', 'Only static reaches the headphones. Lan shakes their head. “Loud does not mean alive. Find the rhythm that answers.”'] },
        { id: 'work_2_echo', label: ['对准规律重复的微弱回声', 'Tune to the faint repeating echo'], correct: true, feedback: ['回声稳定了。', 'The echo is steady.'] },
      ], success: ['你停在重复的刻线，杂音终于退到声音后面。', 'You hold the dial at the repeating mark. At last, the static falls behind the voice.'],
    },
  ],
  britain: [
    {
      prompt: ['见誓名册上层是一张后加的征召令，下面透出旧名册的墨迹。艾妲只请你清理原来的记录。', 'A later muster order covers the oath roll; the old ink shows beneath it. Ada has asked you to recover the original record.'],
      options: [
        { id: 'work_1_order', label: ['照新征召令重抄所有名字', 'Copy every name into the newer muster order'], correct: false, feedback: ['艾妲按住纸：“记下一个人，不等于替他答应下一场战争。先看原来的那一页。”', 'Ada holds the paper down. “Recording a person does not volunteer them for another war. Look at the original page.”'] },
        { id: 'work_1_roll', label: ['移开征召令，显露原来的名册', 'Lift the muster order to reveal the original roll'], correct: true, feedback: ['旧记录露出来了。', 'The old record is visible.'] },
      ], success: ['你移开后加的纸页。旧名册里，有名字，也有刻意留下的空行。', 'You lift away the later page. The old roll contains names—and spaces deliberately left blank.'],
    },
    {
      prompt: ['几行名字已经无法辨认。旁边的注记写着：“待本人或同伴核实。”', 'Several names are unreadable. The margin says: “Await the person or a companion who can verify.”'],
      options: [
        { id: 'work_2_guess', label: ['按相近字形补齐空缺', 'Fill the gaps with likely names'], correct: false, feedback: ['艾妲说：“不知道，就留白。猜错的名字，会让等候的人认错归路。”', 'Ada says, “Leave unknown names blank. A guessed name could send someone waiting down the wrong road.”'] },
        { id: 'work_2_witness', label: ['保留空行，标注等待核实', 'Keep the spaces and mark them for verification'], correct: true, feedback: ['空行保留下来。', 'The spaces remain.'] },
      ], success: ['你没有替无名者编造故事，只在空行旁留下待核实的标记。', 'You invent no story for the unnamed. You mark the spaces for someone who knows.'],
    },
  ],
  blacksail: [
    {
      prompt: ['货单列着三次满载出港。可供核对的有货重、涨潮时刻和船员口粮。哪一栏能查出“空船”的矛盾？', 'The manifest lists three fully laden departures. You can compare cargo weight, high tide, or crew rations. Which column tests the claim of “crewless boats”?'],
      options: [
        { id: 'work_1_tide', label: ['查涨潮时刻', 'Check the time of high tide'], correct: false, feedback: ['玛拉说：“潮水能托起空船，也能托起满船。它不告诉你有没有人在吃饭。”', 'Mara says, “The tide lifts crewed boats and empty ones alike. It cannot tell us whether anyone aboard is eating.”'] },
        { id: 'work_1_rations', label: ['对照船员口粮栏', 'Compare the crew-ration column'], correct: true, feedback: ['三次航行都没有口粮记录。', 'None of the three voyages records any crew rations.'] },
        { id: 'work_1_weight', label: ['只看货物总重', 'Read only the cargo weight'], correct: false, feedback: ['玛拉点着另一栏：“载货多，不等于没有水手。找活人留下的需要。”', 'Mara points to another column. “Heavy cargo does not prove an empty crew. Look for what living people need.”'] },
      ], success: ['三次满载、零份口粮。你把这处矛盾圈给玛拉看。她取下罩着暖灯的黑布。', 'Three full cargoes, no rations. You circle the contradiction for Mara. She removes the dark cloth from the warm lamp.'],
    },
    {
      prompt: ['灯板上有两种旧信号：“向冷灯靠拢”和“在暖灯外等候”。航道仍可能有幽灵艇，不能现在就放行。', 'The signal board offers two old messages: “Approach the cold lamp” and “Wait outside the warm lamp.” Ghost boats may still occupy the channel; it is not time to clear passage.'],
      options: [
        { id: 'work_2_approach', label: ['照旧指向冷灯', 'Keep directing ships toward the cold lamp'], correct: false, feedback: ['玛拉立刻合上灯罩：“那是陷阱，不是港口。先留船在安全的等待线。”', 'Mara shuts the hood at once. “That is a trap, not a harbor. Keep the boats at the waiting line.”'] },
        { id: 'work_2_wait', label: ['设为暖灯外等候，清路后再放行', 'Signal a warm-light holding line until passage is cleared'], correct: true, feedback: ['等待线已标清。', 'The holding line is marked.'] },
      ], success: ['你转好遮光板。暖灯先标出等待线，不冒充已经安全的航道。', 'You set the hood. For now, the warm lamp marks a holding line; it does not pretend the channel is safe.'],
    },
  ],
  winter: [
    {
      prompt: ['担架上方已经盖着毯，底下却不断漏风。桌上还有一层干布。', 'A blanket already covers the stretcher, but a draft comes through underneath. A dry pad remains on the table.'],
      options: [
        { id: 'work_1_top', label: ['把所有布继续堆在上方', 'Pile every cloth on top'], correct: false, feedback: ['米哈伊托住担架：“上面够了。风是从底下钻进来的，先处理漏风处。”', 'Mikhail steadies the stretcher. “There is enough above. The draft comes from below. Deal with the gap first.”'] },
        { id: 'work_1_under', label: ['托稳担架，把干布垫在底下', 'Steady the stretcher and pad the underside'], correct: true, feedback: ['底部的缝隙被盖住了。', 'The gap underneath is covered.'] },
      ], success: ['干布兜住担架底部，不再随风翻起。两端的绑带还松着。', 'The dry pad fits beneath the stretcher and stops flapping in the wind. Its straps remain loose at both ends.'],
    },
    {
      prompt: ['伤口位置已经用红线标出。你需要固定保温层，让担架被抬起时也不会松脱。', 'A red thread marks the wound position. The insulation needs securing so it stays in place when the stretcher is lifted.'],
      options: [
        { id: 'work_2_center', label: ['从正中压紧绑带', 'Tighten a strap across the middle'], correct: false, feedback: ['米哈伊按住绑带：“别压红线那里。固定的是布，不是把伤处绑死。”', 'Mikhail catches the strap. “Not over the red mark. Secure the cloth without binding the wound.”'] },
        { id: 'work_2_ends', label: ['避开红线，固定两端并检查抬杆', 'Avoid the mark, secure both ends, and check the handles'], correct: true, feedback: ['保温层固定好了。', 'The insulation is secure.'] },
      ], success: ['两端绑带留出合适余量，抬杆也没有被缠住。', 'The end straps hold without pulling tight across the wound; the handles remain clear.'],
    },
  ],
  kyoto: [
    {
      prompt: ['湿页的外沿还有松开的地方，中心却黏得很紧。棚外火光很亮，澄却把灯挪远了一点。', 'The wet pages have loose edges but stick firmly at the center. The fire outside is bright; Sumi moves the lamp farther away.'],
      options: [
        { id: 'work_1_heat', label: ['把名册靠近明火快速烘干', 'Hold the register near the flame to dry it quickly'], correct: false, feedback: ['澄把书移回棚下：“别让我们救下的纸再挨一次火。先从松开的边慢慢分。”', 'Sumi moves the book back beneath the shelter. “Do not make the pages face fire twice. Begin slowly at the loose edges.”'] },
        { id: 'work_1_edges', label: ['从松开的外沿逐页分开', 'Separate the pages slowly from the loose edges'], correct: true, feedback: ['湿页分开了，没有撕裂。', 'The wet pages separate without tearing.'] },
      ], success: ['几行墨迹露了出来。风从棚边吹过，纸页的角随之卷起。', 'Several lines of ink are visible again. A draft lifts the corners of the pages.'],
    },
    {
      prompt: ['桌上有平木片和一卷紧绳。摊开的湿纸需要留在通风处，边角不能乱飞。', 'Flat wooden strips and a coil of tight cord lie on the table. The spread pages need air, but their corners must not blow away.'],
      options: [
        { id: 'work_2_bundle', label: ['把湿页重新紧紧捆成一束', 'Tie the wet pages tightly together again'], correct: false, feedback: ['澄松开绳：“又叠紧，就又黏住了。让每一页有一点风。”', 'Sumi loosens the cord. “Packed tight, they will stick again. Leave a little air for each page.”'] },
        { id: 'work_2_flat', label: ['用平木片压住边角，保留通风间隙', 'Weight the corners with flat strips and leave room for air'], correct: true, feedback: ['纸页稳稳地摊开了。', 'The pages lie flat and secure.'] },
      ], success: ['木片压住卷角，纸页之间留出了空隙。那些名字暂时安全了。', 'The strips hold the curling corners, with space between the pages. For now, the names are safe.'],
    },
  ],
};
