/**
 * Test Database Helper
 * Configuración de utilidades para reset y simulación de BD en tests
 */

export class TestDatabaseHelper {
  static async resetDatabase(): Promise<void> {
    // Simula truncado de tablas antes de suites de integración
    return Promise.resolve();
  }

  static async seedInitialCatalog(): Promise<void> {
    // Simula inserción de tenants y productos para pruebas
    return Promise.resolve();
  }
}
