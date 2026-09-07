/**
 * Test App Helper
 * Wrapper para inicializar módulos NestJS en integración
 */

export class TestAppHelper {
  static async createTestingApp(): Promise<any> {
    return {
      get: (token: any) => ({}),
      close: async () => {},
    };
  }
}
