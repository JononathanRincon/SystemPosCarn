export type TipoModificacionCatalogo = 'producto' | 'categoria' | 'precio';

export class CatalogoModificadoEvent {
  public static readonly EVENT_NAME = 'catalogo.modificado';

  constructor(
    public readonly tenantId: string,
    public readonly entidadId: string,
    public readonly tipo: TipoModificacionCatalogo,
    public readonly sucursalId?: string | null,
    public readonly timestamp: Date = new Date(),
  ) {}
}
