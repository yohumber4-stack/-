import { PartKind } from '../vehicle/parts';
import { SlotId } from '../vehicle/carModel';

export type Lang = 'ru' | 'en';
let lang: Lang = 'ru';
export function setLang(l: Lang) {
  lang = l;
}
export function getLang() {
  return lang;
}
/** Pick the string for the current language. */
export function tr(ru: string, en: string) {
  return lang === 'ru' ? ru : en;
}
export const L = tr;

const SLOT_NAMES: Record<SlotId, [string, string]> = {
  door_fl: ['Дверь передняя левая', 'Front left door'],
  door_fr: ['Дверь передняя правая', 'Front right door'],
  door_rl: ['Дверь задняя левая', 'Rear left door'],
  door_rr: ['Дверь задняя правая', 'Rear right door'],
  hood: ['Капот', 'Hood'],
  trunk: ['Крышка багажника', 'Trunk lid'],
  wheel_fl: ['Колесо', 'Wheel'],
  wheel_fr: ['Колесо', 'Wheel'],
  wheel_rl: ['Колесо', 'Wheel'],
  wheel_rr: ['Колесо', 'Wheel'],
  engine: ['Двигатель', 'Engine'],
  battery: ['Аккумулятор', 'Battery'],
  radiator: ['Радиатор', 'Radiator'],
  headlight_l: ['Фара', 'Headlight'],
  headlight_r: ['Фара', 'Headlight'],
  bumper_f: ['Передний бампер', 'Front bumper'],
  bumper_r: ['Задний бампер', 'Rear bumper'],
  seat_d: ['Сиденье водителя', 'Driver seat'],
  seat_p: ['Сиденье пассажира', 'Passenger seat'],
  seat_r: ['Заднее сиденье', 'Rear seat'],
};
export function partName(kind: PartKind, slot: SlotId, l: Lang = lang) {
  if (kind === 'seat_f' && slot !== 'seat_d' && slot !== 'seat_p') return l === 'ru' ? 'Переднее сиденье' : 'Front seat';
  const n = SLOT_NAMES[slot] ?? [kind, kind];
  return n[l === 'ru' ? 0 : 1];
}

export const LETTER: Record<Lang, string> = {
  ru: [
    'Сынок,',
    '',
    'если ты читаешь это письмо — значит, почта ещё ходит, и ты жив. Я знаю, мы давно не говорили. После того, что случилось с миром, я думала, что не имею права тебя звать.',
    '',
    'Но здесь, на побережье, осталась вода и люди. Я жду тебя. Дорога длинная — почти пять тысяч километров на восток, по старому шоссе. Держись дороги: где дорога, там заправки и дома. Пустыня не прощает тех, кто от неё отходит.',
    '',
    'Отцовская машина в гараже. Аккумулятор я сняла, чтобы не сел — он на верстаке. Бензин в канистре, гаечный ключ рядом. Возьми воды и еды сколько сможешь.',
    '',
    'Ночью не останавливайся в поле. Говорят, там что-то бродит.',
    '',
    'Я верю, что ты доедешь.',
    '',
    'Мама.',
    'Июнь 1979',
  ].join('\n'),
  en: [
    'My son,',
    '',
    "if you are reading this, the mail still runs and you are alive. I know we haven't spoken in years. After what happened to the world, I thought I had no right to call you.",
    '',
    "But here, by the coast, there is still water and there are still people. I'm waiting for you. The road is long — almost five thousand kilometres east along the old highway. Stay on the road: where the road is, there are gas stations and houses. The desert does not forgive those who leave it.",
    '',
    "Your father's car is in the garage. I took the battery out so it wouldn't die — it's on the workbench. There's petrol in the can and the wrench is on the bench. Take as much water and food as you can.",
    '',
    "Don't stop in the open at night. They say something roams out there.",
    '',
    "I believe you'll make it.",
    '',
    'Mom.',
    'June 1979',
  ].join('\n'),
};

export const NOTES: Record<string, [string, string]> = {
  note: ['Кто-то нацарапал: «Колонки на юге пустые. Бензин ищите в брошенных машинах — шланг и канистра спасут жизнь».', 'Someone scribbled: "The pumps down south are dry. Look for fuel in abandoned cars — a hose and a can will save your life."'],
  mines: ['«Военные заминировали обочины у блокпостов. Не сворачивай с асфальта!»', '"The army mined the verges near the checkpoints. Don\'t leave the asphalt!"'],
  rabbits: ['«Кролики. Здоровые, как собаки. Выходят ночью. Не выходи из машины».', '"Rabbits. Big as dogs. They come out at night. Stay in the car."'],
};
