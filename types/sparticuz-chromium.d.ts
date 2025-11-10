declare module "@sparticuz/chromium" {
  export const args: string[];
  export const defaultViewport: any;
  export function executablePath(): Promise<string> | string;
  export const headless: boolean;
  const chromium: {
    args: string[];
    defaultViewport: any;
    executablePath: () => Promise<string> | string;
    headless: boolean;
  };
  export default chromium;
}