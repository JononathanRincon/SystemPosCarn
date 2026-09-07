export interface InventarioProps {
  id: string;
  sucursalId: string;
  productoId: string;
  cantidadActual?: number;
  cantidadMinimaAlerta?: number;
  ubicacionBodega?: string | null;
  actualizadoEn?: Date;
}

export interface InventarioResponseDto {
  id: string;
  sucursalId: string;
  productoId: string;
  cantidadActual: number;
  cantidadMinimaAlerta: number;
  ubicacionBodega: string | null;
  actualizadoEn: Date;
  alertaStockBajo: boolean;
}

export class Inventario {
  private readonly _id: string;
  private readonly _sucursalId: string;
  private readonly _productoId: string;
  private _cantidadActual: number;
  private _cantidadMinimaAlerta: number;
  private _ubicacionBodega: string | null;
  private _actualizadoEn: Date;

  constructor(props: InventarioProps) {
    if (!props.id) throw new Error('El ID de inventario es obligatorio');
    if (!props.sucursalId) throw new Error('El sucursalId es obligatorio');
    if (!props.productoId) throw new Error('El productoId es obligatorio');

    this._id = props.id;
    this._sucursalId = props.sucursalId;
    this._productoId = props.productoId;
    this._cantidadActual = Number((props.cantidadActual ?? 0).toFixed(3));
    this._cantidadMinimaAlerta = Number((props.cantidadMinimaAlerta ?? 5.0).toFixed(3));
    this._ubicacionBodega = props.ubicacionBodega?.trim() || null;
    this._actualizadoEn = props.actualizadoEn || new Date();
  }

  get id(): string { return this._id; }
  get sucursalId(): string { return this._sucursalId; }
  get productoId(): string { return this._productoId; }
  get cantidadActual(): number { return this._cantidadActual; }
  get cantidadMinimaAlerta(): number { return this._cantidadMinimaAlerta; }
  get ubicacionBodega(): string | null { return this._ubicacionBodega; }
  get actualizadoEn(): Date { return this._actualizadoEn; }

  /**
   * EARS-INV-02: Emite alerta cuando la cantidad actual es menor o igual a la cantidad mínima.
   */
  public tieneAlertaStockBajo(): boolean {
    return this._cantidadActual <= this._cantidadMinimaAlerta;
  }

  public incrementar(cantidad: number): void {
    if (cantidad <= 0) {
      throw new Error('La cantidad a incrementar debe ser mayor a cero');
    }
    this._cantidadActual = Number((this._cantidadActual + Number(cantidad.toFixed(3))).toFixed(3));
    this._actualizadoEn = new Date();
  }

  public decrementar(cantidad: number, permitirNegativo: boolean = false): void {
    if (cantidad <= 0) {
      throw new Error('La cantidad a decrementar debe ser mayor a cero');
    }
    const cantRedondeada = Number(cantidad.toFixed(3));
    if (!permitirNegativo && this._cantidadActual < cantRedondeada) {
      throw new Error(
        `Stock insuficiente para el producto ${this._productoId}. Disponible: ${this._cantidadActual}, Solicitado: ${cantRedondeada}`
      );
    }
    this._cantidadActual = Number((this._cantidadActual - cantRedondeada).toFixed(3));
    this._actualizadoEn = new Date();
  }

  /**
   * EARS-SYNC-05, EARS-INV-01, Caso Límite 3:
   * Aplica un delta cronológico directo (positivo o negativo).
   * Permite consolidar deltas offline sin bloquear la venta incluso si el stock resultante queda negativo.
   */
  public aplicarDelta(delta: number): void {
    if (delta === 0) {
      return;
    }
    this._cantidadActual = Number((this._cantidadActual + Number(delta.toFixed(3))).toFixed(3));
    this._actualizadoEn = new Date();
  }

  /**
   * EARS-SYNC-05: Determina si el inventario se encuentra en sobregiro / stock negativo.
   */
  public tieneStockNegativo(): boolean {
    return this._cantidadActual < 0;
  }

  public toResponseDto(): InventarioResponseDto {
    return {
      id: this._id,
      sucursalId: this._sucursalId,
      productoId: this._productoId,
      cantidadActual: this._cantidadActual,
      cantidadMinimaAlerta: this._cantidadMinimaAlerta,
      ubicacionBodega: this._ubicacionBodega,
      actualizadoEn: this._actualizadoEn,
      alertaStockBajo: this.tieneAlertaStockBajo(),
    };
  }
}
