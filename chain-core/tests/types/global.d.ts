// Global type declarations for testing environment

declare global {
  var testApiKey: string;
  
  namespace NodeJS {
    interface Global {
      testApiKey: string;
    }
  }
}

export { };

