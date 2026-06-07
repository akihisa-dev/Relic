declare module "jsdom" {
  export class JSDOM {
    window: Window;

    constructor(html?: string);
  }
}
