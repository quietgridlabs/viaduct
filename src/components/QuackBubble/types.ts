export type QuackQuip = { id: number; text: string; tilt: number };

export type QuackBubbleProps = {
  quip: QuackQuip;
  side: 'below' | 'above' | 'left';
};
