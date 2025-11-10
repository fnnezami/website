declare module "jsonresume-theme-tech-ger" {
  interface JsonResumeTheme {
    render: (resume: any, options?: any) => string;
  }
  const theme: JsonResumeTheme | ((resume: any, options?: any) => string);
  export = theme;
  export default theme;
}