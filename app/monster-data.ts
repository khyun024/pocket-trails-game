// 몬스터를 바꾸는 곳입니다.
// name: 표시 이름 / sprite: 이미지 주소(예: "/monsters/my-monster.png") 또는 이모지
// type: 타입 / color: 대표 색상 / rarity: 출현 희귀도(1~5, 숫자가 클수록 희귀)
export type Monster = {
  id: string;
  name: string;
  sprite: string;
  type: string;
  color: string;
  rarity: number;
  description: string;
};

export const MONSTERS: Monster[] = [
  { id: "leaflet", name: "이상해씨", sprite: "🌿", type: "풀", color: "#54c96b", rarity: 1, description: "며칠 동안 아무것도 먹지 않아도 건강하다! 등에 있는 씨앗에는 많은 영양분이 있어서 문제없다!" },
  { id: "emberoo", name: "파이리", sprite: "🔥", type: "불꽃", color: "#ff7657", rarity: 2, description: "조용한 곳에 데려가면 꼬리가 타고 있는 작은 소리가 들린다." },
  { id: "bubbloo", name: "꼬부기", sprite: "💧", type: "물", color: "#5ebcf6", rarity: 1, description: "수면에서 물을 분사하여 먹이를 잡는다. 위험해지면 등껍질에 손발을 감추고 몸을 지킨다." },
  { id: "voltbit", name: "피카츄", sprite: "⚡", type: "전기", color: "#f4cb3c", rarity: 2, description: "꼬리를 세워서 주변의 기척을 느낀다고 한다. 그래서 무턱대고 꼬리를 잡아당기면 물어버린다." },
  { id: "mothmoon", name: "캐터피", sprite: "🪲", type: "달빛", color: "#a884ff", rarity: 3, description: "머리끝에 있는 더듬이를 건드리면 강렬한 냄새를 내서 몸을 보호하려 한다." },
  { id: "rockhorn", name: "꼬마돌", sprite: "🦏", type: "바위", color: "#b18b68", rarity: 3, description: "산길 등에 많이 서식한다. 실수로 밟으면 화를 내므로 주의가 필요하다." },
  { id: "cloudle", name: "구구", sprite: "☁️", type: "비행", color: "#84d8e9", rarity: 4, description: "얌전한 성격이라 습격당해도 반격하지 않고 모래를 뿌려서 몸을 지키는 경우가 많다." },
  { id: "starling", name: "별가사리", sprite: "💧", type: "", color: "#ffb84d", rarity: 5, description: "몸의 중심 부분만 남아 있으면 아무리 잘게 잘려도 재생한다고 한다." },
];
