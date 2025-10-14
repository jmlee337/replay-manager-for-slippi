declare module 'xhr2' {
  const XMLHttpRequest: {
    prototype: XMLHttpRequest;
    new (): XMLHttpRequest;
  };
  export = XMLHttpRequest;
}
