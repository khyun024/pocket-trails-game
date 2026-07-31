// 몬스터를 바꾸는 곳입니다.
// name: 표시 이름 / sprite: "/monsters/파일명.png" 또는 이모지
// type: 타입 / color: 대표 색상 / rarity: 출현 희귀도(1~5, 숫자가 클수록 희귀)
export type Monster = {
  id: string;
  name: string;
  sprite: string;
  type: string;
  color: string;
  rarity: number;
  catchRate?: number;
  spawnWeight?: number;
  family?: string;
  evolvesTo?: string;
  evolutionCost?: number;
  raidOnly?: boolean;
  description: string;
};

export const MONSTERS: Monster[] = [
  { id: "leaflet", name: "이상해씨", sprite: "/monsters/이상해씨.png", type: "풀/독", color: "#54c96b", rarity: 1, family: "leaflet", evolvesTo: "monster-009", evolutionCost: 12, description: "며칠 동안 아무것도 먹지 않아도 건강하다! 등에 있는 씨앗에는 많은 영양분이 있어서 문제없다!" },
  { id: "emberoo", name: "파이리", sprite: "/monsters/파이리.png", type: "불꽃", color: "#ff7657", rarity: 2, family: "emberoo", evolvesTo: "monster-010", evolutionCost: 12, description: "조용한 곳에 데려가면 꼬리가 타고 있는 작은 소리가 들린다." },
  { id: "bubbloo", name: "꼬부기", sprite: "/monsters/꼬부기.png", type: "물", color: "#5ebcf6", rarity: 1, family: "bubbloo", evolvesTo: "monster-011", evolutionCost: 12, description: "수면에서 물을 분사하여 먹이를 잡는다. 위험해지면 등껍질에 손발을 감추고 몸을 지킨다." },
  { id: "voltbit", name: "피카츄", sprite: "/monsters/피카츄.png", type: "전기", color: "#f4cb3c", rarity: 2, description: "꼬리를 세워서 주변의 기척을 느낀다고 한다. 그래서 무턱대고 꼬리를 잡아당기면 물어버린다." },
  { id: "mothmoon", name: "캐터피", sprite: "/monsters/캐터피.png", type: "벌레", color: "#a884ff", rarity: 3, description: "머리끝에 있는 더듬이를 건드리면 강렬한 냄새를 내서 몸을 보호하려 한다." },
  { id: "rockhorn", name: "꼬마돌", sprite: "/monsters/꼬마돌.png", type: "바위", color: "#b18b68", rarity: 3, description: "산길 등에 많이 서식한다. 실수로 밟으면 화를 내므로 주의가 필요하다." },
  { id: "cloudle", name: "구구", sprite: "/monsters/구구.png", type: "노말/비행", color: "#84d8e9", rarity: 4, description: "얌전한 성격이라 습격당해도 반격하지 않고 모래를 뿌려서 몸을 지키는 경우가 많다." },
  { id: "starling", name: "별가사리", sprite: "/monsters/별가사리.png", type: "물", color: "#5ebcf6", rarity: 5, description: "몸의 중심 부분만 남아 있으면 아무리 잘게 잘려도 재생한다고 한다." },
  { id: "monster-009", name: "이상해풀", sprite: "/monsters/이상해풀.png", type: "풀/독", color: "#6fbd67", rarity: 5, family: "leaflet", evolvesTo: "monster-024", evolutionCost: 25, description: "양분을 흡수해서 커진 봉오리에서 향기가 나기 시작하면 곧 꽃이 핀다는 증거다." },
  { id: "monster-010", name: "리자드", sprite: "/monsters/리자드.png", type: "불꽃", color: "#f07a4d", rarity: 5, family: "emberoo", evolvesTo: "monster-025", evolutionCost: 25, description: "강한 적과 싸움을 거듭하다 흥분하면 푸르스름한 불꽃을 뿜어낼 때가 있다." },
  { id: "monster-011", name: "어니부기", sprite: "/monsters/어니부기.png", type: "물", color: "#57aee8", rarity: 5, family: "bubbloo", evolvesTo: "monster-026", evolutionCost: 25, description: "딱 하고 머리를 맞을 때 등껍질로 숨어서 피한다. 하지만 꼬리가 살짝 삐져나와 있다." },
  { id: "monster-012", name: "포니타", sprite: "/monsters/포니타.png", type: "불꽃", color: "#f07a4d", rarity: 3, description: "매우 높이 점프한 후 착지할 때의 충격은 발굽과 다리의 근육으로 완화시킨다." },
  { id: "monster-013", name: "독침붕", sprite: "/monsters/독침붕.png", type: "벌레/독", color: "#8fba58", rarity: 5, catchRate: 0.08, description: "양손과 엉덩이에 있는 3개의 독침으로 상대를 찌르고 찌르고 또 찌르며 공격한다." },
  { id: "monster-014", name: "깨비참", sprite: "/monsters/깨비참.png", type: "노말/비행", color: "#84b9d8", rarity: 1, description: "높이 나는 것이 서투르다. 세력권을 지키기 위해 맹스피드로 날아다닌다." },
  { id: "monster-015", name: "삐삐", sprite: "/monsters/삐삐.png", type: "페어리", color: "#d985ba", rarity: 2, description: "모습과 행동이 사랑스러워서 인기가 높지만 수가 적어서인지 좀처럼 발견되지 않는다." },
  { id: "monster-016", name: "캐이시", sprite: "/monsters/캐이시.png", type: "에스퍼", color: "#c982c0", rarity: 2, description: "하루에 18시간을 잔다. 위험이 닥치면 자는 상태로 순간이동해서 도망친다." },
  { id: "monster-017", name: "파르셀", sprite: "/monsters/파르셀.png", type: "물/얼음", color: "#72cbd5", rarity: 4, description: "다이아몬드보다 딱딱한 껍질로 방어할 뿐 아니라 몸에 붙은 가시를 발사하므로 꽤나 벅차다." },
  { id: "monster-018", name: "팬텀", sprite: "/monsters/팬텀.png", type: "고스트/독", color: "#7d6aad", rarity: 5, catchRate: 0.08, description: "갑자기 한기를 느꼈다면 팬텀이 가까이 있는 것이다. 어쩌면 저주를 걸지도 모른다." },
  { id: "monster-019", name: "망나뇽", sprite: "/monsters/망나뇽.png", type: "드래곤/비행", color: "#6d72cf", rarity: 5, catchRate: 0.05, description: "넓은 바다 어딘가를 거처로 삼아 날아 이동한다고 하지만 어디까지나 소문에 지나지 않는다." },
  { id: "monster-020", name: "뮤츠", sprite: "/monsters/뮤츠.png", type: "에스퍼", color: "#8799a1", rarity: 5, catchRate: 0.01, spawnWeight: 0, raidOnly: true, description: "뮤와 유전자가 완전 같다. 하지만 크기도 성격도 무서울 정도로 다르다." },
  { id: "monster-021", name: "이브이", sprite: "/monsters/이브이.png", type: "노말", color: "#b98a5f", rarity: 2, description: "다양한 모습으로 진화한다. 이브이의 유전자는 진화의 비밀을 밝혀낼 열쇠다." },
  { id: "monster-022", name: "잠만보", sprite: "/monsters/잠만보.png", type: "노말", color: "#5e8c87", rarity: 4, catchRate: 0.18, description: "다소 곰팡이가 펴 있어도 신경쓰지 않고 계속 먹는다. 배탈 나지도 않는다." },
  { id: "monster-023", name: "라프라스", sprite: "/monsters/라프라스.png", type: "물/얼음", color: "#63a9d5", rarity: 4, catchRate: 0.16, description: "인간의 말을 이해하는 다정한 성격의 포켓몬이다." },
  { id: "monster-024", name: "이상해꽃", sprite: "/monsters/이상해꽃.png", type: "풀/독", color: "#4fa96b", rarity: 5, catchRate: 0.06, family: "leaflet", description: "양분을 흡수해서 커진 봉오리에서 향기가 나기 시작하면 곧 꽃이 핀다는 증거다." },
  { id: "monster-025", name: "리자몽", sprite: "/monsters/리자몽.png", type: "불꽃/비행", color: "#e76f45", rarity: 5, catchRate: 0.06, family: "emberoo", description: "입에서 작렬하는 불꽃을 토해낼 때 꼬리의 끝이 더욱 붉고 격렬하게 타오른다." },
  { id: "monster-026", name: "거북왕", sprite: "/monsters/거북왕.png", type: "물", color: "#4f8fc0", rarity: 5, catchRate: 0.06, family: "bubbloo", description: "상대를 겨냥한 다음 소방차의 호스보다 강한 기세로 물을 뿜는다." },
  { id: "monster-027", name: "프리져", sprite: "/monsters/프리져.png", type: "얼음/비행", color: "#70b9dd", rarity: 5, catchRate: 0.015, spawnWeight: 0, raidOnly: true, description: "겨울 하늘의 공기 중에 있는 수분을 얼려 눈을 내리게 만드는 전설의 새 포켓몬." },
  { id: "monster-028", name: "썬더", sprite: "/monsters/썬더.png", type: "전기/비행", color: "#d9b62e", rarity: 5, catchRate: 0.015, spawnWeight: 0, raidOnly: true, description: "하늘이 어두워지고 벼락이 연속으로 떨어진 뒤에야 전설의 포켓몬은 나타난다." },
  { id: "monster-029", name: "파이어", sprite: "/monsters/파이어.png", type: "불꽃/비행", color: "#df7542", rarity: 5, catchRate: 0.015, spawnWeight: 0, raidOnly: true, description: "밤하늘마저 빨갛게 물들일 만큼 세차게 타오르는 날개로 나는 전설의 새 포켓몬." },
  { id: "monster-030", name: "뮤", sprite: "/monsters/뮤.png", type: "에스퍼", color: "#d88fb2", rarity: 5, catchRate: 0.008, spawnWeight: 0, raidOnly: true, description: "현미경으로 관찰하면 매우 짧고 가는 털이 촘촘하게 나 있다." },
];

// 이미지 사용 예시:
// { id: "my-monster", name: "내 몬스터", sprite: "/monsters/my-monster.png",
//   type: "불꽃", color: "#ff7657", rarity: 2, description: "설명" }
